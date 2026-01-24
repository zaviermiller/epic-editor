/**
 * CanvasHints Component
 *
 * Displays contextual hints for edit mode and move mode.
 */

import { DraggingTaskState, PendingMove } from "../types";

interface EditModeHintProps {
  editModeSourceTask: number | null;
  editModeSourceBatch: number | null;
}

export function EditModeHint({
  editModeSourceTask,
  editModeSourceBatch,
}: EditModeHintProps) {
  return (
    <div className="absolute top-4 left-4 z-10 px-3 py-1.5 text-xs font-medium bg-card border border-border rounded-md">
      {editModeSourceTask !== null ? (
        <span className="text-green-500">
          Click another task to create link, or same task to cancel
        </span>
      ) : editModeSourceBatch !== null ? (
        <span className="text-green-500">
          Click another batch to create link, or same batch to cancel
        </span>
      ) : (
        <span className="text-muted-foreground">
          Click a task or batch to start, or click an arrow to remove
        </span>
      )}
    </div>
  );
}

interface MoveModeHintProps {
  draggingTask: DraggingTaskState | null;
  pendingMoves: PendingMove[];
  committedMoves: Set<number>;
}

export function MoveModeHint({
  draggingTask,
  pendingMoves,
  committedMoves,
}: MoveModeHintProps) {
  const uncommittedMoves = pendingMoves.filter(
    (m) => !committedMoves.has(m.taskNumber),
  );

  return (
    <div className="absolute top-4 left-4 z-10 px-3 py-1.5 text-xs font-medium bg-card border border-border rounded-md">
      {draggingTask !== null ? (
        <span className="text-blue-500">
          Drag to a batch to move issue #{draggingTask.taskNumber}, release
          outside to cancel
        </span>
      ) : uncommittedMoves.length > 0 ? (
        <span className="text-blue-500">
          {uncommittedMoves.length} move
          {uncommittedMoves.length > 1 ? "s" : ""} queued. Click Save to apply
          or click X on tasks to cancel.
        </span>
      ) : committedMoves.size > 0 ? (
        <span className="text-green-500">
          {committedMoves.size} move{committedMoves.size > 1 ? "s" : ""} saved.
          Waiting for refresh...
        </span>
      ) : (
        <span className="text-muted-foreground">
          Click and drag a task to move it to another batch
        </span>
      )}
    </div>
  );
}
