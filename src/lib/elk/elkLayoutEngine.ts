/**
 * ELK Layout Engine
 *
 * Implements a two-phase layout approach:
 * 1. Inner layout: Use ELK to layout tasks within each batch (group)
 * 2. Outer packing: Custom algorithm to arrange batch groups on canvas
 *
 * This provides the best of both worlds:
 * - ELK's excellent layered layout for dependency graphs
 * - Custom control over group arrangement and whitespace
 */

import ELK, {
  ElkNode as ELKLibNode,
  ElkExtendedEdge,
} from "elkjs/lib/elk.bundled.js";
import { Epic, Batch } from "@/types";
import {
  ElkLayoutConfig,
  DEFAULT_ELK_CONFIG,
  ElkLayoutResult,
  PositionedBatch,
  PositionedTask,
  LayoutEdge,
  NodeDimensions,
} from "./types";
import { measureBatchTasks } from "./measureNodes";

// Create ELK instance
const elk = new ELK();

// ============================================================================
// Phase 1: Inner Layout (ELK for each batch)
// ============================================================================

interface InnerLayoutResult {
  batchNumber: number;
  tasks: Array<{
    taskNumber: number;
    x: number;
    y: number;
    width: number;
    height: number;
  }>;
  boundingBox: {
    width: number;
    height: number;
  };
}

/**
 * Create ELK graph for a single batch's tasks
 */
function createBatchElkGraph(
  batch: Batch,
  measurements: Map<number, NodeDimensions>,
  config: ElkLayoutConfig,
): ELKLibNode {
  const taskNumbers = new Set(batch.tasks.map((t) => t.number));

  // Create nodes for each task
  const children: ELKLibNode[] = batch.tasks.map((task) => {
    const dims = measurements.get(task.number) || {
      width: config.taskWidth,
      height: config.taskMinHeight,
    };
    return {
      id: `task-${task.number}`,
      width: dims.width,
      height: dims.height,
    };
  });

  // Create edges for intra-batch dependencies
  const edges: ElkExtendedEdge[] = [];
  for (const task of batch.tasks) {
    for (const depNum of task.dependsOn) {
      // Only include edges within this batch
      if (taskNumbers.has(depNum)) {
        edges.push({
          id: `edge-${depNum}-${task.number}`,
          sources: [`task-${depNum}`],
          targets: [`task-${task.number}`],
        });
      }
    }
  }

  return {
    id: `batch-${batch.number}`,
    children,
    edges,
    layoutOptions: {
      "elk.algorithm": "layered",
      "elk.direction": config.innerLayoutDirection,
      "elk.spacing.nodeNode": String(config.nodeSpacing),
      "elk.layered.spacing.nodeNodeBetweenLayers": String(
        config.nodeSpacing * 1.5,
      ),
      "elk.layered.spacing.edgeNodeBetweenLayers": String(config.nodeSpacing),
      "elk.edgeRouting": "ORTHOGONAL",
      "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
      "elk.layered.nodePlacement.strategy": "NETWORK_SIMPLEX",
      // Ensure compact layout
      "elk.layered.compaction.postCompaction.strategy": "LEFT",
      "elk.layered.compaction.connectedComponents": "true",
    },
  };
}

/**
 * Run ELK layout for a single batch
 */
async function layoutBatch(
  batch: Batch,
  config: ElkLayoutConfig,
): Promise<InnerLayoutResult> {
  const measurements = measureBatchTasks(batch.tasks, config);
  const graph = createBatchElkGraph(batch, measurements, config);

  const layoutedGraph = await elk.layout(graph);

  // Extract positioned tasks
  const tasks =
    layoutedGraph.children?.map((node) => ({
      taskNumber: parseInt(node.id.replace("task-", ""), 10),
      x: node.x || 0,
      y: node.y || 0,
      width: node.width || config.taskWidth,
      height: node.height || config.taskMinHeight,
    })) || [];

  // Calculate bounding box
  let maxX = 0;
  let maxY = 0;
  for (const task of tasks) {
    maxX = Math.max(maxX, task.x + task.width);
    maxY = Math.max(maxY, task.y + task.height);
  }

  return {
    batchNumber: batch.number,
    tasks,
    boundingBox: {
      width: maxX,
      height: maxY,
    },
  };
}

/**
 * Run ELK layout for all batches in parallel
 */
async function layoutAllBatches(
  batches: Batch[],
  config: ElkLayoutConfig,
): Promise<Map<number, InnerLayoutResult>> {
  const results = await Promise.all(
    batches.map((batch) => layoutBatch(batch, config)),
  );

  const resultMap = new Map<number, InnerLayoutResult>();
  for (const result of results) {
    resultMap.set(result.batchNumber, result);
  }

  return resultMap;
}

