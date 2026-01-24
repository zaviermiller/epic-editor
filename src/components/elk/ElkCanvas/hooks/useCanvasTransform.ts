/**
 * useCanvasTransform Hook
 *
 * Manages pan and zoom state for the canvas, including mouse handlers
 * for dragging and wheel-based zooming.
 */

import { useState, useCallback, useRef, useEffect, RefObject } from "react";
import { TransformState } from "../types";
import { ElkLayoutResult } from "@/lib/elk";

interface UseCanvasTransformOptions {
  containerRef: RefObject<HTMLDivElement | null>;
}

interface UseCanvasTransformReturn {
  transform: TransformState;
  cursorStyle: "grab" | "grabbing";
  isPanning: RefObject<boolean>;
  handleMouseDown: (e: React.MouseEvent) => void;
  handleMouseMove: (e: React.MouseEvent) => void;
  handleMouseUp: () => void;
  handleMouseLeave: () => void;
  handleResetView: () => void;
  handleFitToView: (layout: ElkLayoutResult | null) => void;
  setTransform: React.Dispatch<React.SetStateAction<TransformState>>;
}

export function useCanvasTransform({
  containerRef,
}: UseCanvasTransformOptions): UseCanvasTransformReturn {
  const [transform, setTransform] = useState<TransformState>({
    x: 0,
    y: 0,
    scale: 1,
  });
  const [cursorStyle, setCursorStyle] = useState<"grab" | "grabbing">("grab");

  const isPanning = useRef(false);
  const lastMousePos = useRef({ x: 0, y: 0 });

  // Pan handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 0) {
      isPanning.current = true;
      setCursorStyle("grabbing");
      lastMousePos.current = { x: e.clientX, y: e.clientY };
    }
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanning.current) {
      const dx = e.clientX - lastMousePos.current.x;
      const dy = e.clientY - lastMousePos.current.y;

      setTransform((prev) => ({
        ...prev,
        x: prev.x + dx,
        y: prev.y + dy,
      }));

      lastMousePos.current = { x: e.clientX, y: e.clientY };
    }
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
    [transform, containerRef],
  );

  // Attach non-passive wheel listener to prevent page scroll
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      container.removeEventListener("wheel", handleWheel);
    };
  }, [handleWheel, containerRef]);

  // Reset view
  const handleResetView = useCallback(() => {
    setTransform({ x: 0, y: 0, scale: 1 });
  }, []);

  // Fit to view
  const handleFitToView = useCallback(
    (layout: ElkLayoutResult | null) => {
      if (!layout || !containerRef.current) return;

      const container = containerRef.current;
      const rect = container.getBoundingClientRect();

      const scaleX = (rect.width - 48) / layout.canvasWidth;
      const scaleY = (rect.height - 48) / layout.canvasHeight;
      const scale = Math.min(scaleX, scaleY, 1);

      const x = (rect.width - layout.canvasWidth * scale) / 2;
      const y = (rect.height - layout.canvasHeight * scale) / 2;

      setTransform({ x, y, scale });
    },
    [containerRef],
  );

  return {
    transform,
    cursorStyle,
    isPanning,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleMouseLeave,
    handleResetView,
    handleFitToView,
    setTransform,
  };
}
