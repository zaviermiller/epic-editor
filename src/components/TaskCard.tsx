/**
 * TaskCard Component
 *
 * Displays a single task as a small colored card based on status.
 * Matches the reference design with compact colored boxes.
 */

"use client";

import { Task, IssueStatus } from "@/types";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface TaskCardProps {
  task: Task;
  /** Whether this task is highlighted (hovered) */
  isHighlighted?: boolean;
  /** Whether this task is related to the highlighted task (dependency relationship) */
  isRelated?: boolean;
  /** Whether this task has dependencies within the same batch */
  hasIntraBatchDeps?: boolean;
  /** Task numbers this task depends on within the same batch */
  intraBatchDependsOn?: number[];
  /** Task numbers that depend on this task within the same batch */
  intraBatchDependedBy?: number[];
  /** Callback when the card is hovered */
  onHover?: (taskNumber: number | null) => void;
  /** Callback when the card is clicked */
  onClick?: (task: Task) => void;
  /** Fixed width for canvas rendering (allows height to expand for content) */
  fixedWidth?: number;
}

/**
 * Get background color class based on status
 */
function getStatusBgColor(status: IssueStatus): string {
  switch (status) {
    case "done":
      return "bg-green-500";
    case "in-progress":
      return "bg-yellow-400";
    case "planned":
      return "bg-blue-500";
    case "not-planned":
      return "bg-gray-400";
  }
}

/**
 * Get text color class based on status (for contrast)
 */
function getStatusTextColor(status: IssueStatus): string {
  switch (status) {
    case "done":
      return "text-white";
    case "in-progress":
      return "text-gray-900";
    case "planned":
      return "text-white";
    case "not-planned":
      return "text-white";
  }
}

export function TaskCard({
  task,
  isHighlighted = false,
  isRelated = false,
  onHover,
  onClick,
  fixedWidth,
}: TaskCardProps) {
  const bgColor = getStatusBgColor(task.status);
  const textColor = getStatusTextColor(task.status);

  // Style object for fixed width (used in canvas mode)
  const dimensionStyle = fixedWidth
    ? {
        width: fixedWidth,
        minWidth: fixedWidth,
      }
    : undefined;

  return (
    <TooltipProvider>
      <Tooltip delayDuration={200}>
        <TooltipTrigger asChild>
          <div
            className={`
              ${bgColor} ${textColor}
              rounded-md px-3 py-2 cursor-pointer
              text-xs font-medium leading-snug
              transition-all duration-150
              hover:scale-[1.02] hover:shadow-lg
              ${isHighlighted ? "ring-2 ring-white ring-offset-2 ring-offset-background scale-[1.02] shadow-lg" : ""}
              ${isRelated ? "ring-2 ring-blue-400 ring-offset-1 ring-offset-background" : ""}
              ${fixedWidth ? "" : "w-full"}
            `}
            style={dimensionStyle}
            onMouseEnter={() => onHover?.(task.number)}
            onMouseLeave={() => onHover?.(null)}
            onClick={() => onClick?.(task)}
            data-task-id={task.number}
          >
            <div className="break-words">{task.title}</div>
            <div className="text-[10px] opacity-75 mt-1">#{task.number}</div>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="space-y-1">
            <p className="font-medium">{task.title}</p>
            <p className="text-xs text-muted-foreground">#{task.number}</p>
            {task.assignees.length > 0 && (
              <p className="text-xs">
                Assigned: {task.assignees.map((a) => a.login).join(", ")}
              </p>
            )}
            {task.dependsOn.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Depends on: {task.dependsOn.map((d) => `#${d}`).join(", ")}
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