// ============================================================================
// Phase 2: Group Packing (Custom algorithm)
// ============================================================================

interface GroupSuperNode {
  batchNumber: number;
  batch: Batch;
  width: number;
  height: number;
  /** Connection weight to other groups (number of cross-batch edges) */
  connections: Map<number, number>;
}

/**
 * Estimate text width in pixels based on character count
 * Uses approximate character widths for the font used in batch headers
 */
function estimateTextWidth(text: string, fontSize: number): number {
  // Average character width is roughly 0.55 * fontSize for sans-serif fonts
  return text.length * fontSize * 0.55;
}

/**
 * Build super-nodes from inner layout results
 */
function buildSuperNodes(
  batches: Batch[],
  innerLayouts: Map<number, InnerLayoutResult>,
  config: ElkLayoutConfig,
): GroupSuperNode[] {
  const batchNumbers = new Set(batches.map((b) => b.number));

  return batches.map((batch) => {
    const innerLayout = innerLayouts.get(batch.number);
    const contentWidth = innerLayout?.boundingBox.width || 200;
    const contentHeight = innerLayout?.boundingBox.height || 100;

    // Calculate minimum width needed for the header:
    // - Title text width (at 13px font size)
    // - Progress bar (80px) + spacing (16px left padding + 16px gap)
    const titleWidth = estimateTextWidth(batch.title, 13);
    const headerMinWidth = titleWidth + 80 + 32; // title + progress bar + padding

    // Calculate group dimensions with padding and header
    // Width must fit both content and header
    const contentWidthWithPadding = contentWidth + config.groupPadding * 2;
    const width = Math.max(contentWidthWithPadding, headerMinWidth);
    const height =
      contentHeight + config.groupPadding * 2 + config.groupHeaderHeight;

    // Build connection weights (count edges between batches)
    const connections = new Map<number, number>();

    for (const task of batch.tasks) {
      for (const depNum of task.dependsOn) {
        // Find which batch this dependency belongs to
        for (const otherBatch of batches) {
          if (otherBatch.number === batch.number) continue;
          if (otherBatch.tasks.some((t) => t.number === depNum)) {
            const current = connections.get(otherBatch.number) || 0;
            connections.set(otherBatch.number, current + 1);
            break;
          }
        }
      }
    }

    // Also count batch-level dependencies
    for (const depNum of batch.dependsOn) {
      if (batchNumbers.has(depNum)) {
        const current = connections.get(depNum) || 0;
        connections.set(depNum, current + 5); // Weight batch deps higher
      }
    }

    return {
      batchNumber: batch.number,
      batch,
      width,
      height,
      connections,
    };
  });
}

interface PackedGroup {
  batchNumber: number;
  x: number;
  y: number;
  width: number;
  height: number;
  row: number;
  col: number;
}

/**
 * Compute the depth (column level) of each batch based on dependencies.
 * Batches with no dependencies are at depth 0, and dependent batches
 * are placed at max(dependency depths) + 1.
 */
function computeBatchDepths(batches: Batch[]): Map<number, number> {
  const batchSet = new Set(batches.map((b) => b.number));
  const depths = new Map<number, number>();

  // Initialize all depths to 0
  for (const batch of batches) {
    depths.set(batch.number, 0);
  }

  // Iteratively compute depths until stable
  let changed = true;
  let iterations = 0;
  const maxIterations = batches.length + 1;

  while (changed && iterations < maxIterations) {
    changed = false;
    iterations++;

    for (const batch of batches) {
      let maxDepDep = -1;

      for (const depNum of batch.dependsOn) {
        if (batchSet.has(depNum)) {
          const depDepth = depths.get(depNum) ?? 0;
          maxDepDep = Math.max(maxDepDep, depDepth);
        }
      }

      if (maxDepDep >= 0) {
        const newDepth = maxDepDep + 1;
        if (newDepth > (depths.get(batch.number) ?? 0)) {
          depths.set(batch.number, newDepth);
          changed = true;
        }
      }
    }
  }

  return depths;
}

/**
 * Pack groups into columns based on dependency depth.
 * This ensures arrows only go from left to right (between adjacent columns),
 * preventing arrows from going underneath other batch cards.
 */
