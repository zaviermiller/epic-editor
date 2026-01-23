/**
 * CanvasToolbar Component
 *
 * A hovering toolbar at the bottom of the canvas that contains
 * icons for enabling various editing tools like relationship editing.
 */

"use client";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export type ToolType = "select" | "edit-relationships";

interface CanvasToolbarProps {
  /** Currently active tool */
  activeTool: ToolType;
  /** Callback when a tool is selected */
  onToolChange: (tool: ToolType) => void;
  /** Class name for additional styling */
  className?: string;
}

interface ToolButtonProps {
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
  onClick: () => void;
}

function ToolButton({ icon, label, isActive, onClick }: ToolButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={onClick}
          className={`
            flex items-center justify-center w-9 h-9 rounded-md transition-colors
            ${
              isActive
                ? "bg-primary text-primary-foreground"
                : "hover:bg-muted text-muted-foreground hover:text-foreground"
            }
          `}
          aria-label={label}
        >
          {icon}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={8}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

// SVG Icons
function SelectIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" />
      <path d="M13 13l6 6" />
    </svg>
  );
}

function EditRelationshipsIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Two connected nodes with arrow */}
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="12" r="3" />
      <path d="M9 12h6" />
      <path d="M12 9l3 3-3 3" />
    </svg>
  );
}

export function CanvasToolbar({
  activeTool,
  onToolChange,
  className = "",
}: CanvasToolbarProps) {
  const tools: { type: ToolType; icon: React.ReactNode; label: string }[] = [
    {
      type: "select",
      icon: <SelectIcon />,
      label: "Select (V)",
    },
    {
      type: "edit-relationships",
      icon: <EditRelationshipsIcon />,
      label: "Edit Relationships",
    },
  ];

  return (
    <div
      className={`
        flex items-center gap-1 bg-card border border-border rounded-lg p-1.5 shadow-sm
        ${className}
      `}
    >
      {tools.map((tool) => (
        <ToolButton
          key={tool.type}
          icon={tool.icon}
          label={tool.label}
          isActive={activeTool === tool.type}
          onClick={() => onToolChange(tool.type)}
        />
      ))}
    </div>
  );
}
