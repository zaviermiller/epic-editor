/**
 * DragGhostElement Component
 *
 * Floating ghost element that follows the cursor when dragging a task.
 */

import { Task } from "@/types";

/**
 * Get Tailwind background color class based on status
 */
function getStatusBgClass(status: string): string {
  switch (status) {
    case "done":
      return "bg-green-500";
    case "in-progress":
      return "bg-yellow-400";
    case "planned":
      return "bg-blue-500";
    case "not-planned":
      return "bg-gray-400";
    default:
      return "bg-gray-400";
  }
}

/**
 * Get Tailwind text color class based on status
 */
function getStatusTextClass(status: string): string {
  switch (status) {
    case "in-progress":
      return "text-gray-900";
    default:
      return "text-white";
  }
}

interface DragGhostElementProps {
  task: Task;
  position: { x: number; y: number };
}

export function DragGhostElement({ task, position }: DragGhostElementProps) {
  return (
    <div
      className="fixed pointer-events-none z-50"
      style={{
        left: position.x - 60,
        top: position.y - 20,
        opacity: 0.9,
      }}
    >
      <div
        className={`
          ${getStatusBgClass(task.status)} ${getStatusTextClass(task.status)}
          rounded-md px-3 py-2
          text-xs font-medium leading-snug
          shadow-xl ring-2 ring-white ring-offset-2 ring-offset-background
          min-w-[120px] max-w-[200px]
        `}
      >
        <div className="break-words">{task.title}</div>
        <div className="text-[10px] opacity-75 mt-1">#{task.number}</div>
      </div>
    </div>
  );
}
