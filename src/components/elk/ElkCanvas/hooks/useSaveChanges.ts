/**
 * useSaveChanges Hook
 *
 * Handles saving relationship and move changes to GitHub.
 */

import { useState, useCallback, useMemo } from "react";
import { Epic } from "@/types";
import { GitHubApi } from "@/lib/github";
import { SaveResult, EdgeChange, PendingMove } from "../types";

interface UseSaveChangesOptions {
  epic: Epic;
  api?: GitHubApi;
  onSave?: (result: SaveResult) => void;
  // Edge state
  pendingEdges: EdgeChange[];
  removedEdges: Set<string>;
  pendingBatchEdges: EdgeChange[];
  removedBatchEdges: Set<string>;
  originalEdges: Set<string>;
  originalBatchEdges: Set<string>;
  // Move state
  pendingMoves: PendingMove[];
  committedMoves: Set<number>;
  // Setters for clearing state
  setPendingEdges: React.Dispatch<React.SetStateAction<EdgeChange[]>>;
  setRemovedEdges: React.Dispatch<React.SetStateAction<Set<string>>>;
  setPendingBatchEdges: React.Dispatch<React.SetStateAction<EdgeChange[]>>;
  setRemovedBatchEdges: React.Dispatch<React.SetStateAction<Set<string>>>;
  setEditModeSourceTask: React.Dispatch<React.SetStateAction<number | null>>;
  setEditModeSourceBatch: React.Dispatch<React.SetStateAction<number | null>>;
  setCommittedMoves: React.Dispatch<React.SetStateAction<Set<number>>>;
  setPendingMoves: React.Dispatch<React.SetStateAction<PendingMove[]>>;
}

interface UseSaveChangesReturn {
  isSaving: boolean;
  hasChanges: boolean;
  handleSave: () => Promise<void>;
  handleClearChanges: () => void;
}

