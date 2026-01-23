/**
 * Core Types for GitHub Epic Visualizer
 *
 * This file defines the TypeScript interfaces for the issue hierarchy:
 * Epic → Batches → Tasks
 *
 * The hierarchy follows GitHub's sub-issue structure where:
 * - An Epic is the top-level parent issue
 * - Batches are direct sub-issues of an Epic
 * - Tasks are sub-issues of Batches
 */

/**
 * Status of an issue based on GitHub's issue state and tracking
 */
export type IssueStatus = "done" | "in-progress" | "planned" | "not-planned";

/**
 * GitHub Issue type - represents a single issue from the API
 */
export interface GitHubIssue {
  /** Issue number within the repository */
  number: number;
  /** Issue title */
  title: string;
  /** Full issue body/description in markdown */
  body: string | null;
  /** Issue state (open/closed) */
  state: "open" | "closed";
  /** HTML URL for the issue */
  html_url: string;
  /** Labels attached to the issue */
  labels: GitHubLabel[];
  /** User who created the issue */
  user: GitHubUser | null;
  /** Assignees for the issue */
  assignees: GitHubUser[];
  /** Issue creation timestamp */
  created_at: string;
  /** Last update timestamp */
  updated_at: string;
  /** Close timestamp if closed */
  closed_at: string | null;
  /** State reason for closed issues */
  state_reason?: "completed" | "not_planned" | "reopened" | null;
}

/**
 * GitHub Label type
 */
export interface GitHubLabel {
  id: number;
  name: string;
  color: string;
  description: string | null;
}

/**
 * GitHub User type
 */
export interface GitHubUser {
  id: number;
  login: string;
  avatar_url: string;
  html_url: string;
}

/**
 * Parsed repository information from a GitHub URL
 */
export interface RepoInfo {
  owner: string;
  repo: string;
  issueNumber: number;
}

/**
 * GitHub Repository type - represents a repository from the API
 */
export interface GitHubRepository {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  owner: GitHubUser;
  private: boolean;
  updated_at: string;
  open_issues_count: number;
}

/**
 * A dependency between two issues
 */
export interface Dependency {
  /** Issue number that depends on another */
  from: number;
  /** Issue number that is depended upon */
  to: number;
  /** Type of dependency relationship */
  type: "depends-on" | "blocks" | "related";
}

/**
 * Base issue type with common properties
 */
export interface BaseIssue {
  /** Issue number */
  number: number;
  /** Issue title */
  title: string;
  /** Full issue body */
  body: string | null;
  /** Computed status based on state and labels */
  status: IssueStatus;
  /** HTML URL for the issue */
  url: string;
  /** Labels on the issue */
  labels: GitHubLabel[];
  /** Issue assignees */
  assignees: GitHubUser[];
}

/**
 * Task - the lowest level of the hierarchy
 * A task is a sub-issue of a Batch
 */
export interface Task extends BaseIssue {
  /** IDs of issues this task depends on */
  dependsOn: number[];
  /** IDs of issues that depend on this task */
  blockedBy: number[];
}

/**
 * Batch - a grouping of related tasks
 * A batch is a sub-issue of an Epic
 */
export interface Batch extends BaseIssue {
  /** Tasks that belong to this batch */
  tasks: Task[];
  /** IDs of other batches this batch depends on */
  dependsOn: number[];
  /** Progress percentage (0-100) */
  progress: number;
}

/**
 * Epic - the top-level parent issue
 * Contains batches which contain tasks
 */
export interface Epic extends BaseIssue {
  /** Owner of the repository */
  owner: string;
  /** Repository name */
  repo: string;
  /** Batches that belong to this epic */
  batches: Batch[];
  /** Overall progress percentage (0-100) */
  progress: number;
  /** All dependencies parsed from the entire hierarchy */
  dependencies: Dependency[];
}

/**
 * Loading state for async operations
 */
export type LoadingState = "idle" | "loading" | "success" | "error";

/**
 * Error details for API failures
 */
export interface ApiError {
  message: string;
  status?: number;
  details?: string;
}

/**
 * Application state for the Epic Visualizer
 */
export interface AppState {
  /** Current loading state */
  loadingState: LoadingState;
  /** Error if any */
  error: ApiError | null;
  /** Currently loaded epic */
  epic: Epic | null;
  /** GitHub authentication status */
  isAuthenticated: boolean;
  /** Authenticated user info */
  user: GitHubUser | null;
}

/**
 * Position for diagram elements
 */
export interface Position {
  x: number;
  y: number;
}

/**
 * Dimensions for diagram elements
 */
export interface Dimensions {
  width: number;
  height: number;
}

/**
 * Layout information for a batch container in the diagram
 */
export interface BatchLayout {
  batch: Batch;
  position: Position;
  dimensions: Dimensions;
  taskLayouts: TaskLayout[];
}

/**
 * Layout information for a task card in the diagram
 */
export interface TaskLayout {
  task: Task;
  position: Position;
  dimensions: Dimensions;
}

/**
 * Diagram view state for pan/zoom
 */
export interface ViewState {
  /** X offset for panning */
  offsetX: number;
  /** Y offset for panning */
  offsetY: number;
  /** Zoom level (1 = 100%) */
  zoom: number;
}
