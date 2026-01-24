/**
 * DragGhostElement Component
 *
 * Floating ghost element that follows the cursor when dragging a task.
 */

import { Task } from "@/types";
import { getStatusBgClass, getStatusTextClass } from "@/lib/statusUtils";

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
