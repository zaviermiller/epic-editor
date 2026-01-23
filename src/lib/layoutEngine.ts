/**
 * Layout Engine for Canvas-Based Task Visualization
 *
 * Implements a Sugiyama-style layered layout algorithm to calculate
 * optimal grid positions for tasks based on their dependencies.
 */

import { Task } from "@/types";

/**
 * Configuration for the layout grid
 */
export interface LayoutConfig {
  /** Width of each task card in pixels */
  cellWidth: number;
  /** Height of each task card in pixels */
  cellHeight: number;
  /** Horizontal gap between columns (for arrow routing) */
  horizontalGap: number;
  /** Vertical gap between rows */
  verticalGap: number;
  /** Padding around the canvas */
  padding: number;
  /** Whether to use flexible height for cells */
  flexibleHeight?: boolean;
}

/**
 * Default layout configuration
 */
export const DEFAULT_LAYOUT_CONFIG: LayoutConfig = {
  cellWidth: 160,
  cellHeight: 65,
  horizontalGap: 50,
  verticalGap: 16,
  padding: 16,
  flexibleHeight: true,
};

/**
 * Layout information for a single task
 */
export interface TaskLayout {
  /** Task number (ID) */
  taskNumber: number;
  /** Column index (dependency depth) */
  col: number;
  /** Row index */
  row: number;
  /** Pixel x coordinate */
  x: number;
  /** Pixel y coordinate */
  y: number;
}

/**
 * Result of the layout calculation
 */
export interface LayoutResult {
  /** Layout information for all tasks */
  tasks: TaskLayout[];
  /** Total number of columns */
  gridWidth: number;
  /** Total number of rows */
  gridHeight: number;
  /** Total canvas width in pixels */
  canvasWidth: number;
  /** Total canvas height in pixels */
  canvasHeight: number;
}

/**
 * Build a map of intra-batch dependencies
 */
function buildDependencyMaps(
  tasks: Task[],
): Map<number, { dependsOn: number[]; dependedBy: number[] }> {
  const taskNumbers = new Set(tasks.map((t) => t.number));
  const depMap = new Map<
    number,
    { dependsOn: number[]; dependedBy: number[] }
  >();

  // Initialize map for all tasks
  for (const task of tasks) {
    depMap.set(task.number, { dependsOn: [], dependedBy: [] });
  }

  // Build dependency relationships (only for tasks within this batch)
  for (const task of tasks) {
    const intraBatchDeps = task.dependsOn.filter((depNum) =>
      taskNumbers.has(depNum),
    );

    const entry = depMap.get(task.number)!;
    entry.dependsOn = intraBatchDeps;

    // Update reverse dependencies
    for (const depNum of intraBatchDeps) {
      const depEntry = depMap.get(depNum);
      if (depEntry) {
        depEntry.dependedBy.push(task.number);
      }
    }
  }

  return depMap;
}

/**
 * Step 1: Layer Assignment (Column Assignment)
 *
 * Assign each task to a column based on its dependency depth.
 * Tasks with no dependencies go to column 0, their dependents to column 1, etc.
 */
function assignColumns(
  tasks: Task[],
  depMap: Map<number, { dependsOn: number[]; dependedBy: number[] }>,
): Map<number, number> {
  const columns = new Map<number, number>();
  const taskNumbers = new Set(tasks.map((t) => t.number));

  function getColumn(
    taskNum: number,
    visited: Set<number> = new Set(),
  ): number {
    // Cycle detection
    if (visited.has(taskNum)) return 0;
    // Already computed
    if (columns.has(taskNum)) return columns.get(taskNum)!;

    visited.add(taskNum);
    const deps = depMap.get(taskNum);

    // No dependencies or no valid intra-batch dependencies → column 0
    if (!deps || deps.dependsOn.length === 0) {
      columns.set(taskNum, 0);
      return 0;
    }

    // Filter to only valid dependencies (within batch)
    const validDeps = deps.dependsOn.filter((d) => taskNumbers.has(d));
    if (validDeps.length === 0) {
      columns.set(taskNum, 0);
      return 0;
    }

    // Column is max of dependency columns + 1
    const maxDepCol = Math.max(
      ...validDeps.map((d) => getColumn(d, new Set(visited))),
    );
    const col = maxDepCol + 1;
    columns.set(taskNum, col);
    return col;
  }

  // Calculate column for each task
  for (const task of tasks) {
    getColumn(task.number);
  }

  return columns;
}

/**
 * Step 2: Crossing Reduction (Row Ordering)
 *
 * Order tasks within each column to minimize edge crossings.
 * Uses the barycenter heuristic: position each task near the average
 * row of its dependencies.
 */