function packGroupsIntoColumns(
  superNodes: GroupSuperNode[],
  batches: Batch[],
  config: ElkLayoutConfig,
): PackedGroup[] {
  const depths = computeBatchDepths(batches);

  // Group batches by their depth (column)
  const columns: Map<number, GroupSuperNode[]> = new Map();
  let maxDepth = 0;

  for (const node of superNodes) {
    const depth = depths.get(node.batchNumber) ?? 0;
    maxDepth = Math.max(maxDepth, depth);

    if (!columns.has(depth)) {
      columns.set(depth, []);
    }
    columns.get(depth)!.push(node);
  }

  // Sort nodes within each column to minimize edge crossings
  // Strategy: Sort by the average row position of connected batches in the next column
  // This ensures batches align vertically with their dependents

  // First pass: collect which batches depend on which (for alignment)
  // dependentsInNextCol[batchNum] = list of batch numbers in the next column that depend on it
  const dependentsInNextCol = new Map<number, number[]>();

  for (const batch of batches) {
    const batchDepth = depths.get(batch.number) ?? 0;
    for (const depNum of batch.dependsOn) {
      const depDepth = depths.get(depNum) ?? 0;
      // If the dependency is in the previous column
      if (depDepth === batchDepth - 1) {
        if (!dependentsInNextCol.has(depNum)) {
          dependentsInNextCol.set(depNum, []);
        }
        dependentsInNextCol.get(depNum)!.push(batch.number);
      }
    }
  }

  // Process columns from right to left so we can position earlier columns
  // based on where their dependents are placed
  const batchRowPositions = new Map<number, number>();

  // Start by assigning initial positions within each column based on connection priority
  for (let col = maxDepth; col >= 0; col--) {
    const nodesInColumn = columns.get(col) || [];

    if (col === maxDepth) {
      // Rightmost column: sort by total connections (most connected first)
      nodesInColumn.sort((a, b) => {
        const weightA = Array.from(a.connections.values()).reduce(
          (sum, w) => sum + w,
          0,
        );
        const weightB = Array.from(b.connections.values()).reduce(
          (sum, w) => sum + w,
          0,
        );
        return weightB - weightA;
      });
    } else {
      // Earlier columns: sort by average row position of dependents in next column
      nodesInColumn.sort((a, b) => {
        const depsA = dependentsInNextCol.get(a.batchNumber) || [];
        const depsB = dependentsInNextCol.get(b.batchNumber) || [];

        // Calculate average row position of dependents
        const avgRowA =
          depsA.length > 0
            ? depsA.reduce(
                (sum, dep) => sum + (batchRowPositions.get(dep) ?? 0),
                0,
              ) / depsA.length
            : 0;
        const avgRowB =
          depsB.length > 0
            ? depsB.reduce(
                (sum, dep) => sum + (batchRowPositions.get(dep) ?? 0),
                0,
              ) / depsB.length
            : 0;

        // If both have dependents, sort by their average row
        if (depsA.length > 0 && depsB.length > 0) {
          return avgRowA - avgRowB;
        }

        // If only one has dependents, prioritize the one with dependents (place it higher)
        if (depsA.length > 0) return -1;
        if (depsB.length > 0) return 1;

        // Neither has dependents: sort by total connections
        const weightA = Array.from(a.connections.values()).reduce(
          (sum, w) => sum + w,
          0,
        );
        const weightB = Array.from(b.connections.values()).reduce(
          (sum, w) => sum + w,
          0,
        );
        return weightB - weightA;
      });
    }

    // Record row positions for this column
    nodesInColumn.forEach((node, rowIndex) => {
      batchRowPositions.set(node.batchNumber, rowIndex);
    });
  }

  // Calculate column widths and positions
  const columnWidths: number[] = [];
  const columnXPositions: number[] = [];

  let currentX = config.canvasPadding;

  for (let col = 0; col <= maxDepth; col++) {
    const nodesInColumn = columns.get(col) || [];
    const maxWidth =
      nodesInColumn.length > 0
        ? Math.max(...nodesInColumn.map((n) => n.width))
        : 0;

    columnWidths.push(maxWidth);
    columnXPositions.push(currentX);

    currentX += maxWidth + config.columnGap;
  }

  // Position each node within its column
  const packedGroups: PackedGroup[] = [];

  for (let col = 0; col <= maxDepth; col++) {
    const nodesInColumn = columns.get(col) || [];
    let currentY = config.canvasPadding;

    nodesInColumn.forEach((node, rowIndex) => {
      // Center the node within the column width
      const colWidth = columnWidths[col];
      const xOffset = (colWidth - node.width) / 2;

      packedGroups.push({
        batchNumber: node.batchNumber,
        x: columnXPositions[col] + xOffset,
        y: currentY,
        width: node.width,
        height: node.height,
        row: rowIndex,
        col: col,
      });

      currentY += node.height + config.rowGap;
    });
  }

  return packedGroups;
}

// ============================================================================
// Phase 3: Final Assembly
// ============================================================================

/**
 * Collect all edges (both intra-batch and inter-batch, including batch-to-batch)
 */
