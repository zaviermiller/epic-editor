/**
 * GitHub API Service
 *
 * Handles all interactions with the GitHub API including:
 * - Fetching issues using the REST API
 * - Fetching sub-issues using the official Sub-Issues API
 * - Fetching issue dependencies using the official Issue Dependencies API
 * - Building the Epic → Batch → Task hierarchy
 *
 * API Documentation:
 * - Sub-Issues: https://docs.github.com/en/rest/issues/sub-issues
 * - Issue Dependencies: https://docs.github.com/en/rest/issues/issue-dependencies
 */

import {
  GitHubIssue,
  GitHubUser,
  GitHubRepository,
  RepoInfo,
  Epic,
  Batch,
  Task,
  IssueStatus,
  Dependency,
  ApiError,
} from "@/types";

/**
 * Configuration for the GitHub API client
 */
interface GitHubConfig {
  token?: string;
  baseUrl?: string;
}

/**
 * Default configuration
 */
const defaultConfig: GitHubConfig = {
  baseUrl: "https://api.github.com",
};

/**
 * GitHub API version header value
 */
const API_VERSION = "2022-11-28";

/**
 * Parse a GitHub issue URL to extract owner, repo, and issue number
 *
 * @param url - GitHub issue URL (e.g., https://github.com/owner/repo/issues/123)
 * @returns Parsed repository info or null if invalid
 */
export function parseGitHubUrl(url: string): RepoInfo | null {
  // Match various GitHub URL formats
  const patterns = [
    // Standard issue URL
    /github\.com\/([^\/]+)\/([^\/]+)\/issues\/(\d+)/,
    // Short format
    /^([^\/]+)\/([^\/]+)#(\d+)$/,
  ];

  for (const pattern of patterns) {
    const match = url.trim().match(pattern);
    if (match) {
      return {
        owner: match[1],
        repo: match[2],
        issueNumber: parseInt(match[3], 10),
      };
    }
  }

  return null;
}

/**
 * Validate a GitHub issue URL format
 */
export function isValidGitHubUrl(url: string): boolean {
  return parseGitHubUrl(url) !== null;
}

/**
 * GitHub API client class
 */
export class GitHubApi {
  private config: GitHubConfig;

  constructor(config: GitHubConfig = {}) {
    this.config = { ...defaultConfig, ...config };
  }

  /**
   * Set the authentication token
   */
  setToken(token: string | undefined) {
    this.config.token = token;
  }