export function useSaveChanges({
  epic,
  api,
  onSave,
  pendingEdges,
  removedEdges,
  pendingBatchEdges,
  removedBatchEdges,
  originalEdges,
  originalBatchEdges,
  pendingMoves,
  committedMoves,
  setPendingEdges,
  setRemovedEdges,
  setPendingBatchEdges,
  setRemovedBatchEdges,
  setEditModeSourceTask,
  setEditModeSourceBatch,
  setCommittedMoves,
  setPendingMoves,
}: UseSaveChangesOptions): UseSaveChangesReturn {
  const [isSaving, setIsSaving] = useState(false);

  // Helper to find an issue by number and get its ID
  const findIssueIdByNumber = useCallback(
    (issueNumber: number): number | null => {
      if (epic.number === issueNumber) {
        return epic.id;
      }
      for (const batch of epic.batches) {
        if (batch.number === issueNumber) {
          return batch.id;
        }
        for (const task of batch.tasks) {
          if (task.number === issueNumber) {
            return task.id;
          }
        }
      }
      return null;
    },
    [epic],
  );

  // Check if there are actual changes compared to original state
  const hasChanges = useMemo(() => {
    // Build current task edge set from original + pending - removed
    const currentEdges = new Set<string>();

    for (const edge of originalEdges) {
      if (!removedEdges.has(edge)) {
        currentEdges.add(edge);
      }
    }

    for (const pending of pendingEdges) {
      const edgeId = `edge-${pending.from}-${pending.to}`;
      currentEdges.add(edgeId);
    }

    // Check task edge changes
    if (currentEdges.size !== originalEdges.size) {
      return true;
    }

    for (const edge of originalEdges) {
      if (!currentEdges.has(edge)) {
        return true;
      }
    }

    for (const edge of currentEdges) {
      if (!originalEdges.has(edge)) {
        return true;
      }
    }

    // Build current batch edge set from original + pending - removed
    const currentBatchEdges = new Set<string>();

    for (const edge of originalBatchEdges) {
      if (!removedBatchEdges.has(edge)) {
        currentBatchEdges.add(edge);
      }
    }

    for (const pending of pendingBatchEdges) {
      const edgeId = `batch-edge-${pending.from}-${pending.to}`;
      currentBatchEdges.add(edgeId);
    }

    // Check batch edge changes
    if (currentBatchEdges.size !== originalBatchEdges.size) {
      return true;
    }

    for (const edge of originalBatchEdges) {
      if (!currentBatchEdges.has(edge)) {
        return true;
      }
    }

    for (const edge of currentBatchEdges) {
      if (!originalBatchEdges.has(edge)) {
        return true;
      }
    }

    // Check for pending moves (exclude committed ones since they've been saved)
    const uncommittedMoves = pendingMoves.filter(
      (m) => !committedMoves.has(m.taskNumber),
    );
    if (uncommittedMoves.length > 0) {
      return true;
    }

    return false;
  }, [
    originalEdges,
    pendingEdges,
    removedEdges,
    originalBatchEdges,
    pendingBatchEdges,
    removedBatchEdges,
    pendingMoves,
    committedMoves,
  ]);

  // Handle save button click
  const handleSave = useCallback(async () => {
    if (!api) {
      console.error("Cannot save: No API instance provided");
      onSave?.({
        success: false,
        addedCount: 0,
        removedCount: 0,
        errors: ["No API instance provided. Please sign in to save changes."],
        addedTaskEdges: [],
        addedBatchEdges: [],
        removedTaskEdges: [],
        removedBatchEdges: [],
      });
      return;
    }

    setIsSaving(true);
    const errors: string[] = [];
    let addedCount = 0;
    let removedCount = 0;

    const successfullyAddedTaskEdges: { from: number; to: number }[] = [];
    const successfullyAddedBatchEdges: { from: number; to: number }[] = [];
    const successfullyRemovedTaskEdges: { from: number; to: number }[] = [];
    const successfullyRemovedBatchEdges: { from: number; to: number }[] = [];

    try {
      // Process added task edges
      for (const pending of pendingEdges) {
        const blockingIssueId = findIssueIdByNumber(pending.from);
        if (!blockingIssueId) {
          errors.push(`Could not find issue ID for task #${pending.from}`);
          continue;
        }

        try {
          await api.addDependency(
            epic.owner,
            epic.repo,
            pending.to,
            blockingIssueId,
          );
          addedCount++;
          successfullyAddedTaskEdges.push({
            from: pending.from,
            to: pending.to,
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : "Unknown error";
          errors.push(
            `Failed to add dependency: #${pending.to} blocked by #${pending.from} - ${message}`,
          );
        }
      }

      // Process added batch edges
      for (const pending of pendingBatchEdges) {
        const blockingIssueId = findIssueIdByNumber(pending.from);
        if (!blockingIssueId) {
          errors.push(`Could not find issue ID for batch #${pending.from}`);
          continue;
        }

        try {
          await api.addDependency(
            epic.owner,
            epic.repo,
            pending.to,
            blockingIssueId,
          );
          addedCount++;
          successfullyAddedBatchEdges.push({
            from: pending.from,
            to: pending.to,
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : "Unknown error";
          errors.push(
            `Failed to add batch dependency: #${pending.to} blocked by #${pending.from} - ${message}`,
          );
        }
      }

      // Process removed task edges
      for (const edgeId of removedEdges) {
        const match = edgeId.match(/^edge-(\d+)-(\d+)$/);
        if (!match) continue;

        const dependencyNumber = parseInt(match[1], 10);
        const dependentNumber = parseInt(match[2], 10);

        const blockingIssueId = findIssueIdByNumber(dependencyNumber);
        if (!blockingIssueId) {
          errors.push(`Could not find issue ID for task #${dependencyNumber}`);
          continue;
        }

        try {
          await api.removeDependency(
            epic.owner,
            epic.repo,
            dependentNumber,
            blockingIssueId,
          );
          removedCount++;
          successfullyRemovedTaskEdges.push({
            from: dependencyNumber,
            to: dependentNumber,
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : "Unknown error";
          errors.push(
            `Failed to remove dependency: #${dependentNumber} blocked by #${dependencyNumber} - ${message}`,
          );
        }
      }

      // Process removed batch edges
      for (const edgeId of removedBatchEdges) {
        const match = edgeId.match(/^batch-edge-(\d+)-(\d+)$/);
        if (!match) continue;

        const dependencyNumber = parseInt(match[1], 10);
        const dependentNumber = parseInt(match[2], 10);

        const blockingIssueId = findIssueIdByNumber(dependencyNumber);
        if (!blockingIssueId) {
          errors.push(`Could not find issue ID for batch #${dependencyNumber}`);
          continue;
        }

        try {
          await api.removeDependency(
            epic.owner,
            epic.repo,
            dependentNumber,
            blockingIssueId,
          );
          removedCount++;
          successfullyRemovedBatchEdges.push({
            from: dependencyNumber,
            to: dependentNumber,
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : "Unknown error";
          errors.push(
            `Failed to remove batch dependency: #${dependentNumber} blocked by #${dependencyNumber} - ${message}`,
          );
        }
      }

      // Process pending moves
      const successfullyMovedTasks: number[] = [];
      for (const move of pendingMoves) {
        try {
          await api.addSubIssue(
            epic.owner,
            epic.repo,
            move.toBatchNumber,
            move.taskId,
            true,
          );
          addedCount++;
          successfullyMovedTasks.push(move.taskNumber);
        } catch (err) {
          const message = err instanceof Error ? err.message : "Unknown error";
          errors.push(
            `Failed to move issue #${move.taskNumber} to batch #${move.toBatchNumber}: ${message}`,
          );
        }
      }

      // Clear only successfully saved edges
      setPendingEdges((prev) =>
        prev.filter(
          (e) =>
            !successfullyAddedTaskEdges.some(
              (s) => s.from === e.from && s.to === e.to,
            ),
        ),
      );
      setPendingBatchEdges((prev) =>
        prev.filter(
          (e) =>
            !successfullyAddedBatchEdges.some(
              (s) => s.from === e.from && s.to === e.to,
            ),
        ),
      );

      if (successfullyMovedTasks.length > 0) {
        setCommittedMoves((prev) => {
          const next = new Set(prev);
          for (const taskNumber of successfullyMovedTasks) {
            next.add(taskNumber);
          }
          return next;
        });
      }

      setRemovedEdges((prev) => {
        const next = new Set(prev);
        for (const edge of successfullyRemovedTaskEdges) {
          next.delete(`edge-${edge.from}-${edge.to}`);
        }
        return next;
      });
      setRemovedBatchEdges((prev) => {
        const next = new Set(prev);
        for (const edge of successfullyRemovedBatchEdges) {
          next.delete(`batch-edge-${edge.from}-${edge.to}`);
        }
        return next;
      });

      setEditModeSourceTask(null);
      setEditModeSourceBatch(null);

      const result: SaveResult = {
        success: errors.length === 0,
        addedCount,
        removedCount,
        errors,
        addedTaskEdges: successfullyAddedTaskEdges,
        addedBatchEdges: successfullyAddedBatchEdges,
        removedTaskEdges: successfullyRemovedTaskEdges,
        removedBatchEdges: successfullyRemovedBatchEdges,
      };

      onSave?.(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      errors.push(`Save operation failed: ${message}`);
      onSave?.({
        success: false,
        addedCount,
        removedCount,
        errors,
        addedTaskEdges: successfullyAddedTaskEdges,
        addedBatchEdges: successfullyAddedBatchEdges,
        removedTaskEdges: successfullyRemovedTaskEdges,
        removedBatchEdges: successfullyRemovedBatchEdges,
      });
    } finally {
      setIsSaving(false);
    }
  }, [
    api,
    epic,
    pendingEdges,
    pendingBatchEdges,
    pendingMoves,
    removedEdges,
    removedBatchEdges,
    findIssueIdByNumber,
    onSave,
    setPendingEdges,
    setPendingBatchEdges,
    setRemovedEdges,
    setRemovedBatchEdges,
    setEditModeSourceTask,
    setEditModeSourceBatch,
    setCommittedMoves,
  ]);

  // Handle clear changes
  const handleClearChanges = useCallback(() => {
    setPendingEdges([]);
    setRemovedEdges(new Set());
    setEditModeSourceTask(null);
    setPendingBatchEdges([]);
    setRemovedBatchEdges(new Set());
    setEditModeSourceBatch(null);
    setPendingMoves([]);
  }, [
    setPendingEdges,
    setRemovedEdges,
    setEditModeSourceTask,
    setPendingBatchEdges,
    setRemovedBatchEdges,
    setEditModeSourceBatch,
    setPendingMoves,
  ]);

  return {
    isSaving,
    hasChanges,
    handleSave,
    handleClearChanges,
  };
}
