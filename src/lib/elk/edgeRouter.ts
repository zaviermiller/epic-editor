/**
 * Edge Router
 *
 * Routes edges between tasks using orthogonal paths.
 * Handles both intra-batch and inter-batch edges.
 */

import {
  PositionedTask,
  PositionedBatch,
  LayoutEdge,
  RoutedEdge,
  ElkLayoutConfig,
  DEFAULT_ELK_CONFIG,
} from "./types";

interface Point {
  x: number;
  y: number;
}

/**
 * Get the center point of a task
 */
function getTaskCenter(task: PositionedTask): Point {
  return {
    x: task.x + task.width / 2,
    y: task.y + task.height / 2,
  };
}

/**
 * Get connection points for a task (top, right, bottom, left)
 */
function getTaskPorts(task: PositionedTask): {
  top: Point;
  right: Point;
  bottom: Point;
  left: Point;
} {
  return {
    top: { x: task.x + task.width / 2, y: task.y },
    right: { x: task.x + task.width, y: task.y + task.height / 2 },
    bottom: { x: task.x + task.width / 2, y: task.y + task.height },
    left: { x: task.x, y: task.y + task.height / 2 },
  };
}

/**
 * Choose best ports for connecting two tasks
 * Prefers vertical connections (top/bottom) for down-flowing layouts
 */
function choosePorts(
  fromTask: PositionedTask,
  toTask: PositionedTask,
  _isInterBatch: boolean,
): { from: Point; to: Point } {
  const fromPorts = getTaskPorts(fromTask);
  const toPorts = getTaskPorts(toTask);

  // For vertical flow, prefer bottom -> top connections
  const fromCenter = getTaskCenter(fromTask);
  const toCenter = getTaskCenter(toTask);

  const dx = toCenter.x - fromCenter.x;
  const dy = toCenter.y - fromCenter.y;

  // Determine primary direction
  if (Math.abs(dy) > Math.abs(dx)) {
    // Primarily vertical
    if (dy > 0) {
      // Target is below
      return { from: fromPorts.bottom, to: toPorts.top };
    } else {
      // Target is above
      return { from: fromPorts.top, to: toPorts.bottom };
    }
  } else {
    // Primarily horizontal
    if (dx > 0) {
      // Target is to the right
      return { from: fromPorts.right, to: toPorts.left };
    } else {
      // Target is to the left
      return { from: fromPorts.left, to: toPorts.right };
    }
  }
}

/**
 * Create an orthogonal path between two points
 * Uses a simple dogleg routing with one bend point
 */
function createOrthogonalPath(
  from: Point,
  to: Point,
  fromPort: "top" | "right" | "bottom" | "left",
  toPort: "top" | "right" | "bottom" | "left",
  _spacing: number = 20,
): Point[] {
  const points: Point[] = [from];

  // Determine the mid-points based on port directions
  if (fromPort === "bottom" && toPort === "top") {
    // Vertical down connection
    const midY = from.y + (to.y - from.y) / 2;
    if (Math.abs(from.x - to.x) > 1) {
      points.push({ x: from.x, y: midY });
      points.push({ x: to.x, y: midY });
    }
  } else if (fromPort === "top" && toPort === "bottom") {
    // Vertical up connection
    const midY = from.y + (to.y - from.y) / 2;
    if (Math.abs(from.x - to.x) > 1) {
      points.push({ x: from.x, y: midY });
      points.push({ x: to.x, y: midY });
    }
  } else if (fromPort === "right" && toPort === "left") {
    // Horizontal right connection
    const midX = from.x + (to.x - from.x) / 2;
    if (Math.abs(from.y - to.y) > 1) {
      points.push({ x: midX, y: from.y });
      points.push({ x: midX, y: to.y });
    }
  } else if (fromPort === "left" && toPort === "right") {
    // Horizontal left connection
    const midX = from.x + (to.x - from.x) / 2;
    if (Math.abs(from.y - to.y) > 1) {
      points.push({ x: midX, y: from.y });
      points.push({ x: midX, y: to.y });
    }
  } else {
    // Mixed connections - use two bends
    if (
      (fromPort === "bottom" || fromPort === "top") &&
      (toPort === "left" || toPort === "right")
    ) {
      // Vertical exit, horizontal entry
      points.push({ x: from.x, y: to.y });
    } else if (
      (fromPort === "left" || fromPort === "right") &&
      (toPort === "top" || toPort === "bottom")
    ) {
      // Horizontal exit, vertical entry
      points.push({ x: to.x, y: from.y });
    }
  }

  points.push(to);
  return points;
}