function assignRows(
  tasks: Task[],
  columns: Map<number, number>,
  depMap: Map<number, { dependsOn: number[]; dependedBy: number[] }>,
): Map<number, number> {
  const rows = new Map<number, number>();
  const taskNumbers = new Set(tasks.map((t) => t.number));

  // Group tasks by column
  const columnGroups = new Map<number, number[]>();
  for (const task of tasks) {
    const col = columns.get(task.number) || 0;
    if (!columnGroups.has(col)) {
      columnGroups.set(col, []);
    }
    columnGroups.get(col)!.push(task.number);
  }

  const maxCol = Math.max(...Array.from(columns.values()), 0);

  // Process column by column (left to right)
  for (let col = 0; col <= maxCol; col++) {
    const tasksInCol = columnGroups.get(col) || [];

    if (col === 0) {
      // First column: order by number of dependents (most dependents first)
      // This tends to create a more balanced layout
      tasksInCol.sort((a, b) => {
        const depsA = depMap.get(a)?.dependedBy.length || 0;
        const depsB = depMap.get(b)?.dependedBy.length || 0;
        return depsB - depsA;
      });
      tasksInCol.forEach((taskNum, idx) => rows.set(taskNum, idx));
    } else {
      // Subsequent columns: use barycenter heuristic
      const taskPositions: Array<{ taskNum: number; idealRow: number }> = [];

      for (const taskNum of tasksInCol) {
        const deps = depMap.get(taskNum)?.dependsOn || [];
        const depRows = deps
          .filter((d) => taskNumbers.has(d) && rows.has(d))
          .map((d) => rows.get(d)!);

        let idealRow: number;
        if (depRows.length > 0) {
          // Position near the average of dependency rows (barycenter)
          idealRow = depRows.reduce((a, b) => a + b, 0) / depRows.length;
        } else {
          // No dependencies with assigned rows, use index as fallback
          idealRow = tasksInCol.indexOf(taskNum);
        }
        taskPositions.push({ taskNum, idealRow });
      }

      // Sort by ideal row position
      taskPositions.sort((a, b) => a.idealRow - b.idealRow);

      // Assign actual rows, avoiding collisions
      const usedRows = new Set<number>();
      for (const { taskNum, idealRow } of taskPositions) {
        let row = Math.round(idealRow);
        // Find nearest available row
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
        rows.set(taskNum, row);
      }
    }
  }

  // Normalize row numbers to be contiguous starting from 0
  const allRows = Array.from(rows.values()).sort((a, b) => a - b);
  const uniqueRows = [...new Set(allRows)];
  const rowMapping = new Map<number, number>();
  uniqueRows.forEach((row, idx) => rowMapping.set(row, idx));

  // Apply normalization
  for (const [taskNum, row] of rows.entries()) {
    rows.set(taskNum, rowMapping.get(row) || 0);
  }

  return rows;
}

/**
 * Step 3: Coordinate Assignment
 *
 * Convert (col, row) grid positions to pixel (x, y) coordinates.
 */
function assignCoordinates(
  taskNumber: number,
  col: number,
  row: number,
  config: LayoutConfig,
): { x: number; y: number } {
  const x = config.padding + col * (config.cellWidth + config.horizontalGap);
  const y = config.padding + row * (config.cellHeight + config.verticalGap);

  return { x, y };
}

/**
 * Calculate the layout for a set of tasks
 *
 * Implements a Sugiyama-style layered layout algorithm:
 * 1. Layer Assignment: Assign columns based on dependency depth
 * 2. Crossing Reduction: Order rows to minimize edge crossings
 * 3. Coordinate Assignment: Convert grid to pixel coordinates
 */
export function calculateLayout(
  tasks: Task[],
  config: LayoutConfig = DEFAULT_LAYOUT_CONFIG,
): LayoutResult {
  if (tasks.length === 0) {
    return {
      tasks: [],
      gridWidth: 0,
      gridHeight: 0,
      canvasWidth: config.padding * 2,
      canvasHeight: config.padding * 2,
    };
  }

  // Build dependency maps
  const depMap = buildDependencyMaps(tasks);

  // Step 1: Assign columns (dependency depth)
  const columns = assignColumns(tasks, depMap);

  // Step 2: Assign rows (crossing reduction)
  const rows = assignRows(tasks, columns, depMap);

  // Step 3: Create task layouts with pixel coordinates
  const taskLayouts: TaskLayout[] = [];
  let maxCol = 0;
  let maxRow = 0;

  for (const task of tasks) {
    const col = columns.get(task.number) || 0;
    const row = rows.get(task.number) || 0;
    const { x, y } = assignCoordinates(task.number, col, row, config);

    taskLayouts.push({
      taskNumber: task.number,
      col,
      row,
      x,
      y,
    });

    maxCol = Math.max(maxCol, col);
    maxRow = Math.max(maxRow, row);
  }

  // Calculate canvas dimensions
  const gridWidth = maxCol + 1;
  const gridHeight = maxRow + 1;
  const canvasWidth =
    config.padding * 2 +
    gridWidth * config.cellWidth +
    (gridWidth - 1) * config.horizontalGap;
  const canvasHeight =
    config.padding * 2 +
    gridHeight * config.cellHeight +
    (gridHeight - 1) * config.verticalGap;

  return {
    tasks: taskLayouts,
    gridWidth,
    gridHeight,
    canvasWidth: Math.max(canvasWidth, config.cellWidth + config.padding * 2),
    canvasHeight: Math.max(
      canvasHeight,
      config.cellHeight + config.padding * 2,
    ),
  };
}

/**
 * Create a map from task number to TaskLayout for quick lookup
 */
export function createLayoutMap(
  layouts: TaskLayout[],
): Map<number, TaskLayout> {
  return new Map(layouts.map((layout) => [layout.taskNumber, layout]));
}
