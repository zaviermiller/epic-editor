/**
 * Batch Layout Engine for Epic-Level Visualization
 *
 * Implements a Sugiyama-style layered layout algorithm to calculate
 * optimal grid positions for batches based on their dependencies.
 */

import { Batch } from "@/types";

/**
 * Configuration for the batch layout grid
 */
export interface BatchLayoutConfig {
  /** Minimum width of each batch container in pixels */
  minBatchWidth: number;
  /** Maximum width of each batch container in pixels */
  maxBatchWidth: number;
  /** Minimum height of each batch container in pixels */
  minBatchHeight: number;
  /** Horizontal gap between columns (for arrow routing) */
  horizontalGap: number;
  /** Vertical gap between rows */
  verticalGap: number;
  /** Padding around the canvas */
  padding: number;
}

/**
 * Default batch layout configuration
 */
export const DEFAULT_BATCH_LAYOUT_CONFIG: BatchLayoutConfig = {
  minBatchWidth: 380,
  maxBatchWidth: 450,
  minBatchHeight: 200,
  horizontalGap: 80,
  verticalGap: 40,
  padding: 50,
};

/**
 * Layout information for a single batch
 */
export interface BatchLayout {
  /** Batch number (ID) */
  batchNumber: number;
  /** Column index (dependency depth) */
  col: number;
  /** Row index */
  row: number;
  /** Pixel x coordinate */
  x: number;
  /** Pixel y coordinate */
  y: number;
  /** Actual width of this batch (may vary based on content) */
  width: number;
  /** Actual height of this batch (may vary based on content) */
  height: number;
}

/**
 * Result of the batch layout calculation
 */
export interface BatchLayoutResult {
  /** Layout information for all batches */
  batches: BatchLayout[];
  /** Total number of columns */
  gridWidth: number;
  /** Total number of rows */
  gridHeight: number;
  /** Total canvas width in pixels */
  canvasWidth: number;
  /** Total canvas height in pixels */
  canvasHeight: number;
  /** Width of each column (for arrow routing) */
  columnWidths: number[];
  /** Height of each row (for arrow routing) */
  rowHeights: number[];
}

/**
 * Build a map of batch dependencies
 */
function buildDependencyMaps(
  batches: Batch[],
): Map<number, { dependsOn: number[]; dependedBy: number[] }> {
  const batchNumbers = new Set(batches.map((b) => b.number));
  const depMap = new Map<
    number,
    { dependsOn: number[]; dependedBy: number[] }
  >();

  // Initialize map for all batches
  for (const batch of batches) {
    depMap.set(batch.number, { dependsOn: [], dependedBy: [] });
  }

  // Build dependency relationships (only for batches within this epic)
  for (const batch of batches) {
    const intraDeps = batch.dependsOn.filter((depNum) =>
      batchNumbers.has(depNum),
    );

    const entry = depMap.get(batch.number)!;
    entry.dependsOn = intraDeps;

    // Update reverse dependencies
    for (const depNum of intraDeps) {
      const depEntry = depMap.get(depNum);
      if (depEntry) {
        depEntry.dependedBy.push(batch.number);
      }
    }
  }

  return depMap;
}

/**
 * Step 1: Layer Assignment (Column Assignment)
 */
function assignColumns(
  batches: Batch[],
  depMap: Map<number, { dependsOn: number[]; dependedBy: number[] }>,
): Map<number, number> {
  const columns = new Map<number, number>();
  const batchNumbers = new Set(batches.map((b) => b.number));

  function getColumn(
    batchNum: number,
    visited: Set<number> = new Set(),
  ): number {
    if (visited.has(batchNum)) return 0;
    if (columns.has(batchNum)) return columns.get(batchNum)!;

    visited.add(batchNum);
    const deps = depMap.get(batchNum);

    if (!deps || deps.dependsOn.length === 0) {
      columns.set(batchNum, 0);
      return 0;
    }

    const validDeps = deps.dependsOn.filter((d) => batchNumbers.has(d));
    if (validDeps.length === 0) {
      columns.set(batchNum, 0);
      return 0;
    }

    const maxDepCol = Math.max(
      ...validDeps.map((d) => getColumn(d, new Set(visited))),
    );
    const col = maxDepCol + 1;
    columns.set(batchNum, col);
    return col;
  }

  for (const batch of batches) {
    getColumn(batch.number);
  }

  return columns;
}