/**
 * Convert points to SVG path string
 */
function pointsToPath(points: Point[]): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

  let path = `M ${points[0].x} ${points[0].y}`;

  for (let i = 1; i < points.length; i++) {
    path += ` L ${points[i].x} ${points[i].y}`;
  }

  return path;
}

/**
 * Create a smooth curved path using quadratic bezier curves
 */
function pointsToSmoothPath(points: Point[], cornerRadius: number = 8): string {
  if (points.length < 2) return pointsToPath(points);
  if (points.length === 2) {
    return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
  }

  let path = `M ${points[0].x} ${points[0].y}`;

  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const next = points[i + 1];

    // Calculate distances
    const d1 = Math.sqrt(
      Math.pow(curr.x - prev.x, 2) + Math.pow(curr.y - prev.y, 2),
    );
    const d2 = Math.sqrt(
      Math.pow(next.x - curr.x, 2) + Math.pow(next.y - curr.y, 2),
    );

    // Limit corner radius to half the shortest segment
    const r = Math.min(cornerRadius, d1 / 2, d2 / 2);

    // Calculate approach point
    const t1 = r / d1;
    const approachX = curr.x - (curr.x - prev.x) * t1;
    const approachY = curr.y - (curr.y - prev.y) * t1;

    // Calculate departure point
    const t2 = r / d2;
    const departX = curr.x + (next.x - curr.x) * t2;
    const departY = curr.y + (next.y - curr.y) * t2;

    // Draw line to approach point, then curve to departure point
    path += ` L ${approachX} ${approachY}`;
    path += ` Q ${curr.x} ${curr.y} ${departX} ${departY}`;
  }

  // Draw to final point
  const last = points[points.length - 1];
  path += ` L ${last.x} ${last.y}`;

  return path;
}

/**
 * Get connection points for a batch (top, right, bottom, left)
 */
function getBatchPorts(batch: PositionedBatch): {
  top: Point;
  right: Point;
  bottom: Point;
  left: Point;
} {
  return {
    top: { x: batch.x + batch.width / 2, y: batch.y },
    right: { x: batch.x + batch.width, y: batch.y + batch.height / 2 },
    bottom: { x: batch.x + batch.width / 2, y: batch.y + batch.height },
    left: { x: batch.x, y: batch.y + batch.height / 2 },
  };
}

/**
 * Get the center point of a batch
 */
function getBatchCenter(batch: PositionedBatch): Point {
  return {
    x: batch.x + batch.width / 2,
    y: batch.y + batch.height / 2,
  };
}

/**
 * Choose best ports for connecting two batches
 * For upward connections where target is also significantly to the right/left
 * (suggesting the edge would cross over intermediate batches),
 * prefer going horizontal first to avoid passing over intermediate batches.
 */
function chooseBatchPorts(
  fromBatch: PositionedBatch,
  toBatch: PositionedBatch,
): {
  from: Point;
  to: Point;
  fromPort: "top" | "right" | "bottom" | "left";
  toPort: "top" | "right" | "bottom" | "left";
} {
  const fromPorts = getBatchPorts(fromBatch);
  const toPorts = getBatchPorts(toBatch);
  const fromCenter = getBatchCenter(fromBatch);
  const toCenter = getBatchCenter(toBatch);

  const dx = toCenter.x - fromCenter.x;
  const dy = toCenter.y - fromCenter.y;

  // Calculate horizontal gap between batches (not just center distance)
  // This helps determine if batches are in different "columns"
  const horizontalGap =
    dx > 0
      ? toBatch.x - (fromBatch.x + fromBatch.width) // gap when target is to the right
      : fromBatch.x - (toBatch.x + toBatch.width); // gap when target is to the left

  // Special case: target is above AND there's significant horizontal separation
  // Only apply when there's actually a gap between batches (they're in different columns)
  // and the vertical distance suggests the edge would pass through other content
  if (dy < 0 && horizontalGap > 100 && Math.abs(dy) > 100) {
    // Target is above and in a different column - go horizontal first, then up
    if (dx > 0) {
      return {
        from: fromPorts.right,
        to: toPorts.bottom,
        fromPort: "right",
        toPort: "bottom",
      };
    } else {
      return {
        from: fromPorts.left,
        to: toPorts.bottom,
        fromPort: "left",
        toPort: "bottom",
      };
    }
  }

  // Default: determine primary direction based on relative positions
  if (Math.abs(dy) > Math.abs(dx)) {
    if (dy > 0) {
      return {
        from: fromPorts.bottom,
        to: toPorts.top,
        fromPort: "bottom",
        toPort: "top",
      };
    } else {
      return {
        from: fromPorts.top,
        to: toPorts.bottom,
        fromPort: "top",
        toPort: "bottom",
      };
    }
  } else {
    if (dx > 0) {
      return {
        from: fromPorts.right,
        to: toPorts.left,
        fromPort: "right",
        toPort: "left",
      };
    } else {
      return {
        from: fromPorts.left,
        to: toPorts.right,
        fromPort: "left",
        toPort: "right",
      };
    }
  }
}

