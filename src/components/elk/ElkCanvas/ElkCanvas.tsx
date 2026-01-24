/**
 * ElkCanvas Component
 *
 * Main visualization canvas that renders the Epic diagram using ELK layout.
 * Uses SVG for rendering with custom styling and interactivity.
 */

"use client";

import { useRef, useCallback, useMemo, useEffect } from "react";
import { Task } from "@/types";
import { DEFAULT_ELK_CONFIG } from "@/lib/elk";

// Context
import { useEpicContext } from "./context";

// Hooks
import {
  useCanvasTransform,
  useEdgeEditing,
  useTaskMovement,
  useSaveChanges,
  useModifiedEpic,
  useLayoutCalculation,
  useHighlighting,
  useExport,
} from "./hooks";

// Subcomponents
import {
  SvgMarkerDefs,
  CanvasControls,
  CanvasActionBar,
  EditModeHint,
  MoveModeHint,
  DragGhostElement,
  ExportContainer,
} from "./components";

// Shared components
import { ElkBatchGroup } from "../ElkBatchGroup";
import { ElkTaskNode } from "../ElkTaskNode";
import { ElkEdges } from "../ElkEdges";

// Types
import { ElkCanvasProps } from "./types";

// Re-export types for external use
export type { SaveResult, ElkCanvasProps } from "./types";

