/**
 * CanvasSettings Component
 *
 * A settings popover for configuring canvas display options.
 * Uses GitHub Primer components for consistent styling.
 */

"use client";

import { useRef, useState } from "react";
import { GearIcon } from "@primer/octicons-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useCanvasSettings } from "@/contexts";

export function CanvasSettings() {
  const { settings, updateSetting } = useCanvasSettings();
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  return (
    <div className="relative">
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            ref={buttonRef}
            onClick={() => setIsOpen(!isOpen)}
            className={`
              flex items-center justify-center w-9 h-9 rounded-md transition-colors cursor-pointer
              ${
                isOpen
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted text-muted-foreground hover:text-foreground"
              }
            `}
            aria-label="Canvas Settings"
            aria-expanded={isOpen}
            aria-haspopup="menu"
          >
            <GearIcon size={18} />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={8}>
          Settings
        </TooltipContent>
      </Tooltip>

      {/* Settings Popover */}
      {isOpen && (
        <>
          {/* Backdrop to close popover */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Popover content */}
          <div
            className="absolute top-full mt-2 right-0 z-50 min-w-70 bg-card border border-border rounded-lg shadow-lg overflow-hidden"
            role="menu"
          >
            <div className="px-3 py-2 border-b border-border bg-muted/30">
              <h3 className="text-sm font-semibold text-foreground">
                Display Settings
              </h3>
            </div>

            <div className="p-3 space-y-3">
              {/* Inter-batch edges toggle */}
              <label className="flex items-center justify-between gap-3 cursor-pointer group">
                <div className="flex-1">
                  <div className="text-sm font-medium text-foreground">
                    Show inter-batch edges
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Display dependency arrows between tasks in different batches
                  </div>
                </div>
                <button
                  role="switch"
                  aria-checked={settings.showInterBatchEdges}
                  onClick={() =>
                    updateSetting(
                      "showInterBatchEdges",
                      !settings.showInterBatchEdges,
                    )
                  }
                  className={`
                    relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent 
                    transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 
                    focus-visible:ring-primary focus-visible:ring-offset-2
                    ${settings.showInterBatchEdges ? "bg-primary" : "bg-muted-foreground/30"}
                  `}
                >
                  <span
                    className={`
                      pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg 
                      ring-0 transition duration-200 ease-in-out
                      ${settings.showInterBatchEdges ? "translate-x-4" : "translate-x-0"}
                    `}
                  />
                </button>
              </label>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