/**
 * Step 2: Crossing Reduction (Row Ordering)
 */
function assignRows(
  batches: Batch[],
  columns: Map<number, number>,
  depMap: Map<number, { dependsOn: number[]; dependedBy: number[] }>,
): Map<number, number> {
  const rows = new Map<number, number>();
  const batchNumbers = new Set(batches.map((b) => b.number));

  // Group batches by column
  const columnGroups = new Map<number, number[]>();
  for (const batch of batches) {
    const col = columns.get(batch.number) || 0;
    if (!columnGroups.has(col)) {
      columnGroups.set(col, []);
    }
    columnGroups.get(col)!.push(batch.number);
  }

  const maxCol = Math.max(...Array.from(columns.values()), 0);

  // Process column by column
  for (let col = 0; col <= maxCol; col++) {
    const batchesInCol = columnGroups.get(col) || [];

    if (col === 0) {
      // First column: order by number of dependents
      batchesInCol.sort((a, b) => {
        const depsA = depMap.get(a)?.dependedBy.length || 0;
        const depsB = depMap.get(b)?.dependedBy.length || 0;
        return depsB - depsA;
      });
      batchesInCol.forEach((batchNum, idx) => rows.set(batchNum, idx));
    } else {
      // Subsequent columns: use barycenter heuristic
      const batchPositions: Array<{ batchNum: number; idealRow: number }> = [];

      for (const batchNum of batchesInCol) {
        const deps = depMap.get(batchNum)?.dependsOn || [];
        const depRows = deps
          .filter((d) => batchNumbers.has(d) && rows.has(d))
          .map((d) => rows.get(d)!);

        let idealRow: number;
        if (depRows.length > 0) {
          idealRow = depRows.reduce((a, b) => a + b, 0) / depRows.length;
        } else {
          idealRow = batchesInCol.indexOf(batchNum);
        }
        batchPositions.push({ batchNum, idealRow });
      }

      batchPositions.sort((a, b) => a.idealRow - b.idealRow);

      const usedRows = new Set<number>();
      for (const { batchNum, idealRow } of batchPositions) {
        let row = Math.round(idealRow);
        let offset = 0;
        while (usedRows.has(row)) {
          offset++;
          if (!usedRows.has(row + offset)) {
            row = row + offset;
          } else if (!usedRows.has(row - offset) && row - offset >= 0) {
            row = row - offset;
          }
        }
        usedRows.add(row);
        rows.set(batchNum, row);
      }
    }
  }

  // Normalize row numbers
  const allRows = Array.from(rows.values()).sort((a, b) => a - b);
  const uniqueRows = [...new Set(allRows)];
  const rowMapping = new Map<number, number>();
  uniqueRows.forEach((row, idx) => rowMapping.set(row, idx));

  for (const [batchNum, row] of rows.entries()) {
    rows.set(batchNum, rowMapping.get(row) || 0);
  }

  return rows;
}

/**
 * Estimate the height of a batch based on its task count
 */
function estimateBatchHeight(batch: Batch, config: BatchLayoutConfig): number {
  // Header height + padding + estimated task area
  const headerHeight = 40;
  const padding = 24; // p-3 on both sides
  const taskHeight = 55; // Same as task cell height
  const taskGap = 16;

  // Estimate rows based on task count and dependencies
  const taskCount = batch.tasks.length;
  const estimatedRows = Math.max(1, Math.ceil(taskCount / 3)); // Rough estimate

  const contentHeight =
    estimatedRows * taskHeight + (estimatedRows - 1) * taskGap;

  return Math.max(
    config.minBatchHeight,
    headerHeight + padding + contentHeight,
  );
}

/**
 * Calculate the layout for a set of batches
 */
