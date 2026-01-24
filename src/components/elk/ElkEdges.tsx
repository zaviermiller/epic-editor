/**
 * ElkEdges Component
 *
 * Renders all edges/arrows between tasks and batches in the SVG canvas.
 * Handles regular, highlighted, and batch-level edge states.
 * Supports click-to-remove in edit mode with scissors cursor.
 */

"use client";

import { useState, useEffect } from "react";
import { RoutedEdge } from "@/lib/elk";

interface ElkEdgesProps {
  edges: RoutedEdge[];
  highlightedEdges: Set<string>;
  hasHighlightedTask: boolean;
  /** Whether edit mode is active (edges become clickable) */
  isEditMode?: boolean;
  /** Callback when an edge is clicked in edit mode */
  onEdgeClick?: (edge: RoutedEdge) => void;
  /** Only render batch edges (for layering behind batches) */
  batchEdgesOnly?: boolean;
  /** Only render task edges (for layering above batches) */
  taskEdgesOnly?: boolean;
  /** Set of edge IDs that are pending (newly added in edit mode) */
  pendingEdgeIds?: Set<string>;
  /** When true, uses explicit hex colors instead of CSS variables for export compatibility */
  forExport?: boolean;
  /** Set of edge IDs that should be highlighted due to batch hover */
  highlightedBatchEdges?: Set<string>;
  /** Whether a batch is currently being hovered */
  hasHighlightedBatch?: boolean;
}

// Scissors cursor as a data URI (modern minimalist scissors icon)
const scissorsCursor = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%23ffffff' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='6' cy='6' r='3'/%3E%3Ccircle cx='6' cy='18' r='3'/%3E%3Cline x1='20' y1='4' x2='8.12' y2='15.88'/%3E%3Cline x1='14.47' y1='14.48' x2='20' y2='20'/%3E%3Cline x1='8.12' y1='8.12' x2='12' y2='12'/%3E%3C/svg%3E") 12 12, pointer`;

// Muted red color for hover state in edit mode
const mutedRed = "#f87171"; // red-400
// Pending edge color (green)
const pendingGreen = "#22c55e"; // green-500

