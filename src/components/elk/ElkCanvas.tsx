/**
 * ElkCanvas Component
 *
 * Main visualization canvas that renders the Epic diagram using ELK layout.
 * Uses SVG for rendering with custom styling and interactivity.
 */

"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { Epic, Task } from "@/types";
import {
  calculateElkLayout,
  routeEdges,
  ElkLayoutResult,
  ElkLayoutConfig,
  DEFAULT_ELK_CONFIG,
} from "@/lib/elk";
import { ElkBatchGroup } from "./ElkBatchGroup";
import { ElkTaskNode } from "./ElkTaskNode";
import { ElkEdges } from "./ElkEdges";
import { CanvasToolbar, ToolType } from "./CanvasToolbar";

interface ElkCanvasProps {
  /** Epic to visualize */
  epic: Epic;
  /** Layout configuration */
  config?: ElkLayoutConfig;
  /** Callback when a task is clicked */
  onTaskClick?: (task: Task) => void;
  /** Class name for the container */
  className?: string;
}

/**
 * Transform state for pan and zoom
 */
interface TransformState {
  x: number;
  y: number;
  scale: number;
}

export function ElkCanvas({
  epic,
  config = DEFAULT_ELK_CONFIG,
  onTaskClick,
  className = "",
}: ElkCanvasProps) {
  // Layout state
  const [layout, setLayout] = useState<ElkLayoutResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Interaction state
  const [highlightedTask, setHighlightedTask] = useState<number | null>(null);
  const [activeTool, setActiveTool] = useState<ToolType>("select");
  const [cursorStyle, setCursorStyle] = useState<"grab" | "grabbing">("grab");
  const [transform, setTransform] = useState<TransformState>({
    x: 0,
    y: 0,
    scale: 1,
  });

  // Edit mode state
  const [editModeSourceTask, setEditModeSourceTask] = useState<number | null>(
    null,
  );
  const [pendingEdges, setPendingEdges] = useState<
    { from: number; to: number }[]
  >([]);
  const [removedEdges, setRemovedEdges] = useState<Set<string>>(new Set());

  const isEditMode = activeTool === "edit-relationships";

  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const isPanning = useRef(false);
  const lastMousePos = useRef({ x: 0, y: 0 });

  // Calculate layout when epic changes
  useEffect(() => {
    let cancelled = false;

    async function runLayout() {
      setIsLoading(true);
      setError(null);

      try {
        const result = await calculateElkLayout(epic, config);

        if (!cancelled) {
          // Route edges after layout
          const routedEdges = routeEdges(
            result.edges,
            result.tasks,
            result.batches,
            config,
          );

          setLayout({
            ...result,
            edges: routedEdges,
          });
          setIsLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Layout failed");
          setIsLoading(false);
        }
      }
    }

    runLayout();

    return () => {
      cancelled = true;
    };
  }, [epic, config]);

  // Get highlighted edges and related tasks
  const { highlightedEdges, relatedTasks } = useMemo(() => {
    if (!layout || highlightedTask === null) {
      return {
        highlightedEdges: new Set<string>(),
        relatedTasks: new Set<number>(),
      };
    }

    const edges = new Set<string>();
    const tasks = new Set<number>();
    tasks.add(highlightedTask);

    for (const edge of layout.edges) {
      if (edge.from === highlightedTask || edge.to === highlightedTask) {
        edges.add(edge.id);
        tasks.add(edge.from);
        tasks.add(edge.to);
      }
    }

    return { highlightedEdges: edges, relatedTasks: tasks };
  }, [layout, highlightedTask]);

  // Pan handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 0) {
      isPanning.current = true;
      setCursorStyle("grabbing");
      lastMousePos.current = { x: e.clientX, y: e.clientY };
    }
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning.current) return;

    const dx = e.clientX - lastMousePos.current.x;
    const dy = e.clientY - lastMousePos.current.y;

    setTransform((prev) => ({
      ...prev,
      x: prev.x + dx,
      y: prev.y + dy,
    }));

    lastMousePos.current = { x: e.clientX, y: e.clientY };
  }, []);

  const handleMouseUp = useCallback(() => {
    isPanning.current = false;
    setCursorStyle("grab");
  }, []);

  const handleMouseLeave = useCallback(() => {
    isPanning.current = false;
    setCursorStyle("grab");
  }, []);

  // Zoom handler
  const handleWheel = useCallback(
    (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const container = containerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      // Use a gentler zoom factor based on actual delta
      // Trackpad pinch gestures have smaller deltaY values
      const zoomSensitivity = 0.002;
      const delta = 1 - e.deltaY * zoomSensitivity;
      const newScale = Math.min(Math.max(transform.scale * delta, 0.25), 2);

      // Zoom towards mouse position
      const scaleChange = newScale / transform.scale;
      const newX = mouseX - (mouseX - transform.x) * scaleChange;
      const newY = mouseY - (mouseY - transform.y) * scaleChange;

      setTransform({
        x: newX,
        y: newY,
        scale: newScale,
      });
    },
    [transform],
  );

  // Attach non-passive wheel listener to prevent page scroll
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      container.removeEventListener("wheel", handleWheel);
    };
  }, [handleWheel]);

  // Reset view
  const handleResetView = useCallback(() => {
    setTransform({ x: 0, y: 0, scale: 1 });
  }, []);

  // Fit to view
  const handleFitToView = useCallback(() => {
    if (!layout || !containerRef.current) return;

    const container = containerRef.current;
    const rect = container.getBoundingClientRect();

    const scaleX = (rect.width - 48) / layout.canvasWidth;
    const scaleY = (rect.height - 48) / layout.canvasHeight;
    const scale = Math.min(scaleX, scaleY, 1);

    const x = (rect.width - layout.canvasWidth * scale) / 2;
    const y = (rect.height - layout.canvasHeight * scale) / 2;

    setTransform({ x, y, scale });
  }, [layout]);

  // Find original task data
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

  // Handle task click - different behavior in edit mode
  const handleTaskClick = useCallback(
    (taskNumber: number) => {
      if (isEditMode) {
        // Edit mode: first click selects source, second click creates relationship
        if (editModeSourceTask === null) {
          // First click - select source task
          setEditModeSourceTask(taskNumber);
        } else if (editModeSourceTask === taskNumber) {
          // Clicked same task - deselect
          setEditModeSourceTask(null);
        } else {
          // Second click on different task - create relationship
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
          // Clear source selection
          setEditModeSourceTask(null);
        }
      } else {
        // Select mode: open task details
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
    ],
  );

  // Handle edge click in edit mode - remove the relationship
  const handleEdgeClick = useCallback(
    (edge: { id: string; from: number; to: number }) => {
      if (isEditMode) {
        // Check if it's a pending edge
        const pendingIndex = pendingEdges.findIndex(
          (e) => e.from === edge.from && e.to === edge.to,
        );

        if (pendingIndex !== -1) {
          // Remove from pending edges
          setPendingEdges((prev) => prev.filter((_, i) => i !== pendingIndex));
        } else {
          // Mark existing edge as removed
          setRemovedEdges((prev) => new Set(prev).add(edge.id));
        }
      }
    },
    [isEditMode, pendingEdges],
  );

  // Reset edit mode state when switching tools
  const handleToolChange = useCallback((tool: ToolType) => {
    setActiveTool(tool);
    setEditModeSourceTask(null);
  }, []);

  // Get filtered edges (excluding removed ones)
  const visibleEdges = useMemo(() => {
    if (!layout) return [];
    return layout.edges.filter((edge) => !removedEdges.has(edge.id));
  }, [layout, removedEdges]);

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
      <div className="absolute top-4 right-4 z-10 flex gap-2">
        <button
          onClick={handleFitToView}
          className="px-3 py-1.5 text-xs font-medium bg-card border border-border rounded-md hover:bg-muted transition-colors"
        >
          Fit
        </button>
        <button
          onClick={handleResetView}
          className="px-3 py-1.5 text-xs font-medium bg-card border border-border rounded-md hover:bg-muted transition-colors"
        >
          Reset
        </button>
        <span className="px-3 py-1.5 text-xs font-medium bg-card border border-border rounded-md">
          {Math.round(transform.scale * 100)}%
        </span>
      </div>

      {/* Bottom Toolbar */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10">
        <CanvasToolbar
          activeTool={activeTool}
          onToolChange={handleToolChange}
        />
      </div>

      {/* Edit mode hint */}
      {isEditMode && (
        <div className="absolute top-4 left-4 z-10 px-3 py-1.5 text-xs font-medium bg-card border border-border rounded-md">
          {editModeSourceTask !== null ? (
            <span className="text-green-500">
              Click another task to create link, or same task to cancel
            </span>
          ) : (
            <span className="text-muted-foreground">
              Click a task to start, or click an arrow to remove
            </span>
          )}
        </div>
      )}

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
      >
        {/* Definitions */}
        <defs>
          <marker
            id="arrowhead"
            markerWidth="6"
            markerHeight="6"
            refX="5"
            refY="3"
            orient="auto"
            markerUnits="strokeWidth"
          >
            <polyline
              points="1 1, 5 3, 1 5"
              fill="none"
              className="stroke-muted-foreground"
              strokeWidth="1"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </marker>
          <marker
            id="arrowhead-highlighted"
            markerWidth="6"
            markerHeight="6"
            refX="5"
            refY="3"
            orient="auto"
            markerUnits="strokeWidth"
          >
            <polyline
              points="1 1, 5 3, 1 5"
              fill="none"
              className="stroke-primary"
              strokeWidth="1"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </marker>
          <marker
            id="arrowhead-batch"
            markerWidth="6"
            markerHeight="6"
            refX="5"
            refY="3"
            orient="auto"
            markerUnits="strokeWidth"
          >
            <polyline
              points="2 1, 5 3, 2 5"
              fill="none"
              className="stroke-primary"
              strokeWidth="1"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </marker>
          <marker
            id="arrowhead-pending"
            markerWidth="6"
            markerHeight="6"
            refX="5"
            refY="3"
            orient="auto"
            markerUnits="strokeWidth"
          >
            <polyline
              points="1 1, 5 3, 1 5"
              fill="none"
              stroke="#22c55e"
              strokeWidth="1"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </marker>
          <marker
            id="arrowhead-snip"
            markerWidth="6"
            markerHeight="6"
            refX="5"
            refY="3"
            orient="auto"
            markerUnits="strokeWidth"
          >
            <polyline
              points="1 1, 5 3, 1 5"
              fill="none"
              stroke="#f87171"
              strokeWidth="1"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </marker>
        </defs>

        {/* Batch-to-batch edges (rendered BEFORE batches so they appear BEHIND) */}
        <ElkEdges
          edges={visibleEdges}
          highlightedEdges={highlightedEdges}
          hasHighlightedTask={highlightedTask !== null}
          isEditMode={isEditMode}
          onEdgeClick={handleEdgeClick}
          batchEdgesOnly={true}
        />

        {/* Batch groups (rendered after batch edges, before task edges) */}
        {layout.batches.map((batch) => (
          <ElkBatchGroup
            key={batch.id}
            batch={batch}
            isHighlighted={relatedTasks.size > 0}
          />
        ))}

        {/* Task edges (rendered after batches so they appear on top) */}
        <ElkEdges
          edges={visibleEdges}
          highlightedEdges={highlightedEdges}
          hasHighlightedTask={highlightedTask !== null}
          isEditMode={isEditMode}
          onEdgeClick={handleEdgeClick}
          taskEdgesOnly={true}
        />

        {/* Pending edges (new relationships not yet saved) */}
        {pendingEdges.length > 0 && (
          <g className="pending-edges">
            {pendingEdges.map((edge, index) => {
              const fromTask = layout.tasks.find(
                (t) => t.taskNumber === edge.from,
              );
              const toTask = layout.tasks.find((t) => t.taskNumber === edge.to);
              if (!fromTask || !toTask) return null;

              // Simple straight line for pending edges
              const fromX = fromTask.x + fromTask.width;
              const fromY = fromTask.y + fromTask.height / 2;
              const toX = toTask.x;
              const toY = toTask.y + toTask.height / 2;

              return (
                <g key={`pending-${edge.from}-${edge.to}`}>
                  {/* Invisible hit area */}
                  <line
                    x1={fromX}
                    y1={fromY}
                    x2={toX}
                    y2={toY}
                    stroke="transparent"
                    strokeWidth={12}
                    className="cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEdgeClick({
                        id: `pending-${index}`,
                        from: edge.from,
                        to: edge.to,
                      });
                    }}
                  />
                  <line
                    x1={fromX}
                    y1={fromY}
                    x2={toX}
                    y2={toY}
                    stroke="#22c55e"
                    strokeWidth={2}
                    strokeDasharray="6 3"
                    className="cursor-pointer hover:stroke-destructive"
                    markerEnd="url(#arrowhead-pending)"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEdgeClick({
                        id: `pending-${index}`,
                        from: edge.from,
                        to: edge.to,
                      });
                    }}
                  />
                </g>
              );
            })}
          </g>
        )}

        {/* Task nodes */}
        {layout.tasks.map((task) => (
          <ElkTaskNode
            key={task.id}
            task={task}
            isHighlighted={!isEditMode && highlightedTask === task.taskNumber}
            isRelated={
              !isEditMode &&
              relatedTasks.has(task.taskNumber) &&
              highlightedTask !== task.taskNumber
            }
            isDimmed={
              !isEditMode &&
              highlightedTask !== null &&
              !relatedTasks.has(task.taskNumber)
            }
            isEditModeSelected={editModeSourceTask === task.taskNumber}
            isEditMode={isEditMode}
            onHover={setHighlightedTask}
            onClick={handleTaskClick}
          />
        ))}
      </svg>
    </div>
  );
}
