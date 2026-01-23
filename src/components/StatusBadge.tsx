/**
 * StatusBadge Component
 *
 * Displays the status of an issue with appropriate color coding.
 *
 * Color scheme (from PRD):
 * - Done/Completed: Green
 * - In Progress: Yellow
 * - Planned: Blue
 * - Not Planned: Gray
 */

import { Badge } from "@/components/ui/badge";
import { IssueStatus } from "@/types";
import { CheckCircle2, Circle, CircleDot, CircleSlash } from "lucide-react";

interface StatusBadgeProps {
  status: IssueStatus;
  className?: string;
}

/**
 * Get the appropriate icon for a status
 */
function getStatusIcon(status: IssueStatus) {
  switch (status) {
    case "done":
      return <CheckCircle2 className="h-3 w-3" />;
    case "in-progress":
      return <CircleDot className="h-3 w-3" />;
    case "planned":
      return <Circle className="h-3 w-3" />;
    case "not-planned":
      return <CircleSlash className="h-3 w-3" />;
  }
}

/**
 * Get the display label for a status
 */
function getStatusLabel(status: IssueStatus): string {
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

/**
 * Get the CSS class for status styling
 */
function getStatusClass(status: IssueStatus): string {
  switch (status) {
    case "done":
      return "status-done";
    case "in-progress":
      return "status-in-progress";
    case "planned":
      return "status-planned";
    case "not-planned":
      return "status-not-planned";
  }
}

export function StatusBadge({ status, className = "" }: StatusBadgeProps) {
  return (
    <Badge
      variant="secondary"
      className={`${getStatusClass(status)} gap-1 font-medium ${className}`}
    >
      {getStatusIcon(status)}
      {getStatusLabel(status)}
    </Badge>
  );
}