  /**
   * Get headers for API requests
   */
  private getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": API_VERSION,
    };

    if (this.config.token) {
      headers["Authorization"] = `Bearer ${this.config.token}`;
    }

    return headers;
  }

  /**
   * Make a request to the GitHub API
   */
  private async request<T>(
    endpoint: string,
    options?: { method?: string; body?: unknown },
  ): Promise<T> {
    const url = `${this.config.baseUrl}${endpoint}`;

    const response = await fetch(url, {
      method: options?.method || "GET",
      headers: this.getHeaders(),
      body: options?.body ? JSON.stringify(options.body) : undefined,
    });

    if (!response.ok) {
      const error: ApiError = {
        message: `GitHub API error: ${response.statusText}`,
        status: response.status,
      };

      if (response.status === 404) {
        error.message =
          "Issue not found. Check the URL and make sure the repository is accessible.";
      } else if (response.status === 403) {
        error.message =
          "Rate limit exceeded or access denied. Try authenticating with a GitHub token.";
      } else if (response.status === 401) {
        error.message =
          "Authentication required. Please provide a valid GitHub token.";
      }

      throw error;
    }

    return response.json();
  }

  /**
   * Fetch a single issue from GitHub
   */
  async getIssue(
    owner: string,
    repo: string,
    issueNumber: number,
  ): Promise<GitHubIssue> {
    return this.request<GitHubIssue>(
      `/repos/${owner}/${repo}/issues/${issueNumber}`,
    );
  }

  /**
   * Fetch sub-issues of a parent issue using the official GitHub Sub-Issues API
   *
   * API: GET /repos/{owner}/{repo}/issues/{issue_number}/sub_issues
   * Docs: https://docs.github.com/en/rest/issues/sub-issues#list-sub-issues
   */
  async getSubIssues(
    owner: string,
    repo: string,
    issueNumber: number,
    options: { per_page?: number; page?: number } = {},
  ): Promise<GitHubIssue[]> {
    const { per_page = 100, page = 1 } = options;

    try {
      const subIssues = await this.request<GitHubIssue[]>(
        `/repos/${owner}/${repo}/issues/${issueNumber}/sub_issues?per_page=${per_page}&page=${page}`,
      );
      return subIssues;
    } catch (error) {
      // If the API returns 404, the issue might not have sub-issues or the feature isn't available
      console.warn(`Failed to fetch sub-issues for #${issueNumber}:`, error);
      return [];
    }
  }

  /**
   * Fetch all sub-issues with pagination
   */
  async getAllSubIssues(
    owner: string,
    repo: string,
    issueNumber: number,
  ): Promise<GitHubIssue[]> {
    const allSubIssues: GitHubIssue[] = [];
    let page = 1;
    const perPage = 100;

    while (true) {
      const subIssues = await this.getSubIssues(owner, repo, issueNumber, {
        per_page: perPage,
        page,
      });

      if (subIssues.length === 0) break;

      allSubIssues.push(...subIssues);

      if (subIssues.length < perPage) break;
      page++;
    }

    return allSubIssues;
  }

  /**
   * Fetch issues that block the given issue (dependencies)
   *
   * API: GET /repos/{owner}/{repo}/issues/{issue_number}/dependencies/blocked_by
   * Docs: https://docs.github.com/en/rest/issues/issue-dependencies#list-dependencies-an-issue-is-blocked-by
   */
  async getBlockedByDependencies(
    owner: string,
    repo: string,
    issueNumber: number,
    options: { per_page?: number; page?: number } = {},
  ): Promise<GitHubIssue[]> {
    const { per_page = 100, page = 1 } = options;

    try {
      const dependencies = await this.request<GitHubIssue[]>(
        `/repos/${owner}/${repo}/issues/${issueNumber}/dependencies/blocked_by?per_page=${per_page}&page=${page}`,
      );
      return dependencies;
    } catch (error) {
      // If the API returns 404, the issue might not have dependencies
      console.warn(
        `Failed to fetch blocked-by dependencies for #${issueNumber}:`,
        error,
      );
      return [];
    }
  }

  /**
   * Fetch issues that are blocked by the given issue
   *
   * API: GET /repos/{owner}/{repo}/issues/{issue_number}/dependencies/blocking
   * Docs: https://docs.github.com/en/rest/issues/issue-dependencies#list-dependencies-an-issue-is-blocking
   */
  async getBlockingDependencies(
    owner: string,
    repo: string,
    issueNumber: number,
    options: { per_page?: number; page?: number } = {},
  ): Promise<GitHubIssue[]> {
    const { per_page = 100, page = 1 } = options;

    try {
      const dependencies = await this.request<GitHubIssue[]>(
        `/repos/${owner}/${repo}/issues/${issueNumber}/dependencies/blocking?per_page=${per_page}&page=${page}`,
      );
      return dependencies;
    } catch (error) {
      // If the API returns 404, the issue might not have dependencies
      console.warn(
        `Failed to fetch blocking dependencies for #${issueNumber}:`,
        error,
      );
      return [];
    }
  }

  /**
   * Get all blocked-by dependencies with pagination
   */
  async getAllBlockedByDependencies(
    owner: string,
    repo: string,
    issueNumber: number,
  ): Promise<GitHubIssue[]> {
    const allDeps: GitHubIssue[] = [];
    let page = 1;
    const perPage = 100;

    while (true) {
      const deps = await this.getBlockedByDependencies(
        owner,
        repo,
        issueNumber,
        {
          per_page: perPage,
          page,
        },
      );

      if (deps.length === 0) break;

      allDeps.push(...deps);

      if (deps.length < perPage) break;
      page++;
    }

    return allDeps;
  }

  /**
   * Add a dependency (blocked_by relationship) to an issue
   *
   * API: POST /repos/{owner}/{repo}/issues/{issue_number}/dependencies/blocked_by
   * Docs: https://docs.github.com/en/rest/issues/issue-dependencies#add-a-dependency-an-issue-is-blocked-by
   *
   * @param owner - Repository owner
   * @param repo - Repository name
   * @param issueNumber - The issue number that will be blocked
   * @param blockingIssueId - The ID (not number) of the blocking issue
   * @returns The blocking issue data
   */
  async addDependency(
    owner: string,
    repo: string,
    issueNumber: number,
    blockingIssueId: number,
  ): Promise<GitHubIssue> {
    return this.request<GitHubIssue>(
      `/repos/${owner}/${repo}/issues/${issueNumber}/dependencies/blocked_by`,
      {
        method: "POST",
        body: { issue_id: blockingIssueId },
      },
    );
  }

  /**
   * Remove a dependency (blocked_by relationship) from an issue
   *
   * API: DELETE /repos/{owner}/{repo}/issues/{issue_number}/dependencies/blocked_by/{issue_id}
   * Docs: https://docs.github.com/en/rest/issues/issue-dependencies#remove-dependency-an-issue-is-blocked-by
   *
   * @param owner - Repository owner
   * @param repo - Repository name
   * @param issueNumber - The issue number that is blocked
   * @param blockingIssueId - The ID (not number) of the blocking issue to remove
   * @returns The removed blocking issue data
   */
  async removeDependency(
    owner: string,
    repo: string,
    issueNumber: number,
    blockingIssueId: number,
  ): Promise<GitHubIssue> {
    return this.request<GitHubIssue>(
      `/repos/${owner}/${repo}/issues/${issueNumber}/dependencies/blocked_by/${blockingIssueId}`,
      {
        method: "DELETE",
      },
    );
  }

  /**
   * Add a sub-issue to a parent issue
   *
   * API: POST /repos/{owner}/{repo}/issues/{issue_number}/sub_issues
   * Docs: https://docs.github.com/en/rest/issues/sub-issues#add-sub-issue
   *
   * @param owner - Repository owner
   * @param repo - Repository name
   * @param parentIssueNumber - The issue number of the parent issue
   * @param subIssueId - The ID (not number) of the issue to add as a sub-issue
   * @param replaceParent - Whether to replace the current parent (default: true for moving between batches)
   * @returns The added sub-issue data
   */
  async addSubIssue(
    owner: string,
    repo: string,
    parentIssueNumber: number,
    subIssueId: number,
    replaceParent: boolean = true,
  ): Promise<GitHubIssue> {
    return this.request<GitHubIssue>(
      `/repos/${owner}/${repo}/issues/${parentIssueNumber}/sub_issues`,
      {
        method: "POST",
        body: { sub_issue_id: subIssueId, replace_parent: replaceParent },
      },
    );
  }

  /**
   * Remove a sub-issue from a parent issue
   *
   * API: DELETE /repos/{owner}/{repo}/issues/{issue_number}/sub_issue
   * Docs: https://docs.github.com/en/rest/issues/sub-issues#remove-sub-issue
   *
   * @param owner - Repository owner
   * @param repo - Repository name
   * @param parentIssueNumber - The issue number of the parent issue
   * @param subIssueId - The ID (not number) of the sub-issue to remove
   * @returns The removed sub-issue data
   */
  async removeSubIssue(
    owner: string,
    repo: string,
    parentIssueNumber: number,
    subIssueId: number,
  ): Promise<GitHubIssue> {
    return this.request<GitHubIssue>(
      `/repos/${owner}/${repo}/issues/${parentIssueNumber}/sub_issue`,
      {
        method: "DELETE",
        body: { sub_issue_id: subIssueId },
      },
    );
  }

  /**
   * Get the authenticated user
   */
  async getAuthenticatedUser(): Promise<GitHubUser | null> {
    if (!this.config.token) {
      return null;
    }

    try {
      return await this.request<GitHubUser>("/user");
    } catch {
      return null;
    }
  }

  /**
   * Fetch repositories for the authenticated user
   * @param options - Pagination and filtering options
   */
  async getUserRepositories(
    options: {
      per_page?: number;
      page?: number;
      sort?: "updated" | "pushed" | "full_name" | "created";
      direction?: "asc" | "desc";
      type?: "all" | "owner" | "public" | "private" | "member";
    } = {},
  ): Promise<GitHubRepository[]> {
    const {
      per_page = 30,
      page = 1,
      sort = "updated",
      direction = "desc",
      type = "all",
    } = options;

    if (!this.config.token) {
      throw { message: "Authentication required to fetch repositories" };
    }

    const queryParams = new URLSearchParams({
      per_page: per_page.toString(),
      page: page.toString(),
      sort,
      direction,
      type,
    });

    return this.request<GitHubRepository[]>(`/user/repos?${queryParams}`);
  }

  /**
   * Fetch all repositories with pagination
   */
  async getAllUserRepositories(): Promise<GitHubRepository[]> {
    const allRepos: GitHubRepository[] = [];
    let page = 1;
    const perPage = 100;

    while (true) {
      const repos = await this.getUserRepositories({
        per_page: perPage,
        page,
        sort: "updated",
      });

      if (repos.length === 0) break;

      allRepos.push(...repos);

      if (repos.length < perPage) break;
      page++;
    }

    return allRepos;
  }

  /**
   * Fetch issues for a repository
   * @param owner - Repository owner
   * @param repo - Repository name
   * @param options - Pagination and filtering options
   */
  async getRepositoryIssues(
    owner: string,
    repo: string,
    options: {
      per_page?: number;
      page?: number;
      state?: "open" | "closed" | "all";
      labels?: string;
      sort?: "created" | "updated" | "comments";
      direction?: "asc" | "desc";
    } = {},
  ): Promise<GitHubIssue[]> {
    const {
      per_page = 30,
      page = 1,
      state = "open",
      labels,
      sort = "updated",
      direction = "desc",
    } = options;

    const queryParams = new URLSearchParams({
      per_page: per_page.toString(),
      page: page.toString(),
      state,
      sort,
      direction,
    });

    if (labels) {
      queryParams.set("labels", labels);
    }

    return this.request<GitHubIssue[]>(
      `/repos/${owner}/${repo}/issues?${queryParams}`,
    );
  }

  /**
   * Fetch all issues for a repository with pagination
   */
  async getAllRepositoryIssues(
    owner: string,
    repo: string,
    options: { state?: "open" | "closed" | "all"; labels?: string } = {},
  ): Promise<GitHubIssue[]> {
    const allIssues: GitHubIssue[] = [];
    let page = 1;
    const perPage = 100;

    while (true) {
      const issues = await this.getRepositoryIssues(owner, repo, {
        per_page: perPage,
        page,
        ...options,
      });

      if (issues.length === 0) break;

      allIssues.push(...issues);

      if (issues.length < perPage) break;
      page++;
    }

    return allIssues;
  }

  /**
   * Search repositories by query
   */
  async searchRepositories(
    query: string,
    options: { per_page?: number; page?: number } = {},
  ): Promise<{ items: GitHubRepository[]; total_count: number }> {
    const { per_page = 30, page = 1 } = options;

    const queryParams = new URLSearchParams({
      q: query,
      per_page: per_page.toString(),
      page: page.toString(),
    });

    return this.request<{ items: GitHubRepository[]; total_count: number }>(
      `/search/repositories?${queryParams}`,
    );
  }
}

