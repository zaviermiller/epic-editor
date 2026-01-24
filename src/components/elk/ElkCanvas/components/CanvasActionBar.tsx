/**
 * CanvasActionBar Component
 *
 * Bottom toolbar with save/clear buttons and tool selection.
 */

import { SyncIcon } from "@primer/octicons-react";
import { CanvasToolbar } from "./CanvasToolbar";
import { useTool, useEpicContext } from "../context";

interface CanvasActionBarProps {
  hasChanges: boolean;
  isSaving: boolean;
  onSave: () => void;
  onClearChanges: () => void;
  onExport: () => void;
}

export function CanvasActionBar({
  hasChanges,
  isSaving,
  onSave,
  onClearChanges,
  onExport,
}: CanvasActionBarProps) {
  const { activeTool, setActiveTool } = useTool();
  const { api, isExporting } = useEpicContext();
  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-2">
      {/* Save/Clear buttons - only shown when there are changes */}
      {hasChanges && (
        <div className="flex items-center gap-2">
          <button
            onClick={onClearChanges}
            disabled={isSaving}
            className="px-4 py-2 text-sm font-medium bg-card border border-border text-foreground rounded-lg hover:bg-muted transition-colors shadow-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Clear Changes
          </button>
          <button
            onClick={onSave}
            disabled={isSaving || !api}
            className="px-4 py-2 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors shadow-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isSaving ? (
              <>
                <SyncIcon size={16} className="animate-spin" />
                Saving...
              </>
            ) : !api ? (
              "Sign in to Save"
            ) : (
              "Save Changes"
            )}
          </button>
        </div>
      )}
      <CanvasToolbar
        activeTool={activeTool}
        onToolChange={setActiveTool}
        onExport={onExport}
        isExporting={isExporting}
      />
    </div>
  );
}
