/**
 * EpicCanvas Component
 *
 * A canvas-based rendering component for displaying batches with dependency arrows.
 * Uses a virtual grid layout where batches are positioned based on their dependencies.
 */

"use client";

import { useMemo, useState, useRef, useCallback } from "react";
import { Epic, Task } from "@/types";
import { BatchContainer } from "./BatchContainer";
import {
  calculateBatchLayout,
  createBatchLayoutMap,
  buildBatchConnections,
  DEFAULT_BATCH_LAYOUT_CONFIG,
  BatchLayoutConfig,
} from "@/lib/batchLayoutEngine";
import { generateBatchArrowPaths } from "@/lib/batchArrowRouter";

interface EpicCanvasProps {
  /** Epic to display */
  epic: Epic;
  /** Task number that is currently highlighted */
  highlightedTask?: number | null;
  /** Callback when a task is hovered */
  onTaskHover?: (taskNumber: number | null) => void;
  /** Callback when a task is clicked */
  onTaskClick?: (task: Task) => void;
  /** Optional layout configuration override */
  config?: BatchLayoutConfig;
}

/**
 * Default arrow colors
 */
const ARROW_COLORS = {
  default: "rgba(148, 163, 184, 0.6)",
  highlighted: "hsl(217, 91%, 60%)",
};

