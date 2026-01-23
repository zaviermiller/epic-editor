/**
 * Batch Arrow Router for Epic-Level Visualization
 *
 * Generates clean SVG paths for dependency arrows between batches.
 */

import {
  BatchLayout,
  BatchLayoutConfig,
  DEFAULT_BATCH_LAYOUT_CONFIG,
} from "./batchLayoutEngine";

/**
 * A connection between two batches
 */
export interface BatchConnection {
  from: number;
  to: number;
}

/**
 * Generated arrow path with metadata
 */
export interface BatchArrowPath {
  from: number;
  to: number;
  path: string;
  pathType: "horizontal" | "vertical" | "complex";
}

/**
 * Connection point on a batch container
 */
interface ConnectionPoint {
  x: number;
  y: number;
}

/**
 * Get the right edge center point for a batch (source of arrow)
 */
function getRightEdge(layout: BatchLayout): ConnectionPoint {
  return {
    x: layout.x + layout.width,
    y: layout.y + layout.height / 2,
  };
}

/**
 * Get the left edge center point for a batch (target of arrow)
 */
function getLeftEdge(layout: BatchLayout): ConnectionPoint {
  return {
    x: layout.x,
    y: layout.y + layout.height / 2,
  };
}

/**
 * Get the bottom edge center point for a batch
 */
function getBottomEdge(layout: BatchLayout): ConnectionPoint {
  return {
    x: layout.x + layout.width / 2,
    y: layout.y + layout.height,
  };
}

/**
 * Get the top edge center point for a batch
 */
function getTopEdge(layout: BatchLayout): ConnectionPoint {
  return {
    x: layout.x + layout.width / 2,
    y: layout.y,
  };
}

/**
 * Generate a horizontal path with 90-degree bends
 * Arrow goes: right from source → vertical segment → right to target
 */
function generateHorizontalPath(
  from: ConnectionPoint,
  to: ConnectionPoint,
): string {
  // If the Y coordinates are the same (or very close), use a straight line
  if (Math.abs(from.y - to.y) < 2) {
    return `M ${from.x} ${from.y} L ${to.x} ${to.y}`;
  }

  // Calculate the midpoint X for the vertical segment
  const midX = from.x + (to.x - from.x) / 2;

  // Create a path with 90-degree bends:
  // 1. Horizontal from source to midpoint X
  // 2. Vertical from source Y to target Y
  // 3. Horizontal from midpoint X to target
  return `M ${from.x} ${from.y} L ${midX} ${from.y} L ${midX} ${to.y} L ${to.x} ${to.y}`;
}

/**
 * Generate a vertical path with 90-degree bends
 */
function generateVerticalPath(
  from: ConnectionPoint,
  to: ConnectionPoint,
): string {
  // If the X coordinates are the same (or very close), use a straight line
  if (Math.abs(from.x - to.x) < 2) {
    return `M ${from.x} ${from.y} L ${to.x} ${to.y}`;
  }

  // Calculate the midpoint Y for the horizontal segment
  const midY = from.y + (to.y - from.y) / 2;

  // Create a path with 90-degree bends:
  // 1. Vertical from source to midpoint Y
  // 2. Horizontal from source X to target X
  // 3. Vertical from midpoint Y to target
  return `M ${from.x} ${from.y} L ${from.x} ${midY} L ${to.x} ${midY} L ${to.x} ${to.y}`;
}

/**
 * Generate a complex path for backwards or diagonal connections
 */
function generateComplexPath(
  fromLayout: BatchLayout,
  toLayout: BatchLayout,
  config: BatchLayoutConfig,
): string {
  const from = getRightEdge(fromLayout);
  const to = getLeftEdge(toLayout);

  // If target is to the left of source, route around
  if (to.x <= from.x) {
    const routeOffset = config.horizontalGap / 2;
    const goDown = fromLayout.row <= toLayout.row;
    const verticalOffset =
      Math.max(fromLayout.height, toLayout.height) / 2 + config.verticalGap / 2;

    const midY = goDown
      ? Math.max(from.y, to.y) + verticalOffset
      : Math.min(from.y, to.y) - verticalOffset;

    // 90-degree path that goes around (for backwards connections)
    // 1. Horizontal right from source
    // 2. Vertical to midY
    // 3. Horizontal left to before target
    // 4. Vertical to target Y
    // 5. Horizontal left to target
    return `M ${from.x} ${from.y} L ${from.x + routeOffset} ${from.y} L ${from.x + routeOffset} ${midY} L ${to.x - routeOffset} ${midY} L ${to.x - routeOffset} ${to.y} L ${to.x} ${to.y}`;
  }

  // Diagonal: use 90-degree bends (same as horizontal path logic)
  const midX = (from.x + to.x) / 2;
  return `M ${from.x} ${from.y} L ${midX} ${from.y} L ${midX} ${to.y} L ${to.x} ${to.y}`;
}

/**
 * Generate arrow paths for all batch connections
 */
export function generateBatchArrowPaths(
  connections: BatchConnection[],
  batchLayouts: Map<number, BatchLayout>,
  config: BatchLayoutConfig = DEFAULT_BATCH_LAYOUT_CONFIG,
): BatchArrowPath[] {
  const paths: BatchArrowPath[] = [];

  for (const connection of connections) {
    const fromLayout = batchLayouts.get(connection.from);
    const toLayout = batchLayouts.get(connection.to);

    if (!fromLayout || !toLayout) {
      continue;
    }

    let path: string;
    let pathType: BatchArrowPath["pathType"];

    const isHorizontal = fromLayout.col < toLayout.col;
    const isVertical = fromLayout.col === toLayout.col;
    const isBackwards = fromLayout.col > toLayout.col;

    if (isHorizontal) {
      const from = getRightEdge(fromLayout);
      const to = getLeftEdge(toLayout);
      path = generateHorizontalPath(from, to);
      pathType = "horizontal";
    } else if (isVertical) {
      if (fromLayout.row < toLayout.row) {
        const from = getBottomEdge(fromLayout);
        const to = getTopEdge(toLayout);
        path = generateVerticalPath(from, to);
      } else {
        const from = getTopEdge(fromLayout);
        const to = getBottomEdge(toLayout);
        path = generateVerticalPath(from, to);
      }
      pathType = "vertical";
    } else if (isBackwards) {
      path = generateComplexPath(fromLayout, toLayout, config);
      pathType = "complex";
    } else {
      const from = getRightEdge(fromLayout);
      const to = getLeftEdge(toLayout);
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
