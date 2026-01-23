/**
 * ElkBatchGroup Component
 *
 * Renders a batch (group) container in the SVG canvas.
 * Shows a dashed border box with header containing batch title and progress.
 */

"use client";

import { useState } from "react";
import { PositionedBatch } from "@/lib/elk";
import { IssueStatus } from "@/types";

interface ElkBatchGroupProps {
  batch: PositionedBatch;
  isHighlighted?: boolean;
  /** Whether edit mode is active */
  isEditMode?: boolean;
  /** Whether this batch is selected as source in edit mode */
  isEditModeSelected?: boolean;
  /** Called when batch is clicked in edit mode */
  onClick?: (batchNumber: number) => void;
}

// Connection+ cursor as a data URI (link icon with plus)
const connectionCursor = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%2322c55e' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71'/%3E%3Cpath d='M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71'/%3E%3Ccircle cx='19' cy='5' r='4' fill='%2322c55e' stroke='none'/%3E%3Cpath d='M19 3v4M17 5h4' stroke='white' stroke-width='1.5'/%3E%3C/svg%3E") 12 12, pointer`;

/**
 * Get header background color based on status
 */
function getHeaderBgColor(status: IssueStatus): string {
  switch (status) {
    case "done":
      return "#22c55e20"; // green-500/12
    case "in-progress":
      return "#facc1520"; // yellow-400/12
    case "planned":
      return "#3b82f620"; // blue-500/12
    case "not-planned":
      return "#9ca3af20"; // gray-400/12
  }
}

export function ElkBatchGroup({
  batch,
  isHighlighted,
  isEditMode = false,
  isEditModeSelected = false,
  onClick,
}: ElkBatchGroupProps) {
  const [isHovered, setIsHovered] = useState(false);
  const headerBg = getHeaderBgColor(batch.status);

  const headerHeight = 50;
  const cornerRadius = 12;
  const ringOffset = 4;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isEditMode && onClick) {
      onClick(batch.batchNumber);
    }
  };

  const handleMouseEnter = () => {
    if (isEditMode) {
      setIsHovered(true);
    }
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
  };

  // Determine border color and width
  let borderColor = "rgb(107 114 128)"; // gray-500
  let borderWidth = 1;
  if (isEditModeSelected) {
    borderColor = "#22c55e"; // green-500
    borderWidth = 2;
  } else if (isEditMode && isHovered) {
    borderColor = "#60a5fa"; // blue-400
    borderWidth = 2;
  }

  return (
    <g
      className="elk-batch-group"
      style={{
        transition: "transform 300ms ease-out",
        cursor: isEditMode ? connectionCursor : "default",
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Edit mode selection ring (pulsing animation) */}
      {isEditModeSelected && (
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
          opacity: isHighlighted ? 0.5 : 1,
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
          isEditModeSelected
            ? "#22c55e30"
            : isHovered && isEditMode
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
          stroke: isEditModeSelected
            ? "#22c55e"
            : isHovered && isEditMode
              ? "#60a5fa"
              : "rgb(75 85 99)",
          strokeWidth: 1,
        }}
      />

      {/* Batch title */}
      <text
        x={batch.x + 16}
        y={batch.y + 22}
        className="fill-foreground text-sm font-semibold pointer-events-none"
        style={{ fontSize: "13px", fontWeight: 600 }}
      >
        {batch.title}
      </text>

      {/* Batch number and progress */}
      <text
        x={batch.x + 16}
        y={batch.y + 40}
        className="fill-muted-foreground pointer-events-none"
        style={{ fontSize: "11px" }}
      >
        #{batch.batchNumber} • {batch.progress}% complete
      </text>

      {/* Progress bar background */}
      <rect
        x={batch.x + batch.width - 80}
        y={batch.y + 16}
        width={64}
        height={6}
        rx={3}
        className="fill-muted/50 pointer-events-none"
      />
      {/* Progress bar fill */}
      <rect
        x={batch.x + batch.width - 80}
        y={batch.y + 16}
        width={Math.max(0, (batch.progress / 100) * 64)}
        height={6}
        rx={3}
        className={`pointer-events-none ${
          batch.status === "done"
            ? "fill-green-500"
            : batch.status === "in-progress"
              ? "fill-yellow-400"
              : "fill-blue-500"
        }`}
      />
    </g>
  );
}