/**
 * Determine base issue status from GitHub issue data.
 * This returns a preliminary status that doesn't account for dependencies.
 * For open issues without in-progress labels, returns "ready" as a placeholder
 * that will be resolved to "ready" or "blocked" by resolveBlockedStatuses().
 */
export function determineIssueStatus(issue: GitHubIssue): IssueStatus {
  if (issue.state === "closed") {
    // All closed issues are "done" regardless of close reason
    return "done";
  }

  // Check labels for in-progress indicators
  const inProgressLabels = [
    "in progress",
    "in-progress",
    "wip",
    "working",
    "active",
  ];
  const hasInProgressLabel = issue.labels.some((label) =>
    inProgressLabels.includes(label.name.toLowerCase()),
  );

  if (hasInProgressLabel) {
    return "in-progress";
  }

  // Default to "ready" - will be resolved to "ready" or "blocked"
  // by resolveBlockedStatuses() based on dependency chain
  return "ready";
}

/**
 * Convert a GitHub issue to a Task with its dependencies
 */
export function issueToTask(
  issue: GitHubIssue,
  blockedByIssues: GitHubIssue[],
): Task {
  return {
    id: issue.id,
    number: issue.number,
    title: issue.title,
    body: issue.body,
    status: determineIssueStatus(issue),
    url: issue.html_url,
    labels: issue.labels,
    assignees: issue.assignees,
    dependsOn: blockedByIssues.map((dep) => dep.number),
    blockedBy: [],
  };
}