/**
 * Route all edges
 */
export function routeEdges(
  edges: LayoutEdge[],
  tasks: PositionedTask[],
  batches: PositionedBatch[],
  config: ElkLayoutConfig = DEFAULT_ELK_CONFIG,
): RoutedEdge[] {
  const taskMap = new Map(tasks.map((t) => [t.taskNumber, t]));
  const batchMap = new Map(batches.map((b) => [b.batchNumber, b]));

  return edges.map((edge) => {
    // Handle batch-to-batch edges
    if (edge.isBatchEdge) {
      const fromBatch = batchMap.get(edge.from);
      const toBatch = batchMap.get(edge.to);

      if (!fromBatch || !toBatch) {
        return {
          ...edge,
          path: "",
          points: [],
        };
      }

      const { from, to, fromPort, toPort } = chooseBatchPorts(
        fromBatch,
        toBatch,
      );

      const points = createOrthogonalPath(
        from,
        to,
        fromPort,
        toPort,
        config.groupSpacing,
      );

      const path = pointsToSmoothPath(points, 10);

      return {
        ...edge,
        path,
        points,
      };
    }

    // Handle task-to-task edges
    const fromTask = taskMap.get(edge.from);
    const toTask = taskMap.get(edge.to);

    if (!fromTask || !toTask) {
      return {
        ...edge,
        path: "",
        points: [],
      };
    }

    const { from, to } = choosePorts(fromTask, toTask, edge.isInterBatch);

    // Determine port directions
    const fromPorts = getTaskPorts(fromTask);
    const toPorts = getTaskPorts(toTask);

    let fromPort: "top" | "right" | "bottom" | "left" = "bottom";
    let toPort: "top" | "right" | "bottom" | "left" = "top";

    if (from.x === fromPorts.top.x && from.y === fromPorts.top.y)
      fromPort = "top";
    if (from.x === fromPorts.right.x && from.y === fromPorts.right.y)
      fromPort = "right";
    if (from.x === fromPorts.bottom.x && from.y === fromPorts.bottom.y)
      fromPort = "bottom";
    if (from.x === fromPorts.left.x && from.y === fromPorts.left.y)
      fromPort = "left";

    if (to.x === toPorts.top.x && to.y === toPorts.top.y) toPort = "top";
    if (to.x === toPorts.right.x && to.y === toPorts.right.y) toPort = "right";
    if (to.x === toPorts.bottom.x && to.y === toPorts.bottom.y)
      toPort = "bottom";
    if (to.x === toPorts.left.x && to.y === toPorts.left.y) toPort = "left";

    const points = createOrthogonalPath(
      from,
      to,
      fromPort,
      toPort,
      config.nodeSpacing,
    );

    // Use smooth path for better aesthetics
    const path = pointsToSmoothPath(points, 6);

    return {
      ...edge,
      path,
      points,
    };
  });
}

/**
 * Get arrow marker definition for SVG
 */
export function getArrowMarkerDef(
  id: string = "arrowhead",
  color: string = "currentColor",
): string {
  return `
    <marker
      id="${id}"
      markerWidth="12"
      markerHeight="12"
      refX="10"
      refY="6"
      orient="auto"
      markerUnits="strokeWidth"
    >
      <polyline
        points="2 2, 10 6, 2 10"
        fill="none"
        stroke="${color}"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </marker>
  `;
}
