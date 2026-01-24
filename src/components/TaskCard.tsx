/**
 * TaskCard Component
 *
 * Displays a single task as a small colored card based on status.
 * Matches the reference design with compact colored boxes.
 */

"use client";

import { Task } from "@/types";
import { getStatusBgClass, getStatusTextClass } from "@/lib/statusUtils";
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
  /** Callback when drag starts on this card */
  onDragStart?: (task: Task, e: React.MouseEvent) => void;
  /** Fixed width for canvas rendering (allows height to expand for content) */
  fixedWidth?: number;
}

export function TaskCard({
  task,
  isHighlighted = false,
  isRelated = false,
  onHover,
  onClick,
  onDragStart,
  fixedWidth,
}: TaskCardProps) {
  const bgColor = getStatusBgClass(task.status);
  const textColor = getStatusTextClass(task.status);

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
              ${onDragStart ? "cursor-grab active:cursor-grabbing" : ""}
            `}
            style={dimensionStyle}
            onMouseEnter={() => onHover?.(task.number)}
            onMouseLeave={() => onHover?.(null)}
            onClick={(e) => {
              // Don't trigger click if we were dragging
              if (!e.defaultPrevented) {
                onClick?.(task);
              }
            }}
            onMouseDown={(e) => {
              if (onDragStart && e.button === 0) {
                onDragStart(task, e);
              }
            }}
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