/**
 * Convert a GitHub issue to a Batch with its tasks
 */
export function issueToBatch(
  issue: GitHubIssue,
  tasks: Task[],
  blockedByIssues: GitHubIssue[],
): Batch {
  const completedTasks = tasks.filter((t) => t.status === "done").length;
  const progress =
    tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0;

  return {
    id: issue.id,
    number: issue.number,
    title: issue.title,
    body: issue.body,
    status: determineIssueStatus(issue),
    url: issue.html_url,
    labels: issue.labels,
    assignees: issue.assignees,
    tasks,
    dependsOn: blockedByIssues.map((dep) => dep.number),
    progress,
  };
}

/**
 * Build a complete Epic from a GitHub issue and its hierarchy
 */
export function buildEpic(
  issue: GitHubIssue,
  owner: string,
  repo: string,
  batches: Batch[],
  allDependencies: Dependency[],
): Epic {
  const completedBatches = batches.filter((b) => b.status === "done").length;
  const progress =
    batches.length > 0
      ? Math.round((completedBatches / batches.length) * 100)
      : 0;

  return {
    id: issue.id,
    number: issue.number,
    title: issue.title,
    body: issue.body,
    status: determineIssueStatus(issue),
    url: issue.html_url,
    labels: issue.labels,
    assignees: issue.assignees,
    owner,
    repo,
    batches,
    progress,
    dependencies: allDependencies,
  };
}

