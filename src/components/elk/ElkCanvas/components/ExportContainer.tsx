/**
 * ExportContainer Component
 *
 * Hidden container used for PNG export of the diagram.
 */

import { RefObject } from "react";
import { ElkLayoutResult } from "@/lib/elk";
import { ElkBatchGroup } from "../../ElkBatchGroup";
import { ElkTaskNode } from "../../ElkTaskNode";
import { ElkEdges } from "../../ElkEdges";
import { StatusLegend } from "../../../StatusLegend";
import { SvgMarkerDefs } from "./SvgMarkerDefs";

interface ExportContainerProps {
  exportRef: RefObject<HTMLDivElement | null>;
  layout: ElkLayoutResult;
  visibleEdges: ElkLayoutResult["edges"];
  owner: string;
  repo: string;
}

export function ExportContainer({
  exportRef,
  layout,
  visibleEdges,
  owner,
  repo,
}: ExportContainerProps) {
  return (
    <div
      ref={exportRef}
      data-export-container
      className="fixed -left-[9999px] -top-[9999px] p-6"
      style={{
        width: layout.canvasWidth + 200,
        height: layout.canvasHeight + 48,
        backgroundColor: "#09090b",
      }}
      aria-hidden="true"
    >
      {/* Legend positioned in top-right corner */}
      <div className="absolute top-6 right-6">
        <StatusLegend forExport />
      </div>

      {/* Static SVG copy for export */}
      <svg
        width={layout.canvasWidth}
        height={layout.canvasHeight}
        viewBox={`0 0 ${layout.canvasWidth} ${layout.canvasHeight}`}
      >
        <SvgMarkerDefs forExport />

        {/* Batch-to-batch edges */}
        <ElkEdges
          edges={visibleEdges}
          highlightedEdges={new Set()}
          hasHighlightedTask={false}
          isEditMode={false}
          batchEdgesOnly={true}
          pendingEdgeIds={new Set()}
          forExport={true}
        />

        {/* Batch groups */}
        {layout.batches.map((batch) => (
          <ElkBatchGroup
            key={`export-${batch.id}`}
            batch={batch}
            isHighlighted={false}
            isEditMode={false}
            isEditModeSelected={false}
            isMoveMode={false}
            isDragActive={false}
            isDropTarget={false}
            forExport={true}
            owner={owner}
            repo={repo}
          />
        ))}

        {/* Task edges */}
        <ElkEdges
          edges={visibleEdges}
          highlightedEdges={new Set()}
          hasHighlightedTask={false}
          isEditMode={false}
          taskEdgesOnly={true}
          pendingEdgeIds={new Set()}
          forExport={true}
        />

        {/* Task nodes */}
        {layout.tasks.map((task) => (
          <ElkTaskNode
            key={`export-${task.id}`}
            task={task}
            isHighlighted={false}
            isRelated={false}
            isDimmed={false}
            isEditModeSelected={false}
            isEditMode={false}
            isMoveMode={false}
            isDragging={false}
            pendingMove={null}
          />
        ))}
      </svg>
    </div>
  );
}
