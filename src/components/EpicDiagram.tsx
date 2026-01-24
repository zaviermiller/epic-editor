/**
 * EpicDiagram Component
 *
 * The main visualization component that displays the Epic hierarchy
 * in a free-form canvas layout with pan/zoom and dependency arrows.
 * Matches the reference design with batch containers and colored task cards.
 */

"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { Epic, Task } from "@/types";
import { getStatusBgClass, getStatusTextClass } from "@/lib/statusUtils";
import { EpicCanvas } from "./EpicCanvas";
import { StatusLegend } from "./StatusLegend";
import { Button } from "@/components/ui/button";
import {
  ZoomInIcon,
  ZoomOutIcon,
  ScreenFullIcon,
  LinkExternalIcon,
  GrabberIcon,
} from "@primer/octicons-react";

// Dragging state interface
interface DragState {
  task: Task;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  offsetX: number;
  offsetY: number;
}

interface EpicDiagramProps {
  epic: Epic;
  /** Callback when a task is clicked */
  onTaskClick?: (task: Task) => void;
}

export function EpicDiagram({ epic, onTaskClick }: EpicDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [highlightedTask, setHighlightedTask] = useState<number | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Task drag state
  const [taskDrag, setTaskDrag] = useState<DragState | null>(null);

  // Zoom controls
  const handleZoomIn = useCallback(() => {
    setZoom((prev) => Math.min(prev + 0.1, 2));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom((prev) => Math.max(prev - 0.1, 0.3));
  }, []);

  const handleResetView = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  // Pan handling
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      // Only start dragging if clicking on the canvas background
      if ((e.target as HTMLElement).closest("[data-batch-id]")) return;
      if ((e.target as HTMLElement).closest("[data-task-id]")) return;
      setIsDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    },
    [pan],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging) return;
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    },
    [isDragging, dragStart],
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Wheel zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.05 : 0.05;
      setZoom((prev) => Math.max(0.3, Math.min(2, prev + delta)));
    }
  }, []);

  // Task drag handlers
  const handleTaskDragStart = useCallback((task: Task, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const target = e.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();

    setTaskDrag({
      task,
      startX: e.clientX,
      startY: e.clientY,
      currentX: e.clientX,
      currentY: e.clientY,
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
    });
  }, []);

  const handleTaskDragMove = useCallback(
    (e: MouseEvent) => {
      if (!taskDrag) return;

      setTaskDrag((prev) =>
        prev
          ? {
              ...prev,
              currentX: e.clientX,
              currentY: e.clientY,
            }
          : null,
      );
    },
    [taskDrag],
  );

  const handleTaskDragEnd = useCallback(() => {
    if (taskDrag) {
      // TODO: Handle drop logic here (reordering, moving between batches, etc.)
      setTaskDrag(null);
    }
  }, [taskDrag]);

  // Global mouse events for task dragging
  useEffect(() => {
    if (taskDrag) {
      window.addEventListener("mousemove", handleTaskDragMove);
      window.addEventListener("mouseup", handleTaskDragEnd);

      return () => {
        window.removeEventListener("mousemove", handleTaskDragMove);
        window.removeEventListener("mouseup", handleTaskDragEnd);
      };
    }
  }, [taskDrag, handleTaskDragMove, handleTaskDragEnd]);

  return (
    <div className="flex flex-col h-full">
      {/* Epic Header */}
      <div className="shrink-0 text-center pb-4 border-b border-border mb-4">
        <h1 className="text-xl font-semibold text-foreground">
          Epic: {epic.title} #{epic.number}
        </h1>
        <a
          href={epic.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mt-1"
        >
          <LinkExternalIcon size={12} />
          {epic.owner}/{epic.repo}
        </a>
      </div>

      {/* Controls Bar */}
      <div className="shrink-0 flex items-center justify-between mb-4 px-2">
        {/* Zoom Controls */}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleZoomOut}>
            <ZoomOutIcon size={16} />
          </Button>
          <span className="text-sm text-muted-foreground w-14 text-center">
            {Math.round(zoom * 100)}%
          </span>
          <Button variant="outline" size="sm" onClick={handleZoomIn}>
            <ZoomInIcon size={16} />
          </Button>
          <Button variant="outline" size="sm" onClick={handleResetView}>
            <ScreenFullIcon size={16} />
          </Button>
        </div>

        {/* Instructions */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <GrabberIcon size={12} />
          <span>Drag to pan • Ctrl+scroll to zoom</span>
        </div>
      </div>

      {/* Canvas Container */}
      <div
        ref={containerRef}
        className={`
          relative flex-1 overflow-auto rounded-lg border border-border bg-muted/20 min-h-0
          ${isDragging ? "cursor-grabbing" : "cursor-grab"}
        `}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      >
        {/* Status Legend - Fixed position */}
        <div className="absolute top-4 right-4 z-20">
          <StatusLegend />
        </div>

        {/* Zoomable/Pannable Canvas */}
        <div
          ref={canvasRef}
          data-canvas="true"
          className="origin-top-left"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: "0 0",
          }}
        >
          {/* Epic Canvas with batches and dependency arrows */}
          <EpicCanvas
            epic={epic}
            highlightedTask={highlightedTask}
            onTaskHover={setHighlightedTask}
            onTaskClick={onTaskClick}
            onTaskDragStart={handleTaskDragStart}
            draggingTaskId={taskDrag?.task.number ?? null}
          />
        </div>

        {/* Dragging Task Ghost - rendered at fixed position */}
        {taskDrag && (
          <div
            className="fixed pointer-events-none z-50"
            style={{
              left: taskDrag.currentX - taskDrag.offsetX,
              top: taskDrag.currentY - taskDrag.offsetY,
              opacity: 0.9,
            }}
          >
            <div
              className={`
                ${getStatusBgClass(taskDrag.task.status)} ${getStatusTextClass(taskDrag.task.status)}
                rounded-md px-3 py-2
                text-xs font-medium leading-snug
                shadow-xl ring-2 ring-white ring-offset-2 ring-offset-background
                min-w-[120px] max-w-[200px]
              `}
            >
              <div className="break-words">{taskDrag.task.title}</div>
              <div className="text-[10px] opacity-75 mt-1">
                #{taskDrag.task.number}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
