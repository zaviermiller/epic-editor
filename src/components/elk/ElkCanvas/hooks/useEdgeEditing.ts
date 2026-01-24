/**
 * useEdgeEditing Hook
 *
 * Manages state and handlers for editing task and batch edges/relationships.
 */

import { useState, useCallback, useMemo } from "react";
import { Epic } from "@/types";
import { ElkLayoutResult } from "@/lib/elk";
import { EdgeChange } from "../types";

interface UseEdgeEditingOptions {
  epic: Epic;
  layout: ElkLayoutResult | null;
  isEditMode: boolean;
}

interface UseEdgeEditingReturn {
  // Task edge state
  editModeSourceTask: number | null;
  setEditModeSourceTask: React.Dispatch<React.SetStateAction<number | null>>;
  pendingEdges: EdgeChange[];
  setPendingEdges: React.Dispatch<React.SetStateAction<EdgeChange[]>>;
  removedEdges: Set<string>;
  setRemovedEdges: React.Dispatch<React.SetStateAction<Set<string>>>;

  // Batch edge state
  editModeSourceBatch: number | null;
  setEditModeSourceBatch: React.Dispatch<React.SetStateAction<number | null>>;
  pendingBatchEdges: EdgeChange[];
  setPendingBatchEdges: React.Dispatch<React.SetStateAction<EdgeChange[]>>;
  removedBatchEdges: Set<string>;
  setRemovedBatchEdges: React.Dispatch<React.SetStateAction<Set<string>>>;

  // Computed values
  originalEdges: Set<string>;
  originalBatchEdges: Set<string>;
  pendingEdgeIds: Set<string>;
  visibleEdges: ElkLayoutResult["edges"];

  // Handlers
  handleTaskClick: (taskNumber: number) => void;
  handleBatchClick: (batchNumber: number) => void;
  handleEdgeClick: (edge: {
    id: string;
    from: number;
    to: number;
    isBatchEdge?: boolean;
  }) => void;

  // Reset
  clearEdgeChanges: () => void;
}

