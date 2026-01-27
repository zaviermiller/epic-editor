/**
 * StatusBadge Component
 *
 * Displays the status of an issue with appropriate color coding.
 *
 * Color scheme:
 * - Done/Completed: Green
 * - In Progress: Yellow
 * - Ready: Blue
 * - Blocked: Red
 */

import { Badge } from "@/components/ui/badge";
import { IssueStatus } from "@/types";
import { getStatusLabel } from "@/lib/statusUtils";
import {
  CheckCircleFillIcon,
  IssueOpenedIcon,
  DotFillIcon,
  XCircleFillIcon,
} from "@primer/octicons-react";

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
      return <CheckCircleFillIcon size={12} />;
    case "in-progress":
      return <DotFillIcon size={12} />;
    case "ready":
      return <IssueOpenedIcon size={12} />;
    case "blocked":
      return <XCircleFillIcon size={12} />;
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
    case "ready":
      return "status-ready";
    case "blocked":
      return "status-blocked";
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
