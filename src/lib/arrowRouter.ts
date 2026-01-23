/**
 * Arrow Router for Canvas-Based Task Visualization
 *
 * Generates clean SVG paths for dependency arrows between tasks.
 * Supports horizontal, vertical, and complex routing strategies.
 */

import {
  TaskLayout,
  LayoutConfig,
  DEFAULT_LAYOUT_CONFIG,
} from "./layoutEngine";

/**
 * A connection between two tasks
 */
export interface Connection {
  /** Source task number (the task being depended on) */
  from: number;
  /** Target task number (the task that depends on source) */
  to: number;
}

/**
 * Generated arrow path with metadata
 */
export interface ArrowPath {
  /** Source task number */
  from: number;
  /** Target task number */
  to: number;
  /** SVG path d attribute */
  path: string;
  /** Path type for styling purposes */
  pathType: "horizontal" | "vertical" | "complex";
}

/**
 * Connection point on a task card
 */
interface ConnectionPoint {
  x: number;
  y: number;
  edge: "left" | "right" | "top" | "bottom";
}

/**
 * Get the right edge connection point for a task (source of arrow)
 */
function getRightEdge(
  layout: TaskLayout,
  config: LayoutConfig,
): ConnectionPoint {
  return {
    x: layout.x + config.cellWidth,
    y: layout.y + config.cellHeight / 2,
    edge: "right",
  };
}

/**
 * Get the left edge connection point for a task (target of arrow)
 */
function getLeftEdge(
  layout: TaskLayout,
  config: LayoutConfig,
): ConnectionPoint {
  return {
    x: layout.x,
    y: layout.y + config.cellHeight / 2,
    edge: "left",
  };
}

/**
 * Get the bottom edge connection point for a task
 */
function getBottomEdge(
  layout: TaskLayout,
  config: LayoutConfig,
): ConnectionPoint {
  return {
    x: layout.x + config.cellWidth / 2,
    y: layout.y + config.cellHeight,
    edge: "bottom",
  };
}

/**
 * Get the top edge connection point for a task
 */
function getTopEdge(layout: TaskLayout, config: LayoutConfig): ConnectionPoint {
  return {
    x: layout.x + config.cellWidth / 2,
    y: layout.y,
    edge: "top",
  };
}

/**
 * Generate a horizontal bezier curve path
 * Used when source is to the left of target
 */
function generateHorizontalPath(
  from: ConnectionPoint,
  to: ConnectionPoint,
): string {
  const dx = to.x - from.x;
  const controlOffset = Math.max(dx * 0.4, 20);

  return `M ${from.x} ${from.y} C ${from.x + controlOffset} ${from.y}, ${to.x - controlOffset} ${to.y}, ${to.x} ${to.y}`;
}

/**
 * Generate a vertical bezier curve path
 * Used when source is above or below target in the same column
 */
function generateVerticalPath(
  from: ConnectionPoint,
  to: ConnectionPoint,
): string {
  const dy = to.y - from.y;
  const controlOffset = Math.max(Math.abs(dy) * 0.4, 15);

  if (dy > 0) {
    // Downward flow
    return `M ${from.x} ${from.y} C ${from.x} ${from.y + controlOffset}, ${to.x} ${to.y - controlOffset}, ${to.x} ${to.y}`;
  } else {
    // Upward flow
    return `M ${from.x} ${from.y} C ${from.x} ${from.y - controlOffset}, ${to.x} ${to.y + controlOffset}, ${to.x} ${to.y}`;
  }
}

/**
 * Generate a complex path for backwards or diagonal connections
 * Routes around to avoid crossing over tasks
 */
