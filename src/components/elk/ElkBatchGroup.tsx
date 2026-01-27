/**
 * ElkBatchGroup Component
 *
 * Renders a batch (group) container in the SVG canvas.
 * Shows a dashed border box with header containing batch title and progress.
 * Supports being a drop target for moving issues between batches.
 */

"use client";

import { useState } from "react";
import { PositionedBatch } from "@/lib/elk";
import { IssueStatus } from "@/types";

interface ElkBatchGroupProps {
  batch: PositionedBatch;
  /** Whether this batch should be dimmed (not related to hovered batch) */
  isDimmed?: boolean;
  /** Whether this batch is connected to the hovered batch */
  isRelatedBatch?: boolean;
  /** Whether edit mode is active */
  isEditMode?: boolean;
  /** Whether this batch is selected as source in edit mode */
  isEditModeSelected?: boolean;
  /** Whether move-issue mode is active */
  isMoveMode?: boolean;
  /** Whether a drag operation is currently in progress */
  isDragActive?: boolean;
  /** Whether this batch is a valid drop target (has a task being dragged over it) */
  isDropTarget?: boolean;
  /** Called when batch is clicked in edit mode */
  onClick?: (batchNumber: number) => void;
  /** Called when a task is dropped on this batch */
  onDrop?: (batchNumber: number) => void;
  /** Called when mouse enters batch (for view mode hover highlighting) */
  onHover?: (batchNumber: number | null) => void;
  /** When true, uses explicit hex colors for export compatibility */
  forExport?: boolean;
  /** Repository owner for constructing GitHub URLs */
  owner?: string;
  /** Repository name for constructing GitHub URLs */
  repo?: string;
}

// Connection+ cursor as a data URI (link icon with plus)
const connectionCursor = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%23ffffff' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71'/%3E%3Cpath d='M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71'/%3E%3Ccircle cx='19' cy='5' r='4' fill='%2322c55e' stroke='none'/%3E%3Cpath d='M19 3v4M17 5h4' stroke='white' stroke-width='1.5'/%3E%3C/svg%3E") 12 12, pointer`;

// Drop target cursor
const dropTargetCursor = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%23ffffff' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M12 5v14'/%3E%3Cpath d='M5 12h14'/%3E%3C/svg%3E") 12 12, copy`;

/**
 * Get header background color based on status
 */
function getHeaderBgColor(status: IssueStatus): string {
  switch (status) {
    case "done":
      return "#22c55e20"; // green-500/12
    case "in-progress":
      return "#facc1520"; // yellow-400/12
    case "ready":
      return "#3b82f620"; // blue-500/12
    case "blocked":
      return "#ef444420"; // red-500/12
    case "unknown":
      return "#6b728020"; // gray-500/12
  }
}

