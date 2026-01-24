/**
 * StatusLegend Component
 *
 * Displays a legend showing the meaning of each status color.
 * Matches the reference design with colored indicators.
 */

"use client";

interface StatusLegendProps {
  className?: string;
  /** When true, uses explicit hex colors instead of CSS variables for export compatibility */
  forExport?: boolean;
}

const statusItems = [
  { status: "Not Planned", color: "bg-gray-400", hexColor: "#9ca3af" },
  { status: "Planned", color: "bg-blue-500", hexColor: "#3b82f6" },
  { status: "In Progress", color: "bg-yellow-400", hexColor: "#facc15" },
  { status: "Done", color: "bg-green-500", hexColor: "#22c55e" },
];

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
        {statusItems.map((item) => (
          <div key={item.status} className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-sm"
              style={{ backgroundColor: item.hexColor }}
            />
            <span className="text-xs" style={{ color: "#fafafa" }}>
              {item.status}
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
      {statusItems.map((item) => (
        <div key={item.status} className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-sm ${item.color}`} />
          <span className="text-xs text-foreground">{item.status}</span>
        </div>
      ))}
    </div>
  );
}