function generateComplexPath(
  fromLayout: TaskLayout,
  toLayout: TaskLayout,
  config: LayoutConfig,
): string {
  const from = getRightEdge(fromLayout, config);
  const to = getLeftEdge(toLayout, config);

  // If target is to the left of source, route around
  if (to.x <= from.x) {
    // Route: right → down/up → left → target
    const routeOffset = config.horizontalGap / 2;
    const verticalOffset = config.cellHeight + config.verticalGap / 2;

    // Determine if we should go up or down based on relative positions
    const goDown = fromLayout.row <= toLayout.row;
    const midY = goDown
      ? Math.max(from.y, to.y) + verticalOffset
      : Math.min(from.y, to.y) - verticalOffset;

    // Create a path that goes: right, then vertical, then left to target
    return `M ${from.x} ${from.y} 
            L ${from.x + routeOffset} ${from.y}
            Q ${from.x + routeOffset + 10} ${from.y}, ${from.x + routeOffset + 10} ${from.y + (goDown ? 10 : -10)}
            L ${from.x + routeOffset + 10} ${midY}
            Q ${from.x + routeOffset + 10} ${midY + (goDown ? 10 : -10)}, ${from.x + routeOffset} ${midY + (goDown ? 10 : -10)}
            L ${to.x - routeOffset} ${midY + (goDown ? 10 : -10)}
            Q ${to.x - routeOffset - 10} ${midY + (goDown ? 10 : -10)}, ${to.x - routeOffset - 10} ${midY}
            L ${to.x - routeOffset - 10} ${to.y + (goDown ? -10 : 10)}
            Q ${to.x - routeOffset - 10} ${to.y}, ${to.x - routeOffset} ${to.y}
            L ${to.x} ${to.y}`;
  }

  // Diagonal path: use smooth S-curve
  const midX = (from.x + to.x) / 2;
  return `M ${from.x} ${from.y} C ${midX} ${from.y}, ${midX} ${to.y}, ${to.x} ${to.y}`;
}

/**
 * Generate arrow paths for all connections between tasks
 */
export function generateArrowPaths(
  connections: Connection[],
  taskLayouts: Map<number, TaskLayout>,
  config: LayoutConfig = DEFAULT_LAYOUT_CONFIG,
): ArrowPath[] {
  const paths: ArrowPath[] = [];

  for (const connection of connections) {
    const fromLayout = taskLayouts.get(connection.from);
    const toLayout = taskLayouts.get(connection.to);

    if (!fromLayout || !toLayout) {
      continue;
    }

    let path: string;
    let pathType: ArrowPath["pathType"];

    // Determine the type of connection based on relative positions
    const isHorizontal = fromLayout.col < toLayout.col;
    const isVertical = fromLayout.col === toLayout.col;
    const isBackwards = fromLayout.col > toLayout.col;

    if (isHorizontal) {
      // Horizontal flow (most common): left-to-right
      const from = getRightEdge(fromLayout, config);
      const to = getLeftEdge(toLayout, config);
      path = generateHorizontalPath(from, to);
      pathType = "horizontal";
    } else if (isVertical) {
      // Vertical flow: same column
      const from = getBottomEdge(fromLayout, config);
      const to = getTopEdge(toLayout, config);

      // Swap if from is below to
      if (fromLayout.row > toLayout.row) {
        const fromTop = getTopEdge(fromLayout, config);
        const toBottom = getBottomEdge(toLayout, config);
        path = generateVerticalPath(toBottom, fromTop);
      } else {
        path = generateVerticalPath(from, to);
      }
      pathType = "vertical";
    } else if (isBackwards) {
      // Backwards flow: route around
      path = generateComplexPath(fromLayout, toLayout, config);
      pathType = "complex";
    } else {
      // Fallback: diagonal
      const from = getRightEdge(fromLayout, config);
      const to = getLeftEdge(toLayout, config);
      const midX = (from.x + to.x) / 2;
      path = `M ${from.x} ${from.y} C ${midX} ${from.y}, ${midX} ${to.y}, ${to.x} ${to.y}`;
      pathType = "complex";
    }

    paths.push({
      from: connection.from,
      to: connection.to,
      path,
      pathType,
    });
  }

  return paths;
}

/**
 * Build connections from task dependency data
 * Returns connections where 'from' is the task being depended on
 * and 'to' is the task that depends on it
 */
export function buildConnections(
  tasks: { number: number; dependsOn: number[] }[],
): Connection[] {
  const taskNumbers = new Set(tasks.map((t) => t.number));
  const connections: Connection[] = [];

  for (const task of tasks) {
    // Filter to only intra-batch dependencies
    const intraBatchDeps = task.dependsOn.filter((depNum) =>
      taskNumbers.has(depNum),
    );

    for (const depNum of intraBatchDeps) {
      connections.push({
        from: depNum,
        to: task.number,
      });
    }
  }

  return connections;
}
