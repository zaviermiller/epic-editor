/**
 * BatchContainer Component
 *
 * Displays a batch as a container with a header bar and task cards inside.
 * Uses a canvas-based layout with clean arrow routing for dependencies.
 */

"use client";

import { Batch, Task } from "@/types";
import { BatchCanvas } from "./BatchCanvas";
import { ExternalLink } from "lucide-react";

interface BatchContainerProps {
  batch: Batch;
  /** Task number that is currently highlighted */
  highlightedTask?: number | null;
  /** Callback when a task is hovered */
  onTaskHover?: (taskNumber: number | null) => void;
  /** Callback when a task is clicked */
  onTaskClick?: (task: Task) => void;
}

export function BatchContainer({
  batch,
  highlightedTask,
  onTaskHover,
  onTaskClick,
}: BatchContainerProps) {
  return (
    <div
      className="bg-card border border-border rounded-lg shadow-sm"
      data-batch-id={batch.number}
    >
      {/* Batch Header */}
      <div className="px-3 py-2 border-b border-border bg-muted/30 rounded-t-lg">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-medium text-foreground">
            {batch.title} #{batch.number}
          </h3>
          <div className="flex items-center gap-2">
            <a
              href={batch.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground shrink-0"
              onClick={(e) => e.stopPropagation()}
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      </div>

      {/* Canvas with tasks and dependency arrows */}
      <div className="p-3 overflow-auto">
        <BatchCanvas
          tasks={batch.tasks}
          batchId={batch.number}
          highlightedTask={highlightedTask}
          onTaskHover={onTaskHover}
          onTaskClick={onTaskClick}
        />
      </div>
    </div>
  );
}
