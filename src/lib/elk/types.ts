/**
 * ELK Layout Types
 *
 * Type definitions for the ELK-based layout system.
 * These types bridge our domain model (Epic → Batches → Tasks)
 * with ELK's compound graph model.
 */

import { IssueStatus } from "@/types";

// ============================================================================
// Node Measurement Types
// ============================================================================

/**
 * Measured dimensions for a node
 */
export interface NodeDimensions {
  width: number;
  height: number;
}

/**
 * Cache for node measurements keyed by content hash
 */
export type MeasurementCache = Map<string, NodeDimensions>;

// ============================================================================
// Layout Configuration
// ============================================================================

/**
 * Configuration for the ELK layout engine
 */
export interface ElkLayoutConfig {
  /** Spacing between nodes within a group */
  nodeSpacing: number;
  /** Spacing between groups */
  groupSpacing: number;
  /** Padding inside group containers */
  groupPadding: number;
  /** Height reserved for group headers */
  groupHeaderHeight: number;
  /** Spacing between rows of groups */
  rowGap: number;
  /** Spacing between columns within a row */
  columnGap: number;
  /** Canvas padding around the entire layout */
  canvasPadding: number;
  /** Target max width for a row of groups */
  maxRowWidth: number;
  /** Default task card width */
  taskWidth: number;
  /** Minimum task card height */
  taskMinHeight: number;
  /** ELK layout direction for inner group layouts */
  innerLayoutDirection: "DOWN" | "RIGHT";
}

/**
 * Default layout configuration
 */
export const DEFAULT_ELK_CONFIG: ElkLayoutConfig = {
  nodeSpacing: 16,
  groupSpacing: 48,
  groupPadding: 20,
  groupHeaderHeight: 48,
  rowGap: 48,
  columnGap: 48,
  canvasPadding: 48,
  maxRowWidth: 1600,
  taskWidth: 260,
  taskMinHeight: 60,
  innerLayoutDirection: "DOWN",
};

// ============================================================================
// Positioned Layout Output
// ============================================================================

/**
 * A positioned task after layout calculation
 */
export interface PositionedTask {
  id: string;
  taskNumber: number;
  title: string;
  status: IssueStatus;
  /** Absolute X position on canvas */
  x: number;
  /** Absolute Y position on canvas */
  y: number;
  width: number;
  height: number;
  /** Parent batch number */
  batchNumber: number;
  /** Task numbers this task depends on */
  dependsOn: number[];
}

/**
 * A positioned batch (group) after layout calculation
 */
export interface PositionedBatch {
  id: string;
  batchNumber: number;
  title: string;
  status: IssueStatus;
  /** Absolute X position on canvas */
  x: number;
  /** Absolute Y position on canvas */
  y: number;
  width: number;
  height: number;
  /** Progress percentage (0-100) */
  progress: number;
  /** Row index in the packing layout */
  row: number;
  /** Column index within the row */
  col: number;
}

/**
 * An edge between two tasks or two batches
 */
export interface LayoutEdge {
  id: string;
  /** Source task/batch number */
  from: number;
  /** Target task/batch number */
  to: number;
  /** Whether this edge crosses batch boundaries */
  isInterBatch: boolean;
  /** Source batch number */
  fromBatch: number;
  /** Target batch number */
  toBatch: number;
  /** Whether this is a batch-to-batch edge (vs task-to-task) */
  isBatchEdge?: boolean;
}

/**
 * A routed edge with path points
 */
export interface RoutedEdge extends LayoutEdge {
  /** SVG path string for rendering */
  path: string;
  /** Control points for the edge route */
  points: Array<{ x: number; y: number }>;
}

/**
 * Complete layout result
 */
export interface ElkLayoutResult {
  /** Positioned batches (groups) */
  batches: PositionedBatch[];
  /** Positioned tasks */
  tasks: PositionedTask[];
  /** Routed edges between tasks */
  edges: RoutedEdge[];
  /** Total canvas width */
  canvasWidth: number;
  /** Total canvas height */
  canvasHeight: number;
}

// ============================================================================
// ELK Graph Types (for internal use)
// ============================================================================

/**
 * ELK node representation
 */
export interface ElkNode {
  id: string;
  width?: number;
  height?: number;
  x?: number;
  y?: number;
  children?: ElkNode[];
  edges?: ElkEdge[];
  layoutOptions?: Record<string, string>;
}

/**
 * ELK edge representation
 */
export interface ElkEdge {
  id: string;
  sources: string[];
  targets: string[];
}

/**
 * ELK root graph
 */
export interface ElkGraph extends ElkNode {
  edges?: ElkEdge[];
}
