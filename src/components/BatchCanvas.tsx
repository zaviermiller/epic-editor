/**
 * BatchCanvas Component
 *
 * A hybrid HTML/SVG rendering component for displaying tasks with dependency arrows.
 * Uses CSS Grid for task layout and SVG overlay for arrows.
 * Tasks expand to fit their content.
 */

"use client";

import { useMemo, useRef, useState, useEffect, useCallback } from "react";
import { Task } from "@/types";
import { TaskCard } from "./TaskCard";
import {
  calculateLayout,
  DEFAULT_LAYOUT_CONFIG,
  LayoutConfig,
} from "@/lib/layoutEngine";
import { buildConnections } from "@/lib/arrowRouter";

interface BatchCanvasProps {
  /** Tasks to display */
  tasks: Task[];
  /** Unique ID for this batch (used for SVG marker IDs) */
  batchId: number;
  /** Task number that is currently highlighted */
  highlightedTask?: number | null;
  /** Callback when a task is hovered */
  onTaskHover?: (taskNumber: number | null) => void;
  /** Callback when a task is clicked */
  onTaskClick?: (task: Task) => void;
  /** Optional layout configuration override */
  config?: LayoutConfig;
}

/**
 * Default arrow colors
 */
const ARROW_COLORS = {
  default: "rgba(148, 163, 184, 0.6)",
  highlighted: "hsl(217, 91%, 60%)",
};

interface ArrowPath {
  from: number;
  to: number;
  path: string;
}

