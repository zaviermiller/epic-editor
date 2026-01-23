/**
 * EpicDiagram Component (ELK Version)
 *
 * The main visualization component that displays the Epic hierarchy
 * using ELK.js for layout calculation.
 * Features pan/zoom, dependency arrows, and interactive task cards.
 */

"use client";

import { Epic, Task } from "@/types";
import { ElkCanvas, SaveResult } from "./elk/ElkCanvas";
import { StatusLegend } from "./StatusLegend";
import { LinkExternalIcon } from "@primer/octicons-react";
import { DEFAULT_ELK_CONFIG, ElkLayoutConfig } from "@/lib/elk";
import { GitHubApi } from "@/lib/github";

interface ElkEpicDiagramProps {
  epic: Epic;
  /** Callback when a task is clicked */
  onTaskClick?: (task: Task) => void;
  /** Callback when relationship changes are saved */
  onSave?: (result: SaveResult) => void;
  /** GitHub API instance for saving changes */
  api?: GitHubApi;
  /** Optional layout configuration override */
  config?: ElkLayoutConfig;
  /** Whether to show the header with title and link (default: true) */
  showHeader?: boolean;
}

export function ElkEpicDiagram({
  epic,
  onTaskClick,
  onSave,
  api,
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
            <LinkExternalIcon size={12} />
            {epic.owner}/{epic.repo}
          </a>
        </div>
      )}

      {/* Canvas Container */}
      <div className="relative flex-1 min-h-0 rounded-lg border border-border bg-muted/20 overflow-hidden">
        {/* ELK Canvas with batches and dependency arrows */}
        <ElkCanvas
          epic={epic}
          config={config}
          onTaskClick={onTaskClick}
          onSave={onSave}
          api={api}
          className="h-full w-full"
        />
      </div>
    </div>
  );
}
