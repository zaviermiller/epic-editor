/**
 * ElkBatchGroup Component
 *
 * Renders a batch (group) container in the SVG canvas.
 * Shows a dashed border box with header containing batch title and progress.
 */

"use client";

import { PositionedBatch } from "@/lib/elk";
import { IssueStatus } from "@/types";

interface ElkBatchGroupProps {
  batch: PositionedBatch;
  isHighlighted?: boolean;
  /** Whether edit mode is active */
  isEditMode?: boolean;
  /** Whether this batch is selected as source in edit mode */
  isEditModeSelected?: boolean;
  /** Called when batch header is clicked (starts connection) */
  onHeaderClick?: (batchNumber: number) => void;
  /** Called when batch body is clicked (completes connection) */
  onBodyClick?: (batchNumber: number) => void;
}

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
  onHeaderClick,
  onBodyClick,
}: ElkBatchGroupProps) {
  const headerBg = getHeaderBgColor(batch.status);

  const headerHeight = 50;
  const cornerRadius = 12;

  const handleHeaderClick = (e: React.MouseEvent) => {
    if (isEditMode && onHeaderClick) {
      e.stopPropagation();
      onHeaderClick(batch.batchNumber);
    }
  };

  const handleBodyClick = (e: React.MouseEvent) => {
    if (isEditMode && onBodyClick) {
      e.stopPropagation();
      onBodyClick(batch.batchNumber);
    }
  };

  return (
    <g
      className="elk-batch-group"
      style={{
        transition: "transform 300ms ease-out",
      }}
    >
      {/* Main container with dashed border - clickable body area */}
      <rect
        x={batch.x}
        y={batch.y}
        width={batch.width}
        height={batch.height}
        rx={cornerRadius}
        ry={cornerRadius}
        className={`fill-card/80 transition-all duration-300 ${
          isEditModeSelected
            ? "stroke-green-500"
            : isEditMode
              ? "stroke-gray-500 hover:stroke-blue-400"
              : "stroke-gray-500"
        }`}
        style={{
          strokeWidth: isEditModeSelected ? 2 : 1,
          opacity: isHighlighted ? 0.5 : 1,
          cursor: isEditMode ? "pointer" : "default",
        }}
        onClick={handleBodyClick}
      />

      {/* Header clickable area - invisible but captures clicks */}
      {isEditMode && (
        <rect
          x={batch.x}
          y={batch.y}
          width={batch.width}
          height={headerHeight}
          fill="transparent"
          style={{ cursor: "pointer" }}
          onClick={handleHeaderClick}
        />
      )}

      {/* Header background */}
      <rect
        x={batch.x}
        y={batch.y}
        width={batch.width}
        height={headerHeight}
        rx={cornerRadius}
        ry={cornerRadius}
        fill={isEditModeSelected ? "#22c55e30" : headerBg}
        className="pointer-events-none"
        clipPath={`inset(0 0 ${batch.height - headerHeight}px 0 round ${cornerRadius}px)`}
      />

      {/* Header separator line */}
      <line
        x1={batch.x}
        y1={batch.y + headerHeight}
        x2={batch.x + batch.width}
        y2={batch.y + headerHeight}
        className={isEditModeSelected ? "stroke-green-500" : "stroke-gray-600"}
        style={{ strokeWidth: 1 }}
      />

      {/* Batch title */}
      <text
        x={batch.x + 16}
        y={batch.y + 22}
        className="fill-foreground text-sm font-semibold"
        style={{ fontSize: "13px", fontWeight: 600 }}
      >
        {batch.title}
      </text>

      {/* Batch number and progress */}
      <text
        x={batch.x + 16}
        y={batch.y + 40}
        className="fill-muted-foreground"
        style={{ fontSize: "11px" }}
      >
        #{batch.batchNumber} • {batch.progress}% complete
      </text>

      {/* Progress bar */}
      <rect
        x={batch.x + batch.width - 80}
        y={batch.y + 16}
        width={64}
        height={6}
        rx={3}
        className="fill-muted/50"
      />
      <rect
        x={batch.x + batch.width - 80}
        y={batch.y + 16}
        width={Math.max(0, (batch.progress / 100) * 64)}
        height={6}
        rx={3}
        className={
          batch.status === "done"
            ? "fill-green-500"
            : batch.status === "in-progress"
              ? "fill-yellow-400"
              : "fill-blue-500"
        }
      />
    </g>
  );
}
