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
 * Prefers vertical connections (top/bottom) for intra-batch tasks
 * For inter-batch tasks, only uses left/right to avoid obscuring batch headers
 */
function choosePorts(
  fromTask: PositionedTask,
  toTask: PositionedTask,
  isInterBatch: boolean,
): { from: Point; to: Point; forceHorizontalRoute?: boolean } {
  const fromPorts = getTaskPorts(fromTask);
  const toPorts = getTaskPorts(toTask);

  const fromCenter = getTaskCenter(fromTask);
  const toCenter = getTaskCenter(toTask);

  const dx = toCenter.x - fromCenter.x;
  const dy = toCenter.y - fromCenter.y;

  // For inter-batch connections, only use left/right ports
  // to avoid edges crossing over batch headers (top) or footers (bottom)
  if (isInterBatch) {
    // Only force horizontal routing when tasks are primarily vertically aligned
    // (i.e., small horizontal offset but large vertical offset)
    // This prevents edges from going through batch headers
    const needsForcedRoute = Math.abs(dy) > Math.abs(dx) * 2;

    // When forced routing is needed (vertically stacked batches),
    // choose ports based on horizontal direction:
    // - If target is to the right: exit right, enter left
    // - If target is to the left: exit left, enter right
    // - If roughly same x: both use left (original behavior)
    if (needsForcedRoute) {
      if (dx > 50) {
        // Target is significantly to the right - exit right, enter left
        return {
          from: fromPorts.right,
          to: toPorts.left,
          forceHorizontalRoute: true,
        };
      } else if (dx < -50) {
        // Target is significantly to the left - exit left, enter right
        return {
          from: fromPorts.left,
          to: toPorts.right,
          forceHorizontalRoute: true,
        };
      } else {
        // Tasks are roughly vertically aligned - use left sides
        return {
          from: fromPorts.left,
          to: toPorts.left,
          forceHorizontalRoute: true,
        };
      }
    }

    // For regular inter-batch connections with enough horizontal offset,
    // choose the side that makes the most sense based on relative position
    if (dx >= 0) {
      // Target is to the right
      return {
        from: fromPorts.right,
        to: toPorts.left,
        forceHorizontalRoute: false,
      };
    } else {
      // Target is to the left
      return {
        from: fromPorts.left,
        to: toPorts.right,
        forceHorizontalRoute: false,
      };
    }
  }

  // For intra-batch connections, prefer vertical connections for down-flowing layouts
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
 * When forceHorizontalRoute is true, ensures the path goes around horizontally
 * even if the target is primarily vertical (for inter-batch connections)
 */
function createOrthogonalPath(
  from: Point,
  to: Point,
  fromPort: "top" | "right" | "bottom" | "left",
  toPort: "top" | "right" | "bottom" | "left",
  spacing: number = 20,
  forceHorizontalRoute: boolean = false,
): Point[] {
  const points: Point[] = [from];

  // For inter-batch connections using horizontal ports, ensure the path
  // goes around horizontally even if the target is primarily vertical
  if (forceHorizontalRoute && (fromPort === "right" || fromPort === "left")) {
    const horizontalOffset = spacing + 40; // Go out horizontally first

    if (fromPort === "right" && toPort === "left") {
      // Right to left: go right from source, then down/up, then to target's left
      // The vertical segment should be positioned appropriately between source right and target left
      // Use a point that's either just past the source (for close tasks) or just before the target
      const turnX = Math.max(
        from.x + horizontalOffset,
        to.x - horizontalOffset,
      );
      points.push({ x: turnX, y: from.y }); // First go right from source
      points.push({ x: turnX, y: to.y }); // Then go to target's Y level
    } else if (fromPort === "left" && toPort === "right") {
      // Left to right: go left from source, then down/up, then to target's right
      // The vertical segment should be positioned appropriately between source left and target right
      const turnX = Math.min(
        from.x - horizontalOffset,
        to.x + horizontalOffset,
      );
      points.push({ x: turnX, y: from.y }); // First go left from source
      points.push({ x: turnX, y: to.y }); // Then go to target's Y level
    } else if (fromPort === "right" && toPort === "right") {
      // Both on right: go right from source, down/up, then back to target's right
      const outX = Math.max(from.x, to.x) + horizontalOffset;
      points.push({ x: outX, y: from.y });
      points.push({ x: outX, y: to.y });
    } else if (fromPort === "left" && toPort === "left") {
      // Both on left: go left from source, down/up, then to target's left
      const outX = Math.min(from.x, to.x) - horizontalOffset;
      points.push({ x: outX, y: from.y });
      points.push({ x: outX, y: to.y });
    }

    points.push(to);
    return points;
  }

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

    const { from, to, forceHorizontalRoute } = choosePorts(
      fromTask,
      toTask,
      edge.isInterBatch,
    );

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
      forceHorizontalRoute,
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