export function calculateBatchLayout(
  batches: Batch[],
  config: BatchLayoutConfig = DEFAULT_BATCH_LAYOUT_CONFIG,
): BatchLayoutResult {
  if (batches.length === 0) {
    return {
      batches: [],
      gridWidth: 0,
      gridHeight: 0,
      canvasWidth: config.padding * 2,
      canvasHeight: config.padding * 2,
      columnWidths: [],
      rowHeights: [],
    };
  }

  // Build dependency maps
  const depMap = buildDependencyMaps(batches);

  // Step 1: Assign columns
  const columns = assignColumns(batches, depMap);

  // Step 2: Assign rows
  const rows = assignRows(batches, columns, depMap);

  // Calculate grid dimensions
  const maxCol = Math.max(...Array.from(columns.values()), 0);
  const maxRow = Math.max(...Array.from(rows.values()), 0);
  const gridWidth = maxCol + 1;
  const gridHeight = maxRow + 1;

  // Calculate column widths and row heights based on content
  const columnWidths: number[] = new Array(gridWidth).fill(
    config.minBatchWidth,
  );
  const rowHeights: number[] = new Array(gridHeight).fill(
    config.minBatchHeight,
  );

  // First pass: determine sizes for each batch
  const batchSizes = new Map<number, { width: number; height: number }>();
  for (const batch of batches) {
    const width = config.minBatchWidth; // All batches same width for now
    const height = estimateBatchHeight(batch, config);
    batchSizes.set(batch.number, { width, height });

    const col = columns.get(batch.number) || 0;
    const row = rows.get(batch.number) || 0;

    // Update column width to fit the widest batch
    columnWidths[col] = Math.max(columnWidths[col], width);
    // Update row height to fit the tallest batch
    rowHeights[row] = Math.max(rowHeights[row], height);
  }

  // Calculate cumulative positions
  const columnX: number[] = [config.padding];
  for (let i = 1; i < gridWidth; i++) {
    columnX[i] = columnX[i - 1] + columnWidths[i - 1] + config.horizontalGap;
  }

  const rowY: number[] = [config.padding];
  for (let i = 1; i < gridHeight; i++) {
    rowY[i] = rowY[i - 1] + rowHeights[i - 1] + config.verticalGap;
  }

  // Create batch layouts with pixel coordinates
  const batchLayouts: BatchLayout[] = [];

  for (const batch of batches) {
    const col = columns.get(batch.number) || 0;
    const row = rows.get(batch.number) || 0;
    const size = batchSizes.get(batch.number) || {
      width: config.minBatchWidth,
      height: config.minBatchHeight,
    };

    batchLayouts.push({
      batchNumber: batch.number,
      col,
      row,
      x: columnX[col],
      y: rowY[row],
      width: size.width,
      height: rowHeights[row], // Use row height for uniform alignment
    });
  }

  // Calculate canvas dimensions
  const canvasWidth =
    config.padding * 2 +
    columnWidths.reduce((a, b) => a + b, 0) +
    (gridWidth - 1) * config.horizontalGap;
  const canvasHeight =
    config.padding * 2 +
    rowHeights.reduce((a, b) => a + b, 0) +
    (gridHeight - 1) * config.verticalGap;

  return {
    batches: batchLayouts,
    gridWidth,
    gridHeight,
    canvasWidth: Math.max(
      canvasWidth,
      config.minBatchWidth + config.padding * 2,
    ),
    canvasHeight: Math.max(
      canvasHeight,
      config.minBatchHeight + config.padding * 2,
    ),
    columnWidths,
    rowHeights,
  };
}

/**
 * Create a map from batch number to BatchLayout for quick lookup
 */
export function createBatchLayoutMap(
  layouts: BatchLayout[],
): Map<number, BatchLayout> {
  return new Map(layouts.map((layout) => [layout.batchNumber, layout]));
}

/**
 * Build connections from batch dependency data
 */
export function buildBatchConnections(
  batches: Batch[],
): Array<{ from: number; to: number }> {
  const batchNumbers = new Set(batches.map((b) => b.number));
  const connections: Array<{ from: number; to: number }> = [];

  for (const batch of batches) {
    const intraDeps = batch.dependsOn.filter((depNum) =>
      batchNumbers.has(depNum),
    );

    for (const depNum of intraDeps) {
      connections.push({
        from: depNum,
        to: batch.number,
      });
    }
  }

  return connections;
}
