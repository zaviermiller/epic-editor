/**
 * CanvasControls Component
 *
 * Top-right controls for zoom, reset, settings, and status legend.
 */

import { StatusLegend } from "../../../StatusLegend";
import { TransformState } from "../types";
import { CanvasSettings } from "./CanvasSettings";

interface CanvasControlsProps {
  transform: TransformState;
  onFitToView: () => void;
  onResetView: () => void;
}

export function CanvasControls({
  transform,
  onFitToView,
  onResetView,
}: CanvasControlsProps) {
  return (
    <div className="absolute top-4 right-4 z-10 flex-col gap-2">
      <div className="flex gap-2 mb-2 items-center">
        <button
          onClick={onFitToView}
          className="px-3 py-1.5 text-xs font-medium bg-card border border-border rounded-md hover:bg-muted transition-colors cursor-pointer"
        >
          Fit
        </button>
        <button
          onClick={onResetView}
          className="px-3 py-1.5 text-xs font-medium bg-card border border-border rounded-md hover:bg-muted transition-colors cursor-pointer"
        >
          Reset
        </button>
        <span className="px-3 py-1.5 text-xs font-medium bg-card border border-border rounded-md">
          {Math.round(transform.scale * 100)}%
        </span>
        <div className="bg-card border border-border rounded-md">
          <CanvasSettings />
        </div>
      </div>
      <StatusLegend />
    </div>
  );
}