function collectEdges(batches: Batch[]): LayoutEdge[] {
  const edges: LayoutEdge[] = [];
  const taskToBatch = new Map<number, number>();
  const batchNumbers = new Set(batches.map((b) => b.number));

  // Build task-to-batch mapping
  for (const batch of batches) {
    for (const task of batch.tasks) {
      taskToBatch.set(task.number, batch.number);
    }
  }

  // Collect task-to-task dependency edges
  for (const batch of batches) {
    for (const task of batch.tasks) {
      for (const depNum of task.dependsOn) {
        const fromBatch = taskToBatch.get(depNum);
        const toBatch = batch.number;

        if (fromBatch !== undefined) {
          edges.push({
            id: `edge-${depNum}-${task.number}`,
            from: depNum,
            to: task.number,
            isInterBatch: fromBatch !== toBatch,
            fromBatch,
            toBatch,
            isBatchEdge: false,
          });
        }
      }
    }
  }

  // Collect batch-to-batch dependency edges
  for (const batch of batches) {
    for (const depBatchNum of batch.dependsOn) {
      if (batchNumbers.has(depBatchNum)) {
        edges.push({
          id: `batch-edge-${depBatchNum}-${batch.number}`,
          from: depBatchNum,
          to: batch.number,
          isInterBatch: true,
          fromBatch: depBatchNum,
          toBatch: batch.number,
          isBatchEdge: true,
        });
      }
    }
  }

  return edges;
}

/**
 * Main layout function - orchestrates the entire layout process
 */
export async function calculateElkLayout(
  epic: Epic,
  config: ElkLayoutConfig = DEFAULT_ELK_CONFIG,
): Promise<ElkLayoutResult> {
  const batches = epic.batches;

  if (batches.length === 0) {
    return {
      batches: [],
      tasks: [],
      edges: [],
      canvasWidth: config.canvasPadding * 2,
      canvasHeight: config.canvasPadding * 2,
    };
  }

  // Phase 1: Inner layout for each batch
  const innerLayouts = await layoutAllBatches(batches, config);

  // Phase 2: Build super-nodes and pack into columns based on dependency depth
  const superNodes = buildSuperNodes(batches, innerLayouts, config);
  const packedGroups = packGroupsIntoColumns(superNodes, batches, config);

  // Create batch position map
  const batchPositions = new Map(packedGroups.map((g) => [g.batchNumber, g]));

  // Build positioned batches
  const positionedBatches: PositionedBatch[] = batches.map((batch) => {
    const packed = batchPositions.get(batch.number);
    const superNode = superNodes.find((n) => n.batchNumber === batch.number);

    return {
      id: `batch-${batch.number}`,
      batchNumber: batch.number,
      title: batch.title,
      status: batch.status,
      x: packed?.x || 0,
      y: packed?.y || 0,
      width: superNode?.width || 200,
      height: superNode?.height || 150,
      progress: batch.progress,
      row: packed?.row || 0,
      col: packed?.col || 0,
    };
  });

  // Build positioned tasks (translate inner positions to absolute)
  const positionedTasks: PositionedTask[] = [];
  for (const batch of batches) {
    const innerLayout = innerLayouts.get(batch.number);
    const packed = batchPositions.get(batch.number);

    if (!innerLayout || !packed) continue;

    const offsetX = packed.x + config.groupPadding;
    const offsetY = packed.y + config.groupHeaderHeight + config.groupPadding;

    for (const taskLayout of innerLayout.tasks) {
      const task = batch.tasks.find((t) => t.number === taskLayout.taskNumber);
      if (!task) continue;

      positionedTasks.push({
        id: `task-${task.number}`,
        taskNumber: task.number,
        title: task.title,
        status: task.status,
        x: offsetX + taskLayout.x,
        y: offsetY + taskLayout.y,
        width: taskLayout.width,
        height: taskLayout.height,
        batchNumber: batch.number,
        dependsOn: task.dependsOn,
      });
    }
  }

  // Collect edges (routing will be done separately)
  const edges = collectEdges(batches);

  // Calculate canvas dimensions
  let canvasWidth = config.canvasPadding * 2;
  let canvasHeight = config.canvasPadding * 2;

  for (const batch of positionedBatches) {
    canvasWidth = Math.max(
      canvasWidth,
      batch.x + batch.width + config.canvasPadding,
    );
    canvasHeight = Math.max(
      canvasHeight,
      batch.y + batch.height + config.canvasPadding,
    );
  }

  return {
    batches: positionedBatches,
    tasks: positionedTasks,
    edges: edges.map((e) => ({
      ...e,
      path: "", // Will be filled by edge router
      points: [],
    })),
    canvasWidth,
    canvasHeight,
  };
}
