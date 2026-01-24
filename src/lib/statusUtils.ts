/**
 * Status Utilities
 *
 * Centralized status color/styling functions for consistent status representation
 * across the application. Supports both Tailwind CSS classes (for HTML components)
 * and hex colors (for SVG/canvas rendering).
 */

import { IssueStatus } from "@/types";

// ============================================================================
// Status Colors - Hex values for SVG/Canvas rendering
// ============================================================================

/**
 * Status color definitions with hex values
 */
export const STATUS_COLORS = {
  done: {
    bg: "#22c55e", // green-500
    text: "#ffffff",
    border: "#16a34a", // green-600
  },
  "in-progress": {
    bg: "#facc15", // yellow-400
    text: "#1f2937", // gray-800
    border: "#eab308", // yellow-500
  },
  planned: {
    bg: "#3b82f6", // blue-500
    text: "#ffffff",
    border: "#2563eb", // blue-600
  },
  "not-planned": {
    bg: "#9ca3af", // gray-400
    text: "#ffffff",
    border: "#6b7280", // gray-500
  },
} as const;

/**
 * Get hex colors for a status (for SVG/canvas rendering)
 */
export function getStatusHexColors(status: IssueStatus): {
  bg: string;
  text: string;
  border: string;
} {
  return STATUS_COLORS[status];
}

// ============================================================================
// Status Colors - Tailwind CSS classes for HTML components
// ============================================================================

/**
 * Get Tailwind background color class based on status
 */
export function getStatusBgClass(status: IssueStatus): string {
  switch (status) {
    case "done":
      return "bg-green-500";
    case "in-progress":
      return "bg-yellow-400";
    case "planned":
      return "bg-blue-500";
    case "not-planned":
      return "bg-gray-400";
  }
}

/**
 * Get Tailwind text color class based on status (for contrast)
 */
export function getStatusTextClass(status: IssueStatus): string {
  switch (status) {
    case "done":
      return "text-white";
    case "in-progress":
      return "text-gray-900";
    case "planned":
      return "text-white";
    case "not-planned":
      return "text-white";
  }
}

// ============================================================================
// Status Labels
// ============================================================================

/**
 * Get the display label for a status
 */
export function getStatusLabel(status: IssueStatus): string {
  switch (status) {
    case "done":
      return "Done";
    case "in-progress":
      return "In Progress";
    case "planned":
      return "Planned";
    case "not-planned":
      return "Not Planned";
  }
}

// ============================================================================
// Status Items - For legends and lists
// ============================================================================

/**
 * Status item definition for rendering in legends/lists
 */
export interface StatusItem {
  status: IssueStatus;
  label: string;
  bgClass: string;
  hexColor: string;
}

/**
 * All status items in display order (for legends)
 */
export const STATUS_ITEMS: StatusItem[] = [
  {
    status: "not-planned",
    label: "Not Planned",
    bgClass: "bg-gray-400",
    hexColor: "#9ca3af",
  },
  {
    status: "planned",
    label: "Planned",
    bgClass: "bg-blue-500",
    hexColor: "#3b82f6",
  },
  {
    status: "in-progress",
    label: "In Progress",
    bgClass: "bg-yellow-400",
    hexColor: "#facc15",
  },
  {
    status: "done",
    label: "Done",
    bgClass: "bg-green-500",
    hexColor: "#22c55e",
  },
];
