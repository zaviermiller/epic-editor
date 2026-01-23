/**
 * ElkTaskNode Component
 *
 * Renders a task node in the SVG canvas.
 * Displays as a colored card with status-based styling.
 */

"use client";

import { PositionedTask } from "@/lib/elk";
import { IssueStatus } from "@/types";

interface ElkTaskNodeProps {
  task: PositionedTask;
  isHighlighted?: boolean;
  isRelated?: boolean;
  isDimmed?: boolean;
  /** Whether this task is selected as the source in edit mode */
  isEditModeSelected?: boolean;
  /** Whether edit mode is active */
  isEditMode?: boolean;
  onHover?: (taskNumber: number | null) => void;
  onClick?: (taskNumber: number) => void;
}

// Connection+ cursor as a data URI (link icon with plus)
const connectionCursor = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%2322c55e' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71'/%3E%3Cpath d='M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71'/%3E%3Ccircle cx='19' cy='5' r='4' fill='%2322c55e' stroke='none'/%3E%3Cpath d='M19 3v4M17 5h4' stroke='white' stroke-width='1.5'/%3E%3C/svg%3E") 12 12, pointer`;

/**
 * Get background color based on status
 */
function getStatusColors(status: IssueStatus): {
  bg: string;
  text: string;
  border: string;
} {
  switch (status) {
    case "done":
      return {
        bg: "#22c55e", // green-500
        text: "#ffffff",
        border: "#16a34a", // green-600
      };
    case "in-progress":
      return {
        bg: "#facc15", // yellow-400
        text: "#1f2937", // gray-800
        border: "#eab308", // yellow-500
      };
    case "planned":
      return {
        bg: "#3b82f6", // blue-500
        text: "#ffffff",
        border: "#2563eb", // blue-600
      };
    case "not-planned":
      return {
        bg: "#9ca3af", // gray-400
        text: "#ffffff",
        border: "#6b7280", // gray-500
      };
  }
}

/**
 * Wrap text for SVG rendering
 */
function wrapText(text: string, maxWidth: number, fontSize: number): string[] {
  // Approximate characters per line
  const charsPerLine = Math.floor(maxWidth / (fontSize * 0.55));
  const words = text.split(" ");
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    if (testLine.length <= charsPerLine) {
      currentLine = testLine;
    } else {
      if (currentLine) {
        lines.push(currentLine);
      }
      // If word itself is too long, truncate it
      if (word.length > charsPerLine) {
        currentLine = word.substring(0, charsPerLine - 2) + "…";
      } else {
        currentLine = word;
      }
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  // Limit to 3 lines max
  if (lines.length > 3) {
    lines.length = 3;
    lines[2] = lines[2].substring(0, lines[2].length - 1) + "…";
  }

  return lines;
}

export function ElkTaskNode({
  task,
  isHighlighted = false,
  isRelated = false,
  isDimmed = false,
  isEditModeSelected = false,
  isEditMode = false,
  onHover,
  onClick,
}: ElkTaskNodeProps) {
  const colors = getStatusColors(task.status);
  const cornerRadius = 6;
  const padding = { x: 12, y: 8 };
  const fontSize = 12;
  const lineHeight = 16;

  const titleLines = wrapText(task.title, task.width - padding.x * 2, fontSize);

  // In edit mode, don't trigger hover highlighting
  const handleMouseEnter = () => !isEditMode && onHover?.(task.taskNumber);
  const handleMouseLeave = () => !isEditMode && onHover?.(null);
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClick?.(task.taskNumber);
  };

  // Calculate opacity based on state
  const opacity = isDimmed ? 0.3 : 1;

  // Ring styling for highlight states
  const ringOffset = 3;
  const ringWidth = 2;

  // Determine if we should show a special ring
  const showHighlightRing = isHighlighted || isRelated;
  const showEditModeRing = isEditModeSelected;

  return (
    <g
      className="elk-task-node"
      style={{
        opacity,
        transition: "opacity 150ms ease-in-out, transform 300ms ease-out",
        cursor: isEditMode ? connectionCursor : "pointer",
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
    >
      {/* Edit mode selection ring (pulsing animation) */}
      {showEditModeRing && (
        <rect
          x={task.x - ringOffset - 1}
          y={task.y - ringOffset - 1}
          width={task.width + (ringOffset + 1) * 2}
          height={task.height + (ringOffset + 1) * 2}
          rx={cornerRadius + ringOffset + 1}
          ry={cornerRadius + ringOffset + 1}
          fill="none"
          stroke="#22c55e"
          strokeWidth={3}
          className="pointer-events-none animate-pulse"
        />
      )}

      {/* Shadow */}
      <rect
        x={task.x + 1}
        y={task.y + 2}
        width={task.width}
        height={task.height}
        rx={cornerRadius}
        ry={cornerRadius}
        fill="rgba(0,0,0,0.15)"
        className="pointer-events-none"
      />

      {/* Main card background */}
      <rect
        x={task.x}
        y={task.y}
        width={task.width}
        height={task.height}
        rx={cornerRadius}
        ry={cornerRadius}
        fill={colors.bg}
        stroke={colors.border}
        strokeWidth={1}
        className="transition-transform duration-150 hover:scale-[1.02]"
        style={{
          transformOrigin: `${task.x + task.width / 2}px ${task.y + task.height / 2}px`,
        }}
      />

      {/* Task title */}
      {titleLines.map((line, i) => (
        <text
          key={i}
          x={task.x + padding.x}
          y={task.y + padding.y + fontSize + i * lineHeight}
          fill={colors.text}
          style={{
            fontSize: `${fontSize}px`,
            fontWeight: 500,
            fontFamily: "var(--font-sans, system-ui, sans-serif)",
          }}
          className="pointer-events-none select-none"
        >
          {line}
        </text>
      ))}

      {/* Task number */}
      <text
        x={task.x + padding.x}
        y={task.y + task.height - padding.y}
        fill={colors.text}
        style={{
          fontSize: "10px",
          opacity: 0.75,
          fontFamily: "var(--font-sans, system-ui, sans-serif)",
        }}
        className="pointer-events-none select-none"
      >
        #{task.taskNumber}
      </text>
    </g>
  );
}