export function BatchCanvas({
  tasks,
  batchId,
  highlightedTask,
  onTaskHover,
  onTaskClick,
  config = DEFAULT_LAYOUT_CONFIG,
}: BatchCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const taskRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const [arrowPaths, setArrowPaths] = useState<ArrowPath[]>([]);

  // Calculate layout positions for all tasks
  const layout = useMemo(() => calculateLayout(tasks, config), [tasks, config]);

  // Create a map for quick task lookup by number
  const taskMap = useMemo(
    () => new Map(tasks.map((t) => [t.number, t])),
    [tasks],
  );

  // Build connections from task dependencies
  const connections = useMemo(() => buildConnections(tasks), [tasks]);

  // Create position lookup for grid placement
  const positionMap = useMemo(() => {
    const map = new Map<number, { col: number; row: number }>();
    for (const taskLayout of layout.tasks) {
      map.set(taskLayout.taskNumber, {
        col: taskLayout.col,
        row: taskLayout.row,
      });
    }
    return map;
  }, [layout.tasks]);

  // Get related tasks for highlighting
  const relatedTasks = useMemo(() => {
    if (!highlightedTask) return new Set<number>();

    const related = new Set<number>();
    const task = taskMap.get(highlightedTask);
    if (task) {
      task.dependsOn.forEach((depNum) => {
        if (taskMap.has(depNum)) related.add(depNum);
      });
    }

    for (const t of tasks) {
      if (t.dependsOn.includes(highlightedTask) && taskMap.has(t.number)) {
        related.add(t.number);
      }
    }

    return related;
  }, [highlightedTask, tasks, taskMap]);

  // Calculate arrow paths based on actual DOM positions
  const calculateArrows = useCallback(() => {
    if (!containerRef.current || connections.length === 0) {
      setArrowPaths([]);
      return;
    }

    const containerRect = containerRef.current.getBoundingClientRect();
    const newPaths: ArrowPath[] = [];

    for (const conn of connections) {
      const fromEl = taskRefs.current.get(conn.from);
      const toEl = taskRefs.current.get(conn.to);

      if (!fromEl || !toEl) continue;

      const fromRect = fromEl.getBoundingClientRect();
      const toRect = toEl.getBoundingClientRect();

      const fromPos = positionMap.get(conn.from);
      const toPos = positionMap.get(conn.to);

      // Calculate connection points
      let fromX: number, fromY: number, toX: number, toY: number;

      const isHorizontal = fromPos && toPos && fromPos.col < toPos.col;

      if (isHorizontal) {
        // Right edge to left edge
        fromX = fromRect.right - containerRect.left;
        fromY = fromRect.top + fromRect.height / 2 - containerRect.top;
        toX = toRect.left - containerRect.left;
        toY = toRect.top + toRect.height / 2 - containerRect.top;
      } else {
        // Default: right to left
        fromX = fromRect.right - containerRect.left;
        fromY = fromRect.top + fromRect.height / 2 - containerRect.top;
        toX = toRect.left - containerRect.left;
        toY = toRect.top + toRect.height / 2 - containerRect.top;
      }

      // Generate bezier path
      const dx = toX - fromX;
      const controlOffset = Math.max(Math.abs(dx) * 0.4, 20);
      const path = `M ${fromX} ${fromY} C ${fromX + controlOffset} ${fromY}, ${toX - controlOffset} ${toY}, ${toX} ${toY}`;

      newPaths.push({ from: conn.from, to: conn.to, path });
    }

    setArrowPaths(newPaths);
  }, [connections, positionMap]);

  // Recalculate arrows on mount and when dependencies change
  useEffect(() => {
    const timeoutId = setTimeout(calculateArrows, 50);
    return () => clearTimeout(timeoutId);
  }, [calculateArrows, tasks]);

  // Recalculate on window resize
  useEffect(() => {
    window.addEventListener("resize", calculateArrows);
    return () => window.removeEventListener("resize", calculateArrows);
  }, [calculateArrows]);

  // Empty state
  if (tasks.length === 0) {
    return (
      <div className="text-xs text-muted-foreground text-center py-4">
        No tasks
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative"
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${layout.gridWidth}, ${config.cellWidth}px)`,
        gap: `${config.verticalGap}px ${config.horizontalGap}px`,
        padding: config.padding,
      }}
    >
      {/* SVG overlay for arrows */}
      <svg
        className="absolute inset-0 pointer-events-none"
        style={{ width: "100%", height: "100%", overflow: "visible" }}
      >
        <defs>
          <marker
            id={`arrowhead-${batchId}`}
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
              stroke={ARROW_COLORS.default}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </marker>
          <marker
            id={`arrowhead-highlight-${batchId}`}
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
              stroke={ARROW_COLORS.highlighted}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </marker>
        </defs>
        <g>
          {arrowPaths.map((arrow) => {
            const isHighlighted =
              highlightedTask === arrow.from || highlightedTask === arrow.to;

            return (
              <path
                key={`${arrow.from}-${arrow.to}`}
                d={arrow.path}
                fill="none"
                stroke={
                  isHighlighted
                    ? ARROW_COLORS.highlighted
                    : ARROW_COLORS.default
                }
                strokeWidth={isHighlighted ? 2 : 1.5}
                markerEnd={`url(#${isHighlighted ? `arrowhead-highlight-${batchId}` : `arrowhead-${batchId}`})`}
                className="transition-all duration-150"
              />
            );
          })}
        </g>
      </svg>

      {/* Task cards in grid layout */}
      {layout.tasks.map((taskLayout) => {
        const task = taskMap.get(taskLayout.taskNumber);
        if (!task) return null;

        const isHighlighted = highlightedTask === task.number;
        const isRelated = relatedTasks.has(task.number);

        return (
          <div
            key={task.number}
            ref={(el) => {
              if (el) {
                taskRefs.current.set(task.number, el);
              } else {
                taskRefs.current.delete(task.number);
              }
            }}
            style={{
              gridColumn: taskLayout.col + 1,
              gridRow: taskLayout.row + 1,
            }}
          >
            <TaskCard
              task={task}
              isHighlighted={isHighlighted}
              isRelated={isRelated}
              onHover={onTaskHover}
              onClick={onTaskClick}
            />
          </div>
        );
      })}
    </div>
  );
}
