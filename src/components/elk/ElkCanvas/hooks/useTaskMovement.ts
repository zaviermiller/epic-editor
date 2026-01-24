/**
 * useTaskMovement Hook
 *
 * Manages state and handlers for dragging tasks between batches.
 */

import { useState, useCallback, useEffect, useRef, RefObject } from "react";
import { Epic } from "@/types";
import { ElkLayoutResult } from "@/lib/elk";
import { DraggingTaskState, PendingMove, TransformState } from "../types";

interface UseTaskMovementOptions {
  epic: Epic;
  layout: ElkLayoutResult | null;
  isMoveMode: boolean;
  containerRef: RefObject<HTMLDivElement | null>;
  transform: TransformState;
  isPanning: RefObject<boolean>;
  findIssueIdByNumber: (issueNumber: number) => number | null;
}

interface UseTaskMovementReturn {
  draggingTask: DraggingTaskState | null;
  dropTargetBatch: number | null;
  dragPosition: { x: number; y: number } | null;
  pendingMoves: PendingMove[];
  committedMoves: Set<number>;
  handleTaskDragStart: (taskNumber: number, e: React.MouseEvent) => void;
  handleTaskDragEnd: () => void;
  handleBatchDrop: (batchNumber: number) => void;
  handleCancelMove: (taskNumber: number) => void;
  handleCanvasMouseMove: (e: React.MouseEvent) => void;
  setPendingMoves: React.Dispatch<React.SetStateAction<PendingMove[]>>;
  setCommittedMoves: React.Dispatch<React.SetStateAction<Set<number>>>;
  clearMoveChanges: () => void;
}

export function useTaskMovement({
  epic,
  layout,
  isMoveMode,
  containerRef,
  transform,
  isPanning,
  findIssueIdByNumber,
}: UseTaskMovementOptions): UseTaskMovementReturn {
  const [draggingTask, setDraggingTask] = useState<DraggingTaskState | null>(
    null,
  );
  const [dropTargetBatch, setDropTargetBatch] = useState<number | null>(null);
  const [dragPosition, setDragPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [pendingMoves, setPendingMoves] = useState<PendingMove[]>([]);
  const [committedMoves, setCommittedMoves] = useState<Set<number>>(new Set());

  // Clear committed moves when epic changes (refresh happened)
  const epicId = epic.id;
  const prevEpicIdRef = useRef(epicId);

  useEffect(() => {
    // Only run when epicId actually changes, not on initial mount
    if (prevEpicIdRef.current !== epicId) {
      prevEpicIdRef.current = epicId;
      if (committedMoves.size > 0) {
        setPendingMoves((prev) =>
          prev.filter((m) => !committedMoves.has(m.taskNumber)),
        );
        setCommittedMoves(new Set());
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [epicId]);

  // Helper to find which batch a task belongs to
  const findTaskBatch = useCallback(
    (taskNumber: number): number | null => {
      for (const batch of epic.batches) {
        if (batch.tasks.some((t) => t.number === taskNumber)) {
          return batch.number;
        }
      }
      return null;
    },
    [epic],
  );

  // Handle drag start on a task
  const handleTaskDragStart = useCallback(
    (taskNumber: number, e: React.MouseEvent) => {
      if (!isMoveMode) return;
      const sourceBatchNumber = findTaskBatch(taskNumber);
      if (sourceBatchNumber === null) return;

      const taskId = findIssueIdByNumber(taskNumber);
      if (taskId === null) return;

      setDraggingTask({ taskNumber, taskId, sourceBatchNumber });
      setDragPosition({ x: e.clientX, y: e.clientY });
    },
    [isMoveMode, findTaskBatch, findIssueIdByNumber],
  );

  // Handle drag end (cancelled or completed)
  const handleTaskDragEnd = useCallback(() => {
    setDraggingTask(null);
    setDropTargetBatch(null);
    setDragPosition(null);
  }, []);

  // Handle drop on a batch - queue the move for later save
  const handleBatchDrop = useCallback(
    (batchNumber: number) => {
      if (!draggingTask) {
        handleTaskDragEnd();
        return;
      }

      // Don't allow dropping on the same batch
      if (batchNumber === draggingTask.sourceBatchNumber) {
        handleTaskDragEnd();
        return;
      }

      // Don't allow dropping on synthetic batches
      if (batchNumber <= 0) {
        handleTaskDragEnd();
        return;
      }

      // Check if there's already a pending move for this task
      const existingMoveIndex = pendingMoves.findIndex(
        (m) => m.taskNumber === draggingTask.taskNumber,
      );

      if (existingMoveIndex !== -1) {
        setPendingMoves((prev) => {
          const updated = [...prev];
          updated[existingMoveIndex] = {
            ...updated[existingMoveIndex],
            toBatchNumber: batchNumber,
          };
          // If moving back to original batch, remove the pending move
          if (batchNumber === updated[existingMoveIndex].fromBatchNumber) {
            updated.splice(existingMoveIndex, 1);
          }
          return updated;
        });
      } else {
        setPendingMoves((prev) => [
          ...prev,
          {
            taskNumber: draggingTask.taskNumber,
            taskId: draggingTask.taskId,
            fromBatchNumber: draggingTask.sourceBatchNumber,
            toBatchNumber: batchNumber,
          },
        ]);
      }

      handleTaskDragEnd();
    },
    [draggingTask, handleTaskDragEnd, pendingMoves],
  );

  // Cancel a pending move
  const handleCancelMove = useCallback((taskNumber: number) => {
    setPendingMoves((prev) => prev.filter((m) => m.taskNumber !== taskNumber));
  }, []);

  // Track mouse position to update drop target
  const handleCanvasMouseMove = useCallback(
    (e: React.MouseEvent) => {
      // Handle panning
      if (isPanning.current) {
        return;
      }

      // Update drop target based on mouse position when dragging
      if (!isMoveMode || !draggingTask || !layout) return;

      // Update drag position for ghost element
      setDragPosition({ x: e.clientX, y: e.clientY });

      const container = containerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const mouseX = (e.clientX - rect.left - transform.x) / transform.scale;
      const mouseY = (e.clientY - rect.top - transform.y) / transform.scale;

      // Find which batch the mouse is over
      let foundBatch: number | null = null;
      for (const batch of layout.batches) {
        if (
          mouseX >= batch.x &&
          mouseX <= batch.x + batch.width &&
          mouseY >= batch.y &&
          mouseY <= batch.y + batch.height
        ) {
          // Don't allow dropping on synthetic batches or the source batch
          if (
            batch.batchNumber > 0 &&
            batch.batchNumber !== draggingTask.sourceBatchNumber
          ) {
            foundBatch = batch.batchNumber;
          }
          break;
        }
      }

      setDropTargetBatch(foundBatch);
    },
    [isMoveMode, draggingTask, layout, transform, containerRef, isPanning],
  );

  // Clear all move changes
  const clearMoveChanges = useCallback(() => {
    setPendingMoves([]);
    setDraggingTask(null);
    setDropTargetBatch(null);
    setDragPosition(null);
  }, []);

  return {
    draggingTask,
    dropTargetBatch,
    dragPosition,
    pendingMoves,
    committedMoves,
    handleTaskDragStart,
    handleTaskDragEnd,
    handleBatchDrop,
    handleCancelMove,
    handleCanvasMouseMove,
    setPendingMoves,
    setCommittedMoves,
    clearMoveChanges,
  };
}
