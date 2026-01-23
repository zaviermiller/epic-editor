/**
 * DependencyCanvas Component
 *
 * SVG overlay that draws dependency arrows between tasks and batches.
 * Uses curved bezier paths for smooth connections.
 * This component should be placed INSIDE the pannable/zoomable canvas.
 */

"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { Dependency } from "@/types";

interface DependencyCanvasProps {
  /** Dependencies to draw */
  dependencies: Dependency[];
  /** Task/batch number that is highlighted */
  highlightedTask?: number | null;
  /** Container ref to find elements in */
  containerRef: React.RefObject<HTMLDivElement | null>;
}

interface Point {
  x: number;
  y: number;
}

interface Arrow {
  from: Point;
  to: Point;
  isHighlighted: boolean;
}

/**
 * Get the position of an element relative to its offset parent
 */
function getElementPosition(
  element: HTMLElement,
): { x: number; y: number; width: number; height: number } | null {
  // Walk up to find the positioned ancestor (the canvas)
  let offsetX = element.offsetLeft;
  let offsetY = element.offsetTop;
  let current = element.offsetParent as HTMLElement | null;

  while (current && !current.hasAttribute("data-canvas")) {
    offsetX += current.offsetLeft;
    offsetY += current.offsetTop;
    current = current.offsetParent as HTMLElement | null;
  }

  return {
    x: offsetX,
    y: offsetY,
    width: element.offsetWidth,
    height: element.offsetHeight,
  };
}

/**
 * Calculate connection points between two elements
 */
function getConnectionPoints(
  fromPos: { x: number; y: number; width: number; height: number },
  toPos: { x: number; y: number; width: number; height: number },
): { from: Point; to: Point } {
  const fromCenter = {
    x: fromPos.x + fromPos.width / 2,
    y: fromPos.y + fromPos.height / 2,
  };
  const toCenter = {
    x: toPos.x + toPos.width / 2,
    y: toPos.y + toPos.height / 2,
  };

  const dx = toCenter.x - fromCenter.x;
  const dy = toCenter.y - fromCenter.y;

  let from: Point;
  let to: Point;

  if (Math.abs(dx) > Math.abs(dy)) {
    // Horizontal connection
    if (dx > 0) {
      from = {
        x: fromPos.x + fromPos.width,
        y: fromPos.y + fromPos.height / 2,
      };
      to = { x: toPos.x, y: toPos.y + toPos.height / 2 };
    } else {
      from = { x: fromPos.x, y: fromPos.y + fromPos.height / 2 };
      to = { x: toPos.x + toPos.width, y: toPos.y + toPos.height / 2 };
    }
  } else {
    // Vertical connection
    if (dy > 0) {
      from = {
        x: fromPos.x + fromPos.width / 2,
        y: fromPos.y + fromPos.height,
      };
      to = { x: toPos.x + toPos.width / 2, y: toPos.y };
    } else {
      from = { x: fromPos.x + fromPos.width / 2, y: fromPos.y };
      to = { x: toPos.x + toPos.width / 2, y: toPos.y + toPos.height };
    }
  }

  return { from, to };
}

/**
 * Generate a curved path between two points
 */
function generateCurvedPath(from: Point, to: Point): string {
  const dx = to.x - from.x;
  const dy = to.y - from.y;

  if (Math.abs(dx) > Math.abs(dy)) {
    // Horizontal curve
    const cpOffset = Math.abs(dx) * 0.4;
    return `M ${from.x} ${from.y} C ${from.x + cpOffset} ${from.y}, ${to.x - cpOffset} ${to.y}, ${to.x} ${to.y}`;
  } else {
    // Vertical curve
    const cpOffset = Math.abs(dy) * 0.4;
    return `M ${from.x} ${from.y} C ${from.x} ${from.y + cpOffset}, ${to.x} ${to.y - cpOffset}, ${to.x} ${to.y}`;
  }
}

export function DependencyCanvas({
  dependencies,
  highlightedTask,
  containerRef,
}: DependencyCanvasProps) {
  const [arrows, setArrows] = useState<Arrow[]>([]);
  const updateCountRef = useRef(0);

  /**
   * Calculate arrow positions
   */
  const calculateArrows = useCallback(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const newArrows: Arrow[] = [];

    for (const dep of dependencies) {
      // Find elements by data attributes
      const fromElement = container.querySelector(
        `[data-task-id="${dep.from}"], [data-batch-id="${dep.from}"]`,
      ) as HTMLElement | null;
      const toElement = container.querySelector(
        `[data-task-id="${dep.to}"], [data-batch-id="${dep.to}"]`,
      ) as HTMLElement | null;

      if (!fromElement || !toElement) continue;

      const fromPos = getElementPosition(fromElement);
      const toPos = getElementPosition(toElement);

      if (!fromPos || !toPos) continue;

      const points = getConnectionPoints(fromPos, toPos);
      const isHighlighted =
        highlightedTask === dep.from || highlightedTask === dep.to;

      newArrows.push({
        from: points.from,
        to: points.to,
        isHighlighted,
      });
    }

    setArrows(newArrows);
  }, [dependencies, highlightedTask, containerRef]);

  // Calculate arrows on mount and when dependencies change
  useEffect(() => {
    // Wait for layout to complete
    const timeoutId = setTimeout(calculateArrows, 150);

    // Recalculate on resize
    const resizeObserver = new ResizeObserver(() => {
      requestAnimationFrame(calculateArrows);
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      clearTimeout(timeoutId);
      resizeObserver.disconnect();
    };
  }, [calculateArrows, containerRef]);

  // Recalculate when highlighted task changes
  useEffect(() => {
    updateCountRef.current += 1;
    const timeoutId = setTimeout(calculateArrows, 0);
    return () => clearTimeout(timeoutId);
  }, [highlightedTask, calculateArrows]);

  return (
    <svg
      className="absolute inset-0 pointer-events-none"
      style={{ width: "100%", height: "100%", overflow: "visible" }}
    >
      <defs>
        <marker
          id="arrow-normal"
          markerWidth="10"
          markerHeight="8"
          refX="9"
          refY="4"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <polygon points="0 0, 10 4, 0 8" fill="rgba(148, 163, 184, 0.7)" />
        </marker>
        <marker
          id="arrow-highlight"
          markerWidth="10"
          markerHeight="8"
          refX="9"
          refY="4"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <polygon points="0 0, 10 4, 0 8" fill="hsl(217, 91%, 60%)" />
        </marker>
      </defs>
      <g>
        {arrows.map((arrow, index) => (
          <path
            key={index}
            d={generateCurvedPath(arrow.from, arrow.to)}
            fill="none"
            stroke={
              arrow.isHighlighted
                ? "hsl(217, 91%, 60%)"
                : "rgba(148, 163, 184, 0.5)"
            }
            strokeWidth={arrow.isHighlighted ? 2.5 : 2}
            markerEnd={
              arrow.isHighlighted
                ? "url(#arrow-highlight)"
                : "url(#arrow-normal)"
            }
            style={{
              transition: "stroke 0.15s, stroke-width 0.15s",
            }}
          />
        ))}
      </g>
    </svg>
  );
}
