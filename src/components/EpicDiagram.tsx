/**
 * EpicDiagram Component
 *
 * The main visualization component that displays the Epic hierarchy
 * in a free-form canvas layout with pan/zoom and dependency arrows.
 * Matches the reference design with batch containers and colored task cards.
 */

"use client";

import { useRef, useState, useCallback } from "react";
import { Epic, Task } from "@/types";
import { EpicCanvas } from "./EpicCanvas";
import { StatusLegend } from "./StatusLegend";
import { Button } from "@/components/ui/button";
import { ZoomIn, ZoomOut, Maximize, ExternalLink, Move } from "lucide-react";

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
          <ExternalLink className="h-3 w-3" />
          {epic.owner}/{epic.repo}
        </a>
      </div>

      {/* Controls Bar */}
      <div className="shrink-0 flex items-center justify-between mb-4 px-2">
        {/* Zoom Controls */}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleZoomOut}>
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground w-14 text-center">
            {Math.round(zoom * 100)}%
          </span>
          <Button variant="outline" size="sm" onClick={handleZoomIn}>
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={handleResetView}>
            <Maximize className="h-4 w-4" />
          </Button>
        </div>

        {/* Instructions */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Move className="h-3 w-3" />
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
          />
        </div>
      </div>
    </div>
  );
}
