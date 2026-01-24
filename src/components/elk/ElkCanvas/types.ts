/**
 * Shared types for ElkCanvas and its subcomponents/hooks
 */

import { Epic, Task } from "@/types";
import { ElkLayoutConfig } from "@/lib/elk";
import { GitHubApi } from "@/lib/github";

/**
 * Result of a save operation for relationship changes
 */
export interface SaveResult {
  success: boolean;
  addedCount: number;
  removedCount: number;
  errors: string[];
  /** Successfully added task dependencies (from blocks to) */
  addedTaskEdges: { from: number; to: number }[];
  /** Successfully added batch dependencies (from blocks to) */
  addedBatchEdges: { from: number; to: number }[];
  /** Successfully removed task dependencies (from blocks to) */
  removedTaskEdges: { from: number; to: number }[];
  /** Successfully removed batch dependencies (from blocks to) */
  removedBatchEdges: { from: number; to: number }[];
}

/**
 * Transform state for pan and zoom
 */
export interface TransformState {
  x: number;
  y: number;
  scale: number;
}

/**
 * Edge change tracking
 */
export interface EdgeChange {
  from: number;
  to: number;
}

/**
 * Task movement tracking
 */
export interface PendingMove {
  taskNumber: number;
  taskId: number;
  fromBatchNumber: number;
  toBatchNumber: number;
}

/**
 * Dragging task state
 */
export interface DraggingTaskState {
  taskNumber: number;
  taskId: number;
  sourceBatchNumber: number;
}

/**
 * Props for the main ElkCanvas component
 */
export interface ElkCanvasProps {
  /** Epic to visualize */
  epic: Epic;
  /** Layout configuration */
  config?: ElkLayoutConfig;
  /** Callback when a task is clicked */
  onTaskClick?: (task: Task) => void;
  /** Callback when relationship changes are saved */
  onSave?: (result: SaveResult) => void;
  /** GitHub API instance (required for saving changes) */
  api?: GitHubApi;
  /** Class name for the container */
  className?: string;
}

/**
 * Tool types available in the canvas toolbar
 */
export type { ToolType } from "./components/CanvasToolbar";
