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
 * Determine issue status from GitHub issue data
 */
export function determineIssueStatus(issue: GitHubIssue): IssueStatus {
  if (issue.state === "closed") {
    if (issue.state_reason === "not_planned") {
      return "not-planned";
    }
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

  return "planned";
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
      status: standaloneTasks.every((t) => t.status === "done")
        ? "done"
        : standaloneTasks.some(
              (t) => t.status === "in-progress" || t.status === "done",
            )
          ? "in-progress"
          : "planned",
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

  return buildEpic(epicIssue, owner, repo, batches, allDependencies);
}

/**
 * Default API instance
 */
export const githubApi = new GitHubApi();
