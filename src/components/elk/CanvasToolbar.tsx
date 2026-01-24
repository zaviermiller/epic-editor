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
import {
  GrabberIcon,
  LinkIcon,
  ArrowSwitchIcon,
  DownloadIcon,
} from "@primer/octicons-react";

export type ToolType = "select" | "edit-relationships" | "move-issue";

interface CanvasToolbarProps {
  /** Currently active tool */
  activeTool: ToolType;
  /** Callback when a tool is selected */
  onToolChange: (tool: ToolType) => void;
  /** Callback when export button is clicked */
  onExport?: () => void;
  /** Whether export is in progress */
  isExporting?: boolean;
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
            flex items-center justify-center w-9 h-9 rounded-md transition-colors cursor-pointer
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

export function CanvasToolbar({
  activeTool,
  onToolChange,
  onExport,
  isExporting = false,
  className = "",
}: CanvasToolbarProps) {
  const tools: { type: ToolType; icon: React.ReactNode; label: string }[] = [
    {
      type: "select",
      icon: <GrabberIcon size={18} />,
      label: "Select (V)",
    },
    {
      type: "edit-relationships",
      icon: <LinkIcon size={18} />,
      label: "Edit Relationships",
    },
    {
      type: "move-issue",
      icon: <ArrowSwitchIcon size={18} />,
      label: "Move Issues Between Batches",
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

      {/* Separator */}
      <div className="w-px h-6 bg-border mx-1" />

      {/* Export button */}
      {onExport && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={onExport}
              disabled={isExporting}
              className={`
                flex items-center justify-center w-9 h-9 rounded-md transition-colors cursor-pointer
                hover:bg-muted text-muted-foreground hover:text-foreground
                disabled:opacity-50 disabled:cursor-not-allowed
              `}
              aria-label="Export as Image"
            >
              <DownloadIcon
                size={18}
                className={isExporting ? "animate-pulse" : ""}
              />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" sideOffset={8}>
            {isExporting ? "Exporting..." : "Export as PNG"}
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}