export function useEdgeEditing({
  epic,
  layout,
  isEditMode,
}: UseEdgeEditingOptions): UseEdgeEditingReturn {
  // Task edge state
  const [editModeSourceTask, setEditModeSourceTask] = useState<number | null>(
    null,
  );
  const [pendingEdges, setPendingEdges] = useState<EdgeChange[]>([]);
  const [removedEdges, setRemovedEdges] = useState<Set<string>>(new Set());

  // Batch edge state
  const [editModeSourceBatch, setEditModeSourceBatch] = useState<number | null>(
    null,
  );
  const [pendingBatchEdges, setPendingBatchEdges] = useState<EdgeChange[]>([]);
  const [removedBatchEdges, setRemovedBatchEdges] = useState<Set<string>>(
    new Set(),
  );

  // Compute original task edges from the epic for comparison
  const originalEdges = useMemo(() => {
    const edges = new Set<string>();
    for (const dep of epic.dependencies) {
      // Edge ID format: "edge-{dependency}-{dependent}" where dependent depends on dependency
      // In Dependency type, "from" is the dependent, "to" is the dependency
      edges.add(`edge-${dep.to}-${dep.from}`);
    }
    return edges;
  }, [epic.dependencies]);

  // Compute original batch edges from the epic for comparison
  const originalBatchEdges = useMemo(() => {
    const edges = new Set<string>();
    for (const batch of epic.batches) {
      for (const depBatchNum of batch.dependsOn) {
        // Batch edge ID format: "batch-edge-{dependency}-{dependent}"
        edges.add(`batch-edge-${depBatchNum}-${batch.number}`);
      }
    }
    return edges;
  }, [epic.batches]);

  // Get set of pending edge IDs for styling
  const pendingEdgeIds = useMemo(() => {
    const ids = new Set<string>();
    for (const pending of pendingEdges) {
      ids.add(`edge-${pending.from}-${pending.to}`);
    }
    for (const pending of pendingBatchEdges) {
      ids.add(`batch-edge-${pending.from}-${pending.to}`);
    }
    return ids;
  }, [pendingEdges, pendingBatchEdges]);

  // Get filtered edges (excluding removed ones)
  const visibleEdges = useMemo(() => {
    if (!layout) return [];
    return layout.edges.filter((edge) => {
      if (edge.isBatchEdge) {
        return !removedBatchEdges.has(edge.id);
      }
      return !removedEdges.has(edge.id);
    });
  }, [layout, removedEdges, removedBatchEdges]);

  // Handle task click in edit mode
  const handleTaskClick = useCallback(
    (taskNumber: number) => {
      if (!isEditMode) return;

      // Clear any batch source selection when clicking a task
      setEditModeSourceBatch(null);

      if (editModeSourceTask === null) {
        // First click - select source task
        setEditModeSourceTask(taskNumber);
      } else if (editModeSourceTask === taskNumber) {
        // Clicked same task - deselect
        setEditModeSourceTask(null);
      } else {
        // Second click on different task - create relationship
        const edgeId = `edge-${editModeSourceTask}-${taskNumber}`;

        // Check if this edge was previously removed - if so, undo the removal
        if (removedEdges.has(edgeId)) {
          setRemovedEdges((prev) => {
            const next = new Set(prev);
            next.delete(edgeId);
            return next;
          });
          setEditModeSourceTask(null);
          return;
        }

        // Check if this edge already exists or is pending
        const existingEdge = layout?.edges.find(
          (e) =>
            e.from === editModeSourceTask &&
            e.to === taskNumber &&
            !e.isBatchEdge,
        );
        const pendingExists = pendingEdges.some(
          (e) => e.from === editModeSourceTask && e.to === taskNumber,
        );

        if (!existingEdge && !pendingExists) {
          setPendingEdges((prev) => [
            ...prev,
            { from: editModeSourceTask, to: taskNumber },
          ]);
        }
        setEditModeSourceTask(null);
      }
    },
    [isEditMode, editModeSourceTask, layout, pendingEdges, removedEdges],
  );

  // Handle batch click in edit mode
  const handleBatchClick = useCallback(
    (batchNumber: number) => {
      // Synthetic batches (number <= 0) can't have dependencies edited
      if (!isEditMode || batchNumber <= 0) {
        return;
      }

      // Clear any task source selection when clicking a batch
      setEditModeSourceTask(null);

      if (editModeSourceBatch === batchNumber) {
        // Clicked same batch - deselect
        setEditModeSourceBatch(null);
      } else if (editModeSourceBatch === null) {
        // First click - select source batch
        setEditModeSourceBatch(batchNumber);
      } else {
        // Second click on different batch - complete the relationship
        const edgeId = `batch-edge-${editModeSourceBatch}-${batchNumber}`;

        // Check if this edge was previously removed - if so, undo the removal
        if (removedBatchEdges.has(edgeId)) {
          setRemovedBatchEdges((prev) => {
            const next = new Set(prev);
            next.delete(edgeId);
            return next;
          });
          setEditModeSourceBatch(null);
          return;
        }

        // Check if this edge already exists or is pending
        const existingEdge = layout?.edges.find(
          (e) =>
            e.from === editModeSourceBatch &&
            e.to === batchNumber &&
            e.isBatchEdge,
        );
        const pendingExists = pendingBatchEdges.some(
          (e) => e.from === editModeSourceBatch && e.to === batchNumber,
        );

        if (!existingEdge && !pendingExists) {
          setPendingBatchEdges((prev) => [
            ...prev,
            { from: editModeSourceBatch, to: batchNumber },
          ]);
        }
        setEditModeSourceBatch(null);
      }
    },
    [
      isEditMode,
      editModeSourceBatch,
      layout,
      pendingBatchEdges,
      removedBatchEdges,
    ],
  );

  // Handle edge click in edit mode - remove the relationship
  const handleEdgeClick = useCallback(
    (edge: { id: string; from: number; to: number; isBatchEdge?: boolean }) => {
      if (!isEditMode) return;

      if (edge.isBatchEdge) {
        const pendingIndex = pendingBatchEdges.findIndex(
          (e) => e.from === edge.from && e.to === edge.to,
        );

        if (pendingIndex !== -1) {
          setPendingBatchEdges((prev) =>
            prev.filter((_, i) => i !== pendingIndex),
          );
        } else {
          setRemovedBatchEdges((prev) => new Set(prev).add(edge.id));
        }
      } else {
        const pendingIndex = pendingEdges.findIndex(
          (e) => e.from === edge.from && e.to === edge.to,
        );

        if (pendingIndex !== -1) {
          setPendingEdges((prev) => prev.filter((_, i) => i !== pendingIndex));
        } else {
          setRemovedEdges((prev) => new Set(prev).add(edge.id));
        }
      }
    },
    [isEditMode, pendingEdges, pendingBatchEdges],
  );

  // Clear all edge changes
  const clearEdgeChanges = useCallback(() => {
    setPendingEdges([]);
    setRemovedEdges(new Set());
    setEditModeSourceTask(null);
    setPendingBatchEdges([]);
    setRemovedBatchEdges(new Set());
    setEditModeSourceBatch(null);
  }, []);

  return {
    editModeSourceTask,
    setEditModeSourceTask,
    pendingEdges,
    setPendingEdges,
    removedEdges,
    setRemovedEdges,
    editModeSourceBatch,
    setEditModeSourceBatch,
    pendingBatchEdges,
    setPendingBatchEdges,
    removedBatchEdges,
    setRemovedBatchEdges,
    originalEdges,
    originalBatchEdges,
    pendingEdgeIds,
    visibleEdges,
    handleTaskClick,
    handleBatchClick,
    handleEdgeClick,
    clearEdgeChanges,
  };
}