// Inner component that consumes the tool context
function ElkCanvasInner({
  epic,
  config = DEFAULT_ELK_CONFIG,
  onTaskClick,
  onSave,
  api,
  className = "",
}: ElkCanvasProps) {
  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const exportRef = useRef<HTMLDivElement>(null);

  // State from context
  const { isEditMode, isMoveMode, registerToolChangeCallback, setIsExporting } =
    useEpicContext();

  // Canvas transform (pan/zoom)
  const {
    transform,
    cursorStyle,
    isPanning,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleMouseLeave,
    handleResetView,
    handleFitToView,
  } = useCanvasTransform({ containerRef });

  // Helper to find issue ID by number
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

  // Edge editing state (layout will be passed once available)
  const edgeEditing = useEdgeEditing({
    epic,
    layout: null, // We'll use local handlers that access layout via closure
    isEditMode,
  });

  const {
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
  } = edgeEditing;

  // Task movement
  const taskMovement = useTaskMovement({
    epic,
    layout: null, // We'll pass layout via closure in handlers
    isMoveMode,
    containerRef,
    transform,
    isPanning,
    findIssueIdByNumber,
  });

  const {
    draggingTask,
    dropTargetBatch,
    dragPosition,
    pendingMoves,
    committedMoves,
    handleTaskDragStart,
    handleTaskDragEnd,
    handleBatchDrop,
    handleCancelMove,
  } = taskMovement;

  // Create modified epic including all pending changes for layout
  const modifiedEpic = useModifiedEpic({
    epic,
    pendingEdges,
    removedEdges,
    pendingBatchEdges,
    removedBatchEdges,
    pendingMoves,
  });

  // Layout calculation
  const { layout, isLoading, error } = useLayoutCalculation({
    epic: modifiedEpic,
    config,
  });

  // Get visible edges (computed from layout and removed edges)
  const visibleEdges = useMemo(() => {
    if (!layout) return [];
    return layout.edges.filter((edge) => {
      if (edge.isBatchEdge) {
        return !removedBatchEdges.has(edge.id);
      }
      return !removedEdges.has(edge.id);
    });
  }, [layout, removedEdges, removedBatchEdges]);

  // Highlighting
  const {
    highlightedTask,
    setHighlightedTask,
    highlightedEdges,
    relatedTasks,
    highlightedBatch,
    setHighlightedBatch,
    highlightedBatchEdges,
    relatedBatches,
  } = useHighlighting({ layout });

  // Save changes
  const { isSaving, hasChanges, handleSave, handleClearChanges } =
    useSaveChanges({
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
      setCommittedMoves: taskMovement.setCommittedMoves,
      setPendingMoves: taskMovement.setPendingMoves,
    });

  // Canvas mouse move handler for drag target detection
  // This delegates to the taskMovement hook which handles the logic
  const handleCanvasMouseMove = taskMovement.handleCanvasMouseMove;

  // Find task data helper
  const findTask = useCallback(
    (taskNumber: number): Task | undefined => {
      for (const batch of epic.batches) {
        const task = batch.tasks.find((t) => t.number === taskNumber);
        if (task) return task;
      }
      return undefined;
    },
    [epic],
  );

  // Handle task click - different behavior based on mode
  const handleTaskClick = useCallback(
    (taskNumber: number) => {
      if (isEditMode) {
        // Clear any batch source selection when clicking a task
        setEditModeSourceBatch(null);

        if (editModeSourceTask === null) {
          setEditModeSourceTask(taskNumber);
        } else if (editModeSourceTask === taskNumber) {
          setEditModeSourceTask(null);
        } else {
          const edgeId = `edge-${editModeSourceTask}-${taskNumber}`;

          if (removedEdges.has(edgeId)) {
            setRemovedEdges((prev) => {
              const next = new Set(prev);
              next.delete(edgeId);
              return next;
            });
            setEditModeSourceTask(null);
            return;
          }

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
      } else {
        const task = findTask(taskNumber);
        if (task && onTaskClick) {
          onTaskClick(task);
        }
      }
    },
    [
      isEditMode,
      editModeSourceTask,
      findTask,
      onTaskClick,
      layout,
      pendingEdges,
      removedEdges,
      setEditModeSourceTask,
      setEditModeSourceBatch,
      setPendingEdges,
      setRemovedEdges,
    ],
  );

  // Handle edge click in edit mode
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
    [
      isEditMode,
      pendingEdges,
      pendingBatchEdges,
      setPendingEdges,
      setPendingBatchEdges,
      setRemovedEdges,
      setRemovedBatchEdges,
    ],
  );

  // Handle batch click
  const handleBatchClick = useCallback(
    (batchNumber: number) => {
      if (!isEditMode || batchNumber <= 0) {
        return;
      }

      setEditModeSourceTask(null);

      if (editModeSourceBatch === batchNumber) {
        setEditModeSourceBatch(null);
      } else if (editModeSourceBatch === null) {
        setEditModeSourceBatch(batchNumber);
      } else {
        const edgeId = `batch-edge-${editModeSourceBatch}-${batchNumber}`;

        if (removedBatchEdges.has(edgeId)) {
          setRemovedBatchEdges((prev) => {
            const next = new Set(prev);
            next.delete(edgeId);
            return next;
          });
          setEditModeSourceBatch(null);
          return;
        }

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
      setEditModeSourceTask,
      setEditModeSourceBatch,
      setPendingBatchEdges,
      setRemovedBatchEdges,
    ],
  );

  // Extract for stable reference in useEffect
  const onToolChangeCleanup = taskMovement.handleTaskDragEnd;

  // Register cleanup callback for tool changes
  useEffect(() => {
    registerToolChangeCallback(() => {
      setEditModeSourceTask(null);
      setEditModeSourceBatch(null);
      onToolChangeCleanup();
    });
  }, [
    registerToolChangeCallback,
    setEditModeSourceTask,
    setEditModeSourceBatch,
    onToolChangeCleanup,
  ]);

  // Export functionality
  const { handleExport } = useExport({
    exportRef,
    layout,
    epicTitle: epic.title,
    setIsExporting,
  });

  // Loading state
  if (isLoading) {
    return (
      <div className={`flex items-center justify-center h-full ${className}`}>
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Calculating layout...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={`flex items-center justify-center h-full ${className}`}>
        <div className="text-center">
          <p className="text-destructive font-medium">Layout Error</p>
          <p className="text-sm text-muted-foreground mt-1">{error}</p>
        </div>
      </div>
    );
  }

  if (!layout) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden bg-background ${className}`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      style={{ cursor: cursorStyle }}
    >
      {/* Controls */}
      <CanvasControls
        transform={transform}
        onFitToView={() => handleFitToView(layout)}
        onResetView={handleResetView}
      />

      {/* Action Bar */}
      <CanvasActionBar
        hasChanges={hasChanges}
        isSaving={isSaving}
        onSave={handleSave}
        onClearChanges={handleClearChanges}
        onExport={handleExport}
      />

      {/* Edit mode hint */}
      {isEditMode && (
        <EditModeHint
          editModeSourceTask={editModeSourceTask}
          editModeSourceBatch={editModeSourceBatch}
        />
      )}

      {/* Move mode hint */}
      {isMoveMode && (
        <MoveModeHint
          draggingTask={draggingTask}
          pendingMoves={pendingMoves}
          committedMoves={committedMoves}
        />
      )}

      {/* Dragging Ghost Element */}
      {draggingTask &&
        dragPosition &&
        (() => {
          const draggedTask = findTask(draggingTask.taskNumber);
          if (!draggedTask) return null;
          return (
            <DragGhostElement task={draggedTask} position={dragPosition} />
          );
        })()}

      {/* SVG Canvas */}
      <svg
        width={layout.canvasWidth}
        height={layout.canvasHeight}
        viewBox={`0 0 ${layout.canvasWidth} ${layout.canvasHeight}`}
        className="absolute"
        style={{
          transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
          transformOrigin: "0 0",
        }}
        onMouseMove={handleCanvasMouseMove}
        onMouseUp={() => {
          if (draggingTask && dropTargetBatch) {
            handleBatchDrop(dropTargetBatch);
          } else {
            handleTaskDragEnd();
          }
        }}
        onMouseLeave={handleTaskDragEnd}
      >
        <SvgMarkerDefs />

        {/* Batch-to-batch edges */}
        <ElkEdges
          edges={visibleEdges}
          highlightedEdges={highlightedEdges}
          hasHighlightedTask={highlightedTask !== null && relatedTasks.size > 1}
          isEditMode={isEditMode}
          onEdgeClick={handleEdgeClick}
          batchEdgesOnly={true}
          pendingEdgeIds={pendingEdgeIds}
          highlightedBatchEdges={highlightedBatchEdges}
          hasHighlightedBatch={
            highlightedBatch !== null && relatedBatches.size > 1
          }
        />

        {/* Batch groups */}
        {layout.batches.map((batch) => (
          <ElkBatchGroup
            key={batch.id}
            batch={batch}
            isDimmed={
              !isEditMode &&
              !isMoveMode &&
              highlightedBatch !== null &&
              relatedBatches.size > 1 &&
              !relatedBatches.has(batch.batchNumber)
            }
            isRelatedBatch={
              !isEditMode &&
              !isMoveMode &&
              highlightedBatch !== null &&
              relatedBatches.has(batch.batchNumber) &&
              highlightedBatch !== batch.batchNumber
            }
            isEditMode={isEditMode}
            isEditModeSelected={editModeSourceBatch === batch.batchNumber}
            isMoveMode={isMoveMode}
            isDragActive={draggingTask !== null}
            isDropTarget={dropTargetBatch === batch.batchNumber}
            onClick={handleBatchClick}
            onDrop={handleBatchDrop}
            onHover={setHighlightedBatch}
            owner={epic.owner}
            repo={epic.repo}
          />
        ))}

        {/* Task edges */}
        <ElkEdges
          edges={visibleEdges}
          highlightedEdges={highlightedEdges}
          hasHighlightedTask={highlightedTask !== null && relatedTasks.size > 1}
          isEditMode={isEditMode}
          onEdgeClick={handleEdgeClick}
          taskEdgesOnly={true}
          pendingEdgeIds={pendingEdgeIds}
          highlightedBatchEdges={highlightedBatchEdges}
          hasHighlightedBatch={
            highlightedBatch !== null && relatedBatches.size > 1
          }
        />

        {/* Task nodes */}
        {layout.tasks.map((task) => {
          const pendingMoveForTask = pendingMoves.find(
            (m) => m.taskNumber === task.taskNumber,
          );
          return (
            <ElkTaskNode
              key={task.id}
              task={task}
              isHighlighted={
                !isEditMode &&
                !isMoveMode &&
                highlightedTask === task.taskNumber
              }
              isRelated={
                !isEditMode &&
                !isMoveMode &&
                relatedTasks.has(task.taskNumber) &&
                highlightedTask !== task.taskNumber
              }
              isDimmed={
                !isEditMode &&
                !isMoveMode &&
                ((highlightedTask !== null &&
                  relatedTasks.size > 1 &&
                  !relatedTasks.has(task.taskNumber)) ||
                  (highlightedBatch !== null &&
                    relatedBatches.size > 1 &&
                    !relatedBatches.has(task.batchNumber)))
              }
              isEditModeSelected={editModeSourceTask === task.taskNumber}
              isEditMode={isEditMode}
              isMoveMode={isMoveMode}
              isDragging={draggingTask?.taskNumber === task.taskNumber}
              pendingMove={
                pendingMoveForTask
                  ? {
                      fromBatchNumber: pendingMoveForTask.fromBatchNumber,
                      isCommitted: committedMoves.has(
                        pendingMoveForTask.taskNumber,
                      ),
                    }
                  : null
              }
              onHover={setHighlightedTask}
              onClick={handleTaskClick}
              onDragStart={handleTaskDragStart}
              onDragEnd={handleTaskDragEnd}
              onCancelMove={handleCancelMove}
            />
          );
        })}
      </svg>

      {/* Hidden Export Container */}
      <ExportContainer
        exportRef={exportRef}
        layout={layout}
        visibleEdges={visibleEdges}
        owner={epic.owner}
        repo={epic.repo}
      />
    </div>
  );
}

/**
 * ElkCanvas Component
 *
 * Main visualization canvas for Epic diagrams.
 * Must be wrapped with EpicProvider at the page level.
 */
export { ElkCanvasInner as ElkCanvas };