export function EpicCanvas({
  epic,
  highlightedTask,
  onTaskHover,
  onTaskClick,
  config = DEFAULT_BATCH_LAYOUT_CONFIG,
}: EpicCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [batchHeights, setBatchHeights] = useState<Map<number, number>>(
    new Map(),
  );

  // Calculate layout positions for all batches
  const layout = useMemo(
    () => calculateBatchLayout(epic.batches, config),
    [epic.batches, config],
  );

  // Create a map for quick batch lookup by number
  const batchMap = useMemo(
    () => new Map(epic.batches.map((b) => [b.number, b])),
    [epic.batches],
  );

  // Create layout map for arrow routing
  const layoutMap = useMemo(
    () => createBatchLayoutMap(layout.batches),
    [layout.batches],
  );

  // Build connections from batch dependencies
  const connections = useMemo(
    () => buildBatchConnections(epic.batches),
    [epic.batches],
  );

  // Update layout map with measured heights
  const adjustedLayoutMap = useMemo(() => {
    if (batchHeights.size === 0) return layoutMap;

    const adjusted = new Map(layoutMap);

    // Group batches by row and recalculate positions
    const rowBatches = new Map<number, number[]>();
    for (const [batchNum, batchLayout] of adjusted) {
      if (!rowBatches.has(batchLayout.row)) {
        rowBatches.set(batchLayout.row, []);
      }
      rowBatches.get(batchLayout.row)!.push(batchNum);
    }

    // Calculate max height per row
    const rowMaxHeights = new Map<number, number>();
    for (const [row, batchNums] of rowBatches) {
      let maxHeight = config.minBatchHeight;
      for (const batchNum of batchNums) {
        const measuredHeight = batchHeights.get(batchNum);
        if (measuredHeight) {
          maxHeight = Math.max(maxHeight, measuredHeight);
        }
      }
      rowMaxHeights.set(row, maxHeight);
    }

    // Recalculate Y positions and heights
    let currentY = config.padding;
    const sortedRows = Array.from(rowMaxHeights.keys()).sort((a, b) => a - b);

    for (const row of sortedRows) {
      const rowHeight = rowMaxHeights.get(row) || config.minBatchHeight;
      const batchNums = rowBatches.get(row) || [];

      for (const batchNum of batchNums) {
        const existing = adjusted.get(batchNum);
        if (existing) {
          adjusted.set(batchNum, {
            ...existing,
            y: currentY,
            height: rowHeight,
          });
        }
      }

      currentY += rowHeight + config.verticalGap;
    }

    return adjusted;
  }, [layoutMap, batchHeights, config]);

  // Generate arrow paths with adjusted layout
  const arrows = useMemo(
    () => generateBatchArrowPaths(connections, adjustedLayoutMap, config),
    [connections, adjustedLayoutMap, config],
  );

  // Calculate adjusted canvas height
  const canvasHeight = useMemo(() => {
    if (batchHeights.size === 0) return layout.canvasHeight;

    let totalHeight = config.padding * 2;
    const rowHeights = new Map<number, number>();

    for (const batchLayout of layout.batches) {
      const measuredHeight =
        batchHeights.get(batchLayout.batchNumber) || config.minBatchHeight;
      const currentMax = rowHeights.get(batchLayout.row) || 0;
      rowHeights.set(batchLayout.row, Math.max(currentMax, measuredHeight));
    }

    const heights = Array.from(rowHeights.values());
    totalHeight += heights.reduce((a, b) => a + b, 0);
    totalHeight += Math.max(0, heights.length - 1) * config.verticalGap;

    return Math.max(totalHeight, layout.canvasHeight);
  }, [layout, batchHeights, config]);

  // Callback to measure batch heights
  const handleBatchRef = useCallback(
    (batchNumber: number, element: HTMLDivElement | null) => {
      if (element) {
        const height = element.getBoundingClientRect().height;
        setBatchHeights((prev) => {
          if (prev.get(batchNumber) !== height) {
            const next = new Map(prev);
            next.set(batchNumber, height);
            return next;
          }
          return prev;
        });
      }
    },
    [],
  );

  // Get related batches for highlighting (batches containing related tasks)
  const getRelatedBatches = useMemo(() => {
    if (!highlightedTask) return new Set<number>();

    const related = new Set<number>();

    // Find which batch contains the highlighted task
    for (const batch of epic.batches) {
      for (const task of batch.tasks) {
        if (task.number === highlightedTask) {
          // Add batches this batch depends on
          batch.dependsOn.forEach((depNum) => {
            if (batchMap.has(depNum)) related.add(depNum);
          });
        }
        // Add batch if it depends on the batch containing highlighted task
        if (task.dependsOn.includes(highlightedTask)) {
          related.add(batch.number);
        }
      }
    }

    return related;
  }, [highlightedTask, epic.batches, batchMap]);

  // Empty state
  if (epic.batches.length === 0) {
    return (
      <div className="text-muted-foreground text-center py-8">
        <p className="text-lg font-medium mb-2">No batches found</p>
        <p className="text-sm">
          This Epic doesn&apos;t have any sub-issues configured as batches.
        </p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative"
      style={{
        width: layout.canvasWidth,
        height: canvasHeight,
        minWidth: layout.canvasWidth,
        minHeight: canvasHeight,
      }}
    >
      {/* SVG layer for arrows (behind batches) */}
      <svg
        className="absolute inset-0 pointer-events-none"
        style={{
          width: layout.canvasWidth,
          height: canvasHeight,
          overflow: "visible",
        }}
      >
        {/* Arrow marker definitions */}
        <defs>
          <marker
            id="batch-arrowhead"
            markerWidth="10"
            markerHeight="8"
            refX="9"
            refY="4"
            orient="auto"
            markerUnits="strokeWidth"
          >
            <polygon points="0 0, 10 4, 0 8" fill={ARROW_COLORS.default} />
          </marker>
          <marker
            id="batch-arrowhead-highlight"
            markerWidth="10"
            markerHeight="8"
            refX="9"
            refY="4"
            orient="auto"
            markerUnits="strokeWidth"
          >
            <polygon points="0 0, 10 4, 0 8" fill={ARROW_COLORS.highlighted} />
          </marker>
        </defs>

        {/* Arrow paths */}
        <g className="batch-arrows">
          {arrows.map((arrow) => {
            const isHighlighted =
              getRelatedBatches.has(arrow.from) ||
              getRelatedBatches.has(arrow.to);

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
                strokeWidth={isHighlighted ? 2.5 : 2}
                markerEnd={`url(#${isHighlighted ? "batch-arrowhead-highlight" : "batch-arrowhead"})`}
                className="transition-all duration-150"
              />
            );
          })}
        </g>
      </svg>

      {/* Batches layer */}
      {layout.batches.map((batchLayout) => {
        const batch = batchMap.get(batchLayout.batchNumber);
        if (!batch) return null;

        const adjustedLayout = adjustedLayoutMap.get(batchLayout.batchNumber);
        const y = adjustedLayout?.y ?? batchLayout.y;

        return (
          <div
            key={batch.number}
            ref={(el) => handleBatchRef(batch.number, el)}
            className="absolute"
            style={{
              left: batchLayout.x,
              top: y,
              width: batchLayout.width,
            }}
          >
            <BatchContainer
              batch={batch}
              highlightedTask={highlightedTask}
              onTaskHover={onTaskHover}
              onTaskClick={onTaskClick}
            />
          </div>
        );
      })}
    </div>
  );
}
