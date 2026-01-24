/**
 * StatusLegend Component
 *
 * Displays a legend showing the meaning of each status color.
 * Matches the reference design with colored indicators.
 */

"use client";

import { STATUS_ITEMS } from "@/lib/statusUtils";

interface StatusLegendProps {
  className?: string;
  /** When true, uses explicit hex colors instead of CSS variables for export compatibility */
  forExport?: boolean;
}

export function StatusLegend({
  className = "",
  forExport = false,
}: StatusLegendProps) {
  // Use explicit hex colors for export to avoid oklch color parsing issues
  if (forExport) {
    return (
      <div
        className={`flex flex-col gap-1.5 rounded-lg p-3 shadow-sm ${className}`}
        style={{
          backgroundColor: "#18181b",
          border: "1px solid #27272a",
        }}
      >
        {STATUS_ITEMS.map((item) => (
          <div key={item.status} className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-sm"
              style={{ backgroundColor: item.hexColor }}
            />
            <span className="text-xs" style={{ color: "#fafafa" }}>
              {item.label}
            </span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col gap-1.5 bg-card border border-border rounded-lg p-3 shadow-sm ${className}`}
    >
      {STATUS_ITEMS.map((item) => (
        <div key={item.status} className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-sm ${item.bgClass}`} />
          <span className="text-xs text-foreground">{item.label}</span>
        </div>
      ))}
    </div>
  );
}