/**
 * Resolve "ready" statuses to either "ready", "blocked", or "unknown" based on dependency chain.
 *
 * An issue is "blocked" if any of its dependencies (direct or transitive) is not "done".
 * An issue is "ready" if it has no dependencies OR all dependencies are "done".
 * An issue is "unknown" if any dependency's status could not be determined.
 *
 * This function handles:
 * - Transitive dependencies (A depends on B depends on C - if C is not done, A is blocked)
 * - Circular dependencies (if detected, issues in the cycle are marked as blocked)
 * - Cross-batch dependencies (task in batch A depends on task in batch B)
 * - External dependencies (issues not in the epic hierarchy - fetched via API)
 * - Cross-repo dependencies (issues in different repositories)
 *
 * @param epic - The epic to resolve statuses for
 * @param api - Optional API instance for fetching external dependencies. If not provided,
 *              external dependencies are assumed to be "done" (legacy behavior).
 * @param epicOwner - Owner of the epic's repository (for same-repo dependency lookups)
 * @param epicRepo - Name of the epic's repository (for same-repo dependency lookups)
 */
export async function resolveBlockedStatuses(
  epic: Epic,
  api?: GitHubApi,
  epicOwner?: string,
  epicRepo?: string,
): Promise<Epic> {
  // Build a map of issue number → issue data for quick lookups
  const issueMap = new Map<
    number,
    { status: IssueStatus; dependsOn: number[]; isTask: boolean }
  >();

  // Populate the map with all batches and tasks
  for (const batch of epic.batches) {
    // Skip synthetic batches (number === -1) as they don't have real dependencies
    if (batch.number !== -1) {
      issueMap.set(batch.number, {
        status: batch.status,
        dependsOn: batch.dependsOn,
        isTask: false,
      });
    }

    for (const task of batch.tasks) {
      issueMap.set(task.number, {
        status: task.status,
        dependsOn: task.dependsOn,
        isTask: true,
      });
    }
  }

  // Collect all dependency targets to identify external dependencies
  const allDependencyTargets = new Set<number>();
  for (const batch of epic.batches) {
    batch.dependsOn.forEach((d) => allDependencyTargets.add(d));
    for (const task of batch.tasks) {
      task.dependsOn.forEach((d) => allDependencyTargets.add(d));
    }
  }

  // Identify external dependencies (not in the loaded hierarchy)
  const externalDeps = [...allDependencyTargets].filter(
    (n) => !issueMap.has(n),
  );

  // Fetch status of external dependencies if API is available
  const externalStatuses = new Map<number, IssueStatus>();
  if (api && epicOwner && epicRepo && externalDeps.length > 0) {
    // Fetch external dependencies in parallel (batch of 5 to avoid rate limiting)
    const batchSize = 5;
    for (let i = 0; i < externalDeps.length; i += batchSize) {
      const batch = externalDeps.slice(i, i + batchSize);
      const results = await Promise.all(
        batch.map(async (depNum) => {
          try {
            // Try to fetch from the same repo first
            const issue = await api.getIssue(epicOwner, epicRepo, depNum);
            return { depNum, status: determineIssueStatus(issue) };
          } catch {
            // If not found, mark as unknown
            return { depNum, status: "unknown" as IssueStatus };
          }
        }),
      );
      for (const { depNum, status } of results) {
        externalStatuses.set(depNum, status);
      }
    }
  }

  // Cache for resolved statuses to avoid recomputation
  const resolvedStatus = new Map<number, IssueStatus>();

  /**
   * Recursively resolve the status of an issue based on its dependency chain.
   * Uses memoization and cycle detection.
   */
  function resolveStatus(
    issueNumber: number,
    visiting: Set<number>,
  ): IssueStatus {
    // Check cache first
    if (resolvedStatus.has(issueNumber)) {
      return resolvedStatus.get(issueNumber)!;
    }

    const issue = issueMap.get(issueNumber);

    // If issue not found in our map, check external statuses
    if (!issue) {
      if (externalStatuses.has(issueNumber)) {
        return externalStatuses.get(issueNumber)!;
      }
      // No API provided or fetch failed - assume "done" for backward compatibility
      // This happens when resolveBlockedStatuses is called without API (e.g., mock data)
      return "done";
    }

    // If already done or in-progress, no need to resolve further
    if (issue.status === "done" || issue.status === "in-progress") {
      resolvedStatus.set(issueNumber, issue.status);
      return issue.status;
    }

    // Cycle detection: if we're already visiting this issue, it's blocked
    if (visiting.has(issueNumber)) {
      return "blocked";
    }

    // No dependencies means ready
    if (issue.dependsOn.length === 0) {
      resolvedStatus.set(issueNumber, "ready");
      return "ready";
    }

    // Add to visiting set for cycle detection
    visiting.add(issueNumber);

    // Check all dependencies
    let isBlocked = false;
    let hasUnknown = false;
    for (const depNumber of issue.dependsOn) {
      const depStatus = resolveStatus(depNumber, visiting);

      // Track unknown status
      if (depStatus === "unknown") {
        hasUnknown = true;
      }

      // If any dependency is not done, this issue is blocked
      if (depStatus !== "done") {
        isBlocked = true;
        // Don't break early - continue to check for unknown status
      }
    }

    // Remove from visiting set
    visiting.delete(issueNumber);

    // Determine final status:
    // - If any dependency is unknown and would block, mark as unknown
    // - Otherwise, blocked or ready based on dependency states
    let finalStatus: IssueStatus;
    if (hasUnknown && isBlocked) {
      // We're blocked but at least one blocker is unknown
      // Check if we're blocked by known issues or only unknown ones
      const hasKnownBlocker = issue.dependsOn.some((depNum) => {
        const depStatus = resolvedStatus.get(depNum) ?? externalStatuses.get(depNum);
        return depStatus && depStatus !== "done" && depStatus !== "unknown";
      });
      finalStatus = hasKnownBlocker ? "blocked" : "unknown";
    } else {
      finalStatus = isBlocked ? "blocked" : "ready";
    }
    
    resolvedStatus.set(issueNumber, finalStatus);
    return finalStatus;
  }

  // Resolve all issues
  for (const issueNumber of issueMap.keys()) {
    resolveStatus(issueNumber, new Set());
  }

  // Apply resolved statuses back to the epic
  const updatedBatches = epic.batches.map((batch) => {
    // Update tasks first
    const updatedTasks = batch.tasks.map((task) => ({
      ...task,
      status: resolvedStatus.get(task.number) ?? task.status,
    }));

    // Determine batch status
    let batchStatus: IssueStatus;
    if (batch.number === -1) {
      // Synthetic batch: derive status from tasks
      if (updatedTasks.every((t) => t.status === "done")) {
        batchStatus = "done";
      } else if (updatedTasks.some((t) => t.status === "unknown")) {
        batchStatus = "unknown";
      } else if (updatedTasks.some((t) => t.status === "blocked")) {
        batchStatus = "blocked";
      } else if (
        updatedTasks.some(
          (t) => t.status === "in-progress" || t.status === "done",
        )
      ) {
        batchStatus = "in-progress";
      } else {
        batchStatus = "ready";
      }
    } else {
      // Real batch: use resolved status
      batchStatus = resolvedStatus.get(batch.number) ?? batch.status;
    }

    return {
      ...batch,
      tasks: updatedTasks,
      status: batchStatus,
    };
  });

  return {
    ...epic,
    batches: updatedBatches,
  };
}

