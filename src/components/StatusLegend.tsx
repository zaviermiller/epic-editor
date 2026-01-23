/**
 * StatusLegend Component
 *
 * Displays a legend showing the meaning of each status color.
 * Matches the reference design with colored indicators.
 */

"use client";

interface StatusLegendProps {
  className?: string;
}

const statusItems = [
  { status: "Not Planned", color: "bg-gray-400" },
  { status: "Planned", color: "bg-blue-500" },
  { status: "In Progress", color: "bg-yellow-400" },
  { status: "Done", color: "bg-green-500" },
];

export function StatusLegend({ className = "" }: StatusLegendProps) {
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