export function ElkEdges({
  edges,
  highlightedEdges,
  hasHighlightedTask,
  isEditMode = false,
  onEdgeClick,
  batchEdgesOnly = false,
  taskEdgesOnly = false,
  pendingEdgeIds = new Set(),
  forExport = false,
  highlightedBatchEdges = new Set(),
  hasHighlightedBatch = false,
}: ElkEdgesProps) {
  const [hoveredEdge, setHoveredEdge] = useState<string | null>(null);

  // Clear hovered state when edges change (e.g., when an edge is restored)
  useEffect(() => {
    setHoveredEdge(null);
  }, [edges]);

  // Separate edges by type and state for proper rendering order
  const batchEdges = edges.filter((e) => e.isBatchEdge);
  const taskEdges = edges.filter((e) => !e.isBatchEdge);

  // Filter based on which edges to render
  const shouldRenderBatchEdges = !taskEdgesOnly;
  const shouldRenderTaskEdges = !batchEdgesOnly;

  const regularTaskEdges = taskEdges.filter((e) => !highlightedEdges.has(e.id));
  const highlightedTaskEdges = taskEdges.filter((e) =>
    highlightedEdges.has(e.id),
  );

  const handleEdgeClick = (edge: RoutedEdge, e: React.MouseEvent) => {
    if (isEditMode && onEdgeClick) {
      e.stopPropagation();
      onEdgeClick(edge);
    }
  };

  return (
    <g className="elk-edges">
      {/* Batch-to-batch edges (rendered behind batches when batchEdgesOnly=true) */}
      {shouldRenderBatchEdges &&
        batchEdges.map((edge) => {
          const isHovered = hoveredEdge === edge.id;
          const isPending = pendingEdgeIds.has(edge.id);
          const isBatchHighlighted = highlightedBatchEdges.has(edge.id);

          // Determine stroke color (use hex for export compatibility)
          let strokeColor = forExport ? "#3b82f6" : "var(--primary)";
          if (isPending) {
            strokeColor = isEditMode && isHovered ? mutedRed : pendingGreen;
          } else if (isEditMode && isHovered) {
            strokeColor = mutedRed;
          } else if (isBatchHighlighted && !isEditMode) {
            strokeColor = "#3b82f6"; // blue-500 for highlighted batch connections
          }

          // Determine marker (use export-specific markers when forExport)
          let markerEnd = forExport
            ? "url(#export-arrowhead-batch)"
            : "url(#arrowhead-batch)";
          if (isPending) {
            markerEnd =
              isEditMode && isHovered
                ? "url(#arrowhead-snip)"
                : "url(#arrowhead-pending)";
          } else if (isEditMode && isHovered) {
            markerEnd = "url(#arrowhead-snip)";
          } else if (isBatchHighlighted && !isEditMode) {
            markerEnd = "url(#arrowhead-highlighted)";
          }

          // Calculate opacity: dim when there's highlighting and this edge is not part of it
          let opacity = 1;
          if (hasHighlightedTask) {
            opacity = 0.3;
          } else if (hasHighlightedBatch && !isBatchHighlighted) {
            opacity = 0.15;
          }

          return (
            <g key={edge.id}>
              {/* Invisible wider hit area for easier clicking */}
              {isEditMode && (
                <path
                  d={edge.path}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={16}
                  style={{ cursor: scissorsCursor }}
                  onClick={(e) => handleEdgeClick(edge, e)}
                  onMouseEnter={() => setHoveredEdge(edge.id)}
                  onMouseLeave={() => setHoveredEdge(null)}
                />
              )}
              <path
                d={edge.path}
                fill="none"
                className="transition-all duration-150"
                style={{
                  strokeWidth: isBatchHighlighted && !isEditMode ? 4 : 3,
                  opacity,
                  cursor: isEditMode ? scissorsCursor : undefined,
                  strokeDasharray: isPending ? "8 4" : undefined,
                }}
                stroke={strokeColor}
                markerEnd={markerEnd}
                onClick={(e) => handleEdgeClick(edge, e)}
                onMouseEnter={() => isEditMode && setHoveredEdge(edge.id)}
                onMouseLeave={() => isEditMode && setHoveredEdge(null)}
                pointerEvents={isEditMode ? "stroke" : "none"}
              />
            </g>
          );
        })}

      {/* Regular task edges (dimmed when there's a highlighted task or batch) */}
      {shouldRenderTaskEdges &&
        regularTaskEdges.map((edge) => {
          const isHovered = hoveredEdge === edge.id;
          const isPending = pendingEdgeIds.has(edge.id);
          const isBatchHighlighted = highlightedBatchEdges.has(edge.id);

          // Determine stroke color (use hex for export compatibility)
          let strokeColor = forExport ? "#a1a1aa" : "var(--muted-foreground)";
          if (isPending) {
            strokeColor = isEditMode && isHovered ? mutedRed : pendingGreen;
          } else if (isEditMode && isHovered) {
            strokeColor = mutedRed;
          } else if (isBatchHighlighted && !isEditMode) {
            strokeColor = "#3b82f6"; // blue-500 for highlighted inter-batch connections
          }

          // Determine marker (use export-specific markers when forExport)
          let markerEnd = forExport
            ? "url(#export-arrowhead)"
            : "url(#arrowhead)";
          if (isPending) {
            markerEnd =
              isEditMode && isHovered
                ? "url(#arrowhead-snip)"
                : "url(#arrowhead-pending)";
          } else if (isEditMode && isHovered) {
            markerEnd = "url(#arrowhead-snip)";
          } else if (isBatchHighlighted && !isEditMode) {
            markerEnd = "url(#arrowhead-highlighted)";
          }

          // Calculate opacity: dim when there's highlighting and this edge is not part of it
          let opacity = 1;
          if (hasHighlightedTask) {
            opacity = 0.15;
          } else if (hasHighlightedBatch && !isBatchHighlighted) {
            opacity = 0.15;
          }

          return (
            <g key={edge.id}>
              {/* Invisible wider hit area for easier clicking */}
              {isEditMode && (
                <path
                  d={edge.path}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={12}
                  style={{ cursor: scissorsCursor }}
                  onClick={(e) => handleEdgeClick(edge, e)}
                  onMouseEnter={() => setHoveredEdge(edge.id)}
                  onMouseLeave={() => setHoveredEdge(null)}
                />
              )}
              <path
                d={edge.path}
                fill="none"
                className="transition-all duration-300"
                style={{
                  strokeWidth: isBatchHighlighted && !isEditMode ? 2.5 : 2,
                  opacity,
                  cursor: isEditMode ? scissorsCursor : undefined,
                  strokeDasharray: isPending ? "6 3" : undefined,
                }}
                stroke={strokeColor}
                markerEnd={markerEnd}
                onClick={(e) => handleEdgeClick(edge, e)}
                onMouseEnter={() => isEditMode && setHoveredEdge(edge.id)}
                onMouseLeave={() => isEditMode && setHoveredEdge(null)}
                pointerEvents={isEditMode ? "stroke" : "none"}
              />
            </g>
          );
        })}

      {/* Highlighted task edges */}
      {shouldRenderTaskEdges &&
        highlightedTaskEdges.map((edge) => {
          const isHovered = hoveredEdge === edge.id;
          const isPending = pendingEdgeIds.has(edge.id);

          // Determine stroke color (use hex for export compatibility)
          let strokeColor = forExport ? "#3b82f6" : "var(--primary)";
          if (isPending) {
            strokeColor = isEditMode && isHovered ? mutedRed : pendingGreen;
          } else if (isEditMode && isHovered) {
            strokeColor = mutedRed;
          }

          // Determine marker
          let markerEnd = "url(#arrowhead-highlighted)";
          if (isPending) {
            markerEnd =
              isEditMode && isHovered
                ? "url(#arrowhead-snip)"
                : "url(#arrowhead-pending)";
          } else if (isEditMode && isHovered) {
            markerEnd = "url(#arrowhead-snip)";
          }

          return (
            <g key={edge.id}>
              {/* Invisible wider hit area for easier clicking */}
              {isEditMode && (
                <path
                  d={edge.path}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={12}
                  style={{ cursor: scissorsCursor }}
                  onClick={(e) => handleEdgeClick(edge, e)}
                  onMouseEnter={() => setHoveredEdge(edge.id)}
                  onMouseLeave={() => setHoveredEdge(null)}
                />
              )}
              <path
                d={edge.path}
                fill="none"
                className="transition-all duration-300"
                style={{
                  strokeWidth: 2,
                  cursor: isEditMode ? scissorsCursor : undefined,
                  strokeDasharray: isPending ? "6 3" : undefined,
                }}
                stroke={strokeColor}
                markerEnd={markerEnd}
                onClick={(e) => handleEdgeClick(edge, e)}
                onMouseEnter={() => isEditMode && setHoveredEdge(edge.id)}
                onMouseLeave={() => isEditMode && setHoveredEdge(null)}
                pointerEvents={isEditMode ? "stroke" : "none"}
              />
            </g>
          );
        })}
    </g>
  );
}