/**
 * Fetch a complete Epic with all its batches and tasks
 * using the official GitHub Sub-Issues and Issue Dependencies APIs.
 *
 * This is the main entry point for loading an Epic hierarchy.
 *
 * Dynamic Hierarchy:
 * - Epic (parent issue)
 *   - Sub-issues with children → Batches (contain tasks)
 *   - Sub-issues without children → Tasks (grouped in synthetic "Tasks" batch)
 *
 * This approach dynamically determines what is a "batch" vs a "task":
 * - If a sub-issue has its own sub-issues, it becomes a Batch
 * - If a sub-issue has no sub-issues, it becomes a Task
 * - For nested sub-issues, we only go 1 level deep (tasks within batches don't recurse)
 *
 * Dependencies are fetched using the blocked_by API for each issue.
 */
export async function fetchEpicHierarchy(
  api: GitHubApi,
  owner: string,
  repo: string,
  issueNumber: number,
): Promise<Epic> {
  // Fetch the epic issue
  const epicIssue = await api.getIssue(owner, repo, issueNumber);

  // Fetch all direct sub-issues of the epic
  const directSubIssues = await api.getAllSubIssues(owner, repo, issueNumber);

  // Build batches with their tasks
  const batches: Batch[] = [];
  const allDependencies: Dependency[] = [];

  // Collect standalone tasks (sub-issues with no children)
  const standaloneTasks: Task[] = [];

  // Fetch epic-level dependencies
  const epicBlockedBy = await api.getAllBlockedByDependencies(
    owner,
    repo,
    issueNumber,
  );
  for (const dep of epicBlockedBy) {
    allDependencies.push({
      from: issueNumber,
      to: dep.number,
      type: "depends-on",
    });
  }

  // Process each direct sub-issue to determine if it's a batch or task
  for (const subIssue of directSubIssues) {
    // Fetch sub-issues to determine if this is a batch (has children) or task (no children)
    const childIssues = await api.getAllSubIssues(owner, repo, subIssue.number);

    // Fetch dependencies for this issue
    const subIssueBlockedBy = await api.getAllBlockedByDependencies(
      owner,
      repo,
      subIssue.number,
    );
    for (const dep of subIssueBlockedBy) {
      allDependencies.push({
        from: subIssue.number,
        to: dep.number,
        type: "depends-on",
      });
    }

    if (childIssues.length > 0) {
      // This sub-issue has children → treat as a Batch
      // Its children become Tasks (only 1 level deep - we don't recurse further)
      const tasks: Task[] = [];

      for (const childIssue of childIssues) {
        // Fetch task-level dependencies
        const taskBlockedBy = await api.getAllBlockedByDependencies(
          owner,
          repo,
          childIssue.number,
        );

        for (const dep of taskBlockedBy) {
          allDependencies.push({
            from: childIssue.number,
            to: dep.number,
            type: "depends-on",
          });
        }

        const task = issueToTask(childIssue, taskBlockedBy);
        tasks.push(task);
      }

      const batch = issueToBatch(subIssue, tasks, subIssueBlockedBy);
      batches.push(batch);
    } else {
      // This sub-issue has no children → treat as a standalone Task
      const task = issueToTask(subIssue, subIssueBlockedBy);
      standaloneTasks.push(task);
    }
  }

  // If there are standalone tasks, create a synthetic batch to contain them
  // This ensures they are displayed properly in the visualization
  if (standaloneTasks.length > 0) {
    const syntheticBatch: Batch = {
      id: -1, // Synthetic ID (negative to avoid conflicts)
      number: -1, // Synthetic number
      title: "Tasks",
      body: null,
      // Synthetic batch status is derived from its tasks
      // Will be updated by resolveBlockedStatuses()
      status: standaloneTasks.every((t) => t.status === "done")
        ? "done"
        : standaloneTasks.some(
              (t) => t.status === "in-progress" || t.status === "done",
            )
          ? "in-progress"
          : "ready",
      url: epicIssue.html_url,
      labels: [],
      assignees: [],
      tasks: standaloneTasks,
      dependsOn: [],
      progress: Math.round(
        (standaloneTasks.filter((t) => t.status === "done").length /
          standaloneTasks.length) *
          100,
      ),
    };
    // Add synthetic batch at the beginning so it appears first
    batches.unshift(syntheticBatch);
  }

  const epic = buildEpic(epicIssue, owner, repo, batches, allDependencies);

  // Resolve "ready" statuses to "ready", "blocked", or "unknown" based on dependency chain
  // Pass the API so we can fetch external dependency statuses
  return resolveBlockedStatuses(epic, api, owner, repo);
}

/**
 * Default API instance
 */
export const githubApi = new GitHubApi();
