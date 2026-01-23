/**
 * EpicDiagram Component (ELK Version)
 *
 * The main visualization component that displays the Epic hierarchy
 * using ELK.js for layout calculation.
 * Features pan/zoom, dependency arrows, and interactive task cards.
 */

"use client";

import { Epic, Task } from "@/types";
import { ElkCanvas } from "./elk/ElkCanvas";
import { StatusLegend } from "./StatusLegend";
import { ExternalLink } from "lucide-react";
import { DEFAULT_ELK_CONFIG, ElkLayoutConfig } from "@/lib/elk";

interface ElkEpicDiagramProps {
  epic: Epic;
  /** Callback when a task is clicked */
  onTaskClick?: (task: Task) => void;
  /** Optional layout configuration override */
  config?: ElkLayoutConfig;
  /** Whether to show the header with title and link (default: true) */
  showHeader?: boolean;
}

export function ElkEpicDiagram({
  epic,
  onTaskClick,
  config = DEFAULT_ELK_CONFIG,
  showHeader = true,
}: ElkEpicDiagramProps) {
  return (
    <div className="flex flex-col h-full">
      {/* Epic Header */}
      {showHeader && (
        <div className="shrink-0 text-center pb-4 border-b border-border mb-4">
          <h1 className="text-xl font-semibold text-foreground">
            Epic: {epic.title} #{epic.number}
          </h1>
          <a
            href={epic.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mt-1"
          >
            <ExternalLink className="h-3 w-3" />
            {epic.owner}/{epic.repo}
          </a>
        </div>
      )}

      {/* Canvas Container */}
      <div className="relative flex-1 min-h-0 rounded-lg border border-border bg-muted/20 overflow-hidden">
        {/* Status Legend - Fixed position */}
        <div className="absolute bottom-4 right-4 z-20">
          <StatusLegend />
        </div>

        {/* ELK Canvas with batches and dependency arrows */}
        <ElkCanvas
          epic={epic}
          config={config}
          onTaskClick={onTaskClick}
          className="h-full w-full"
        />
      </div>
    </div>
  );
}