export function ElkBatchGroup({
  batch,
  isDimmed = false,
  isRelatedBatch = false,
  isEditMode = false,
  isEditModeSelected = false,
  isMoveMode = false,
  isDragActive = false,
  isDropTarget = false,
  onClick,
  onDrop,
  onHover,
  forExport = false,
  owner,
  repo,
}: ElkBatchGroupProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isTitleHovered, setIsTitleHovered] = useState(false);
  const headerBg = getHeaderBgColor(batch.status);

  const headerHeight = 50;
  const cornerRadius = 12;
  const ringOffset = 4;

  // Synthetic batches (number <= 0) can't have dependencies edited or receive drops
  const isSyntheticBatch = batch.batchNumber <= 0;
  const canEditDependencies = isEditMode && !isSyntheticBatch;
  // Only show as droppable when actually dragging a task
  const canReceiveDrop = isMoveMode && isDragActive && !isSyntheticBatch;
  // View mode hover is only enabled when not in edit or move mode
  const canHoverHighlight = !isEditMode && !isMoveMode && !isSyntheticBatch;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (canEditDependencies && onClick) {
      onClick(batch.batchNumber);
    }
  };

  const handleMouseEnter = () => {
    if (canEditDependencies || canReceiveDrop) {
      setIsHovered(true);
    }
    // Trigger batch hover highlighting in view mode
    if (canHoverHighlight && onHover) {
      onHover(batch.batchNumber);
    }
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    // Clear batch hover highlighting in view mode
    if (canHoverHighlight && onHover) {
      onHover(null);
    }
  };

  // Handle mouse up for drop target (completing a drag-and-drop)
  const handleMouseUp = (e: React.MouseEvent) => {
    if (canReceiveDrop && isDropTarget && onDrop) {
      e.stopPropagation();
      onDrop(batch.batchNumber);
    }
  };

  // Determine border color and width
  let borderColor = "rgb(107 114 128)"; // gray-500
  let borderWidth = 1;
  if (isDropTarget && canReceiveDrop) {
    borderColor = "#3b82f6"; // blue-500
    borderWidth = 3;
  } else if (isEditModeSelected && !isSyntheticBatch) {
    borderColor = "#22c55e"; // green-500
    borderWidth = 2;
  } else if (canEditDependencies && isHovered) {
    borderColor = "#60a5fa"; // blue-400
    borderWidth = 2;
  } else if (canReceiveDrop && isHovered) {
    borderColor = "#60a5fa"; // blue-400
    borderWidth = 2;
  }

  // Determine cursor
  let cursor = "default";
  if (canEditDependencies) {
    cursor = connectionCursor;
  } else if (canReceiveDrop && isDropTarget) {
    cursor = dropTargetCursor;
  }

  return (
    <g
      className="elk-batch-group"
      style={{
        transition: "transform 300ms ease-out, opacity 150ms ease-in-out",
        cursor,
        opacity: isDimmed ? 0.3 : 1,
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onMouseUp={handleMouseUp}
    >
      {/* Related batch highlight ring (subtle glow when connected to hovered batch) */}
      {isRelatedBatch && !isSyntheticBatch && (
        <rect
          x={batch.x - ringOffset - 1}
          y={batch.y - ringOffset - 1}
          width={batch.width + (ringOffset + 1) * 2}
          height={batch.height + (ringOffset + 1) * 2}
          rx={cornerRadius + ringOffset + 1}
          ry={cornerRadius + ringOffset + 1}
          fill="none"
          stroke="#3b82f6"
          strokeWidth={2}
          strokeOpacity={0.5}
          className="pointer-events-none"
        />
      )}

      {/* Edit mode selection ring (pulsing animation) */}
      {isEditModeSelected && !isSyntheticBatch && (
        <rect
          x={batch.x - ringOffset - 1}
          y={batch.y - ringOffset - 1}
          width={batch.width + (ringOffset + 1) * 2}
          height={batch.height + (ringOffset + 1) * 2}
          rx={cornerRadius + ringOffset + 1}
          ry={cornerRadius + ringOffset + 1}
          fill="none"
          stroke="#22c55e"
          strokeWidth={3}
          className="pointer-events-none animate-pulse"
        />
      )}

      {/* Drop target ring (blue, pulsing) */}
      {isDropTarget && canReceiveDrop && (
        <rect
          x={batch.x - ringOffset - 1}
          y={batch.y - ringOffset - 1}
          width={batch.width + (ringOffset + 1) * 2}
          height={batch.height + (ringOffset + 1) * 2}
          rx={cornerRadius + ringOffset + 1}
          ry={cornerRadius + ringOffset + 1}
          fill="none"
          stroke="#3b82f6"
          strokeWidth={3}
          className="pointer-events-none animate-pulse"
        />
      )}

      {/* Main container with border */}
      <rect
        x={batch.x}
        y={batch.y}
        width={batch.width}
        height={batch.height}
        rx={cornerRadius}
        ry={cornerRadius}
        className="fill-card/80 transition-all duration-150"
        style={{
          stroke: borderColor,
          strokeWidth: borderWidth,
        }}
        onClick={handleClick}
      />

      {/* Header background */}
      <rect
        x={batch.x}
        y={batch.y}
        width={batch.width}
        height={headerHeight}
        rx={cornerRadius}
        ry={cornerRadius}
        fill={
          isEditModeSelected && !isSyntheticBatch
            ? "#22c55e30"
            : isHovered && canEditDependencies
              ? "#60a5fa20"
              : headerBg
        }
        className="pointer-events-none"
        clipPath={`inset(0 0 ${batch.height - headerHeight}px 0 round ${cornerRadius}px)`}
      />

      {/* Header separator line */}
      <line
        x1={batch.x}
        y1={batch.y + headerHeight}
        x2={batch.x + batch.width}
        y2={batch.y + headerHeight}
        style={{
          stroke:
            isEditModeSelected && !isSyntheticBatch
              ? "#22c55e"
              : isHovered && canEditDependencies
                ? "#60a5fa"
                : "rgb(75 85 99)",
          strokeWidth: 1,
        }}
      />

      {/* Batch title */}
      {owner && repo && batch.batchNumber > 0 ? (
        <a
          href={`https://github.com/${owner}/${repo}/issues/${batch.batchNumber}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{ cursor: "pointer" }}
          onClick={(e) => e.stopPropagation()}
        >
          <text
            x={batch.x + 16}
            y={batch.y + 22}
            className={forExport ? "" : "fill-foreground text-sm font-semibold"}
            style={{
              fontSize: "13px",
              fontWeight: 600,
              fill: forExport ? "#fafafa" : undefined,
              cursor: "pointer",
              textDecoration: isTitleHovered ? "underline" : "none",
            }}
            onMouseEnter={() => setIsTitleHovered(true)}
            onMouseLeave={() => setIsTitleHovered(false)}
          >
            {batch.title}
          </text>
        </a>
      ) : (
        <text
          x={batch.x + 16}
          y={batch.y + 22}
          className={
            forExport
              ? "pointer-events-none"
              : "fill-foreground text-sm font-semibold pointer-events-none"
          }
          style={{
            fontSize: "13px",
            fontWeight: 600,
            fill: forExport ? "#fafafa" : undefined,
          }}
        >
          {batch.title}
        </text>
      )}

      {/* Batch number and progress */}
      <text
        x={batch.x + 16}
        y={batch.y + 40}
        className={
          forExport
            ? "pointer-events-none"
            : "fill-muted-foreground pointer-events-none"
        }
        style={{ fontSize: "11px", fill: forExport ? "#a1a1aa" : undefined }}
      >
        {isSyntheticBatch ? "" : `#${batch.batchNumber} • `}
        {batch.progress}% complete
      </text>

      {/* Progress bar background */}
      <rect
        x={batch.x + batch.width - 80}
        y={batch.y + 16}
        width={64}
        height={6}
        rx={3}
        className={
          forExport
            ? "pointer-events-none"
            : "fill-muted/50 pointer-events-none"
        }
        style={forExport ? { fill: "#27272a80" } : undefined}
      />
      {/* Progress bar fill */}
      <rect
        x={batch.x + batch.width - 80}
        y={batch.y + 16}
        width={Math.max(0, (batch.progress / 100) * 64)}
        height={6}
        rx={3}
        className={
          forExport
            ? "pointer-events-none"
            : `pointer-events-none ${
                batch.status === "done"
                  ? "fill-green-500"
                  : batch.status === "in-progress"
                    ? "fill-yellow-400"
                    : "fill-blue-500"
              }`
        }
        style={
          forExport
            ? {
                fill:
                  batch.status === "done"
                    ? "#22c55e"
                    : batch.status === "in-progress"
                      ? "#facc15"
                      : "#3b82f6",
              }
            : undefined
        }
      />
    </g>
  );
}
