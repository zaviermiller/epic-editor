/**
 * RepoBrowser Component
 *
 * A dialog that allows users to browse their GitHub repositories
 * and select Epic issues from them.
 */

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { GitHubApi } from "@/lib/github";
import { GitHubRepository, GitHubIssue, RepoInfo, GitHubLabel } from "@/types";
import { useAuth } from "@/lib/auth";
import {
  SearchIcon,
  SyncIcon,
  ChevronRightIcon,
  ArrowLeftIcon,
  AlertIcon,
  LockIcon,
  RepoIcon,
  LinkExternalIcon,
} from "@primer/octicons-react";

interface RepoBrowserProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback to close the dialog */
  onOpenChange: (open: boolean) => void;
  /** Callback when an epic is selected */
  onSelectEpic: (repoInfo: RepoInfo) => void;
}

type ViewState = "repos" | "issues";

export function RepoBrowser({
  open,
  onOpenChange,
  onSelectEpic,
}: RepoBrowserProps) {
  const { getToken, isAuthenticated } = useAuth();
  const apiRef = useRef<GitHubApi>(new GitHubApi());

  // State
  const [viewState, setViewState] = useState<ViewState>("repos");
  const [repositories, setRepositories] = useState<GitHubRepository[]>([]);
  const [filteredRepos, setFilteredRepos] = useState<GitHubRepository[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<GitHubRepository | null>(
    null,
  );
  const [issues, setIssues] = useState<GitHubIssue[]>([]);
  const [filteredIssues, setFilteredIssues] = useState<GitHubIssue[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  /**
   * Ensure API has the current token
   */
  const ensureToken = useCallback(async () => {
    const token = await getToken();
    apiRef.current.setToken(token || undefined);
  }, [getToken]);

  /**
   * Load user repositories
   */
  const loadRepositories = useCallback(async () => {
    if (!isAuthenticated) return;

    setIsLoading(true);
    setError(null);

    try {
      await ensureToken();
      const repos = await apiRef.current.getAllUserRepositories();
      setRepositories(repos);
      setFilteredRepos(repos);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to load repositories";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, ensureToken]);

  /**
   * Load issues for the selected repository
   */
  const loadIssues = useCallback(
    async (repo: GitHubRepository) => {
      setIsLoading(true);
      setError(null);
      setSelectedRepo(repo);
      setViewState("issues");

      try {
        await ensureToken();
        // Fetch all open issues - the user can then filter for epics
        const allIssues = await apiRef.current.getRepositoryIssues(
          repo.owner.login,
          repo.name,
          { state: "open", per_page: 100 },
        );
        setIssues(allIssues);
        setFilteredIssues(allIssues);
        setSearchQuery("");
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to load issues";
        setError(message);
      } finally {
        setIsLoading(false);
      }
    },
    [ensureToken],
  );

  /**
   * Handle epic selection
   */
  const handleSelectEpic = useCallback(
    (issue: GitHubIssue) => {
      if (!selectedRepo) return;

      const repoInfo: RepoInfo = {
        owner: selectedRepo.owner.login,
        repo: selectedRepo.name,
        issueNumber: issue.number,
      };

      onSelectEpic(repoInfo);
      onOpenChange(false);

      // Reset state
      setViewState("repos");
      setSelectedRepo(null);
      setIssues([]);
      setSearchQuery("");
    },
    [selectedRepo, onSelectEpic, onOpenChange],
  );

  /**
   * Go back to repository list
   */
  const handleBackToRepos = useCallback(() => {
    setViewState("repos");
    setSelectedRepo(null);
    setIssues([]);
    setFilteredIssues([]);
    setSearchQuery("");
    setError(null);
  }, []);

  /**
   * Filter repositories based on search
   */
  useEffect(() => {
    if (viewState === "repos") {
      if (!searchQuery.trim()) {
        setFilteredRepos(repositories);
      } else {
        const query = searchQuery.toLowerCase();
        setFilteredRepos(
          repositories.filter(
            (repo) =>
              repo.name.toLowerCase().includes(query) ||
              repo.full_name.toLowerCase().includes(query) ||
              repo.description?.toLowerCase().includes(query),
          ),
        );
      }
    }
  }, [searchQuery, repositories, viewState]);

  /**
   * Filter issues based on search
   */
  useEffect(() => {
    if (viewState === "issues") {
      if (!searchQuery.trim()) {
        setFilteredIssues(issues);
      } else {
        const query = searchQuery.toLowerCase();
        setFilteredIssues(
          issues.filter(
            (issue) =>
              issue.title.toLowerCase().includes(query) ||
              issue.number.toString().includes(query) ||
              issue.labels.some((l) => l.name.toLowerCase().includes(query)),
          ),
        );
      }
    }
  }, [searchQuery, issues, viewState]);

  /**
   * Load repositories when dialog opens
   */
  useEffect(() => {
    if (open && isAuthenticated && repositories.length === 0) {
      loadRepositories();
    }
  }, [open, isAuthenticated, repositories.length, loadRepositories]);

  /**
   * Reset state when dialog closes
   */
  useEffect(() => {
    if (!open) {
      setViewState("repos");
      setSelectedRepo(null);
      setIssues([]);
      setFilteredIssues([]);
      setSearchQuery("");
      setError(null);
    }
  }, [open]);

  /**
   * Render label badges
   */
  const renderLabels = (labels: GitHubLabel[]) => {
    return labels.slice(0, 3).map((label) => (
      <Badge
        key={label.id}
        variant="outline"
        className="text-xs"
        style={{
          backgroundColor: `#${label.color}20`,
          borderColor: `#${label.color}`,
          color: `#${label.color}`,
        }}
      >
        {label.name}
      </Badge>
    ));
  };

  /**
   * Check if an issue looks like an Epic (has sub-issues indicator or epic label)
   */
  const isLikelyEpic = (issue: GitHubIssue): boolean => {
    const epicLabels = ["epic", "tracking", "parent", "umbrella", "meta"];
    return issue.labels.some((label) =>
      epicLabels.some((el) => label.name.toLowerCase().includes(el)),
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center gap-2">
            {viewState === "issues" && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleBackToRepos}
                className="h-8 w-8 p-0"
              >
                <ArrowLeftIcon size={16} />
              </Button>
            )}
            <div>
              <DialogTitle>
                {viewState === "repos"
                  ? "Select Repository"
                  : `Select Epic from ${selectedRepo?.name}`}
              </DialogTitle>
              <DialogDescription>
                {viewState === "repos"
                  ? "Choose a repository to browse its Epic issues"
                  : "Select an issue to visualize as an Epic"}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Search input */}
        <div className="relative">
          <SearchIcon
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            placeholder={
              viewState === "repos"
                ? "Search repositories..."
                : "Search issues by title, number, or label..."
            }
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <SyncIcon size={32} className="animate-spin text-primary mb-3" />
              <p className="text-sm text-muted-foreground">
                {viewState === "repos"
                  ? "Loading repositories..."
                  : "Loading issues..."}
              </p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <AlertIcon size={32} className="text-destructive mb-3" />
              <p className="text-sm text-destructive font-medium">Error</p>
              <p className="text-sm text-muted-foreground mt-1">{error}</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={
                  viewState === "repos"
                    ? loadRepositories
                    : () => selectedRepo && loadIssues(selectedRepo)
                }
              >
                Try Again
              </Button>
            </div>
          ) : viewState === "repos" ? (
            <ScrollArea className="h-100 pr-4">
              {filteredRepos.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <RepoIcon size={32} className="text-muted-foreground mb-3" />
                  <p className="text-sm text-muted-foreground">
                    {searchQuery
                      ? "No repositories match your search"
                      : "No repositories found"}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredRepos.map((repo) => (
                    <button
                      key={repo.id}
                      onClick={() => loadIssues(repo)}
                      className="w-full text-left p-3 rounded-lg border border-border hover:bg-muted hover:border-muted-foreground/20 transition-colors cursor-pointer group"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            {repo.private ? (
                              <LockIcon
                                size={16}
                                className="text-muted-foreground shrink-0"
                              />
                            ) : (
                              <RepoIcon
                                size={16}
                                className="text-muted-foreground shrink-0"
                              />
                            )}
                            <span className="font-medium truncate">
                              {repo.full_name}
                            </span>
                          </div>
                          {repo.description && (
                            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                              {repo.description}
                            </p>
                          )}
                          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <AlertIcon size={12} />
                              {repo.open_issues_count} issues
                            </span>
                            <span>
                              Updated{" "}
                              {new Date(repo.updated_at).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                        <ChevronRightIcon
                          size={20}
                          className="text-muted-foreground shrink-0 group-hover:text-foreground transition-colors"
                        />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          ) : (
            <ScrollArea className="h-100 pr-4">
              {filteredIssues.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <AlertIcon size={32} className="text-muted-foreground mb-3" />
                  <p className="text-sm text-muted-foreground">
                    {searchQuery
                      ? "No issues match your search"
                      : "No open issues found in this repository"}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {/* Show likely epics first */}
                  {filteredIssues
                    .sort((a, b) => {
                      const aEpic = isLikelyEpic(a);
                      const bEpic = isLikelyEpic(b);
                      if (aEpic && !bEpic) return -1;
                      if (!aEpic && bEpic) return 1;
                      return 0;
                    })
                    .map((issue) => (
                      <button
                        key={issue.number}
                        onClick={() => handleSelectEpic(issue)}
                        className="w-full text-left p-3 rounded-lg border border-border hover:bg-muted hover:border-muted-foreground/20 transition-colors cursor-pointer group"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-muted-foreground shrink-0">
                                #{issue.number}
                              </span>
                              <span className="font-medium">{issue.title}</span>
                              {isLikelyEpic(issue) && (
                                <Badge
                                  variant="secondary"
                                  className="text-xs bg-primary/10 text-primary"
                                >
                                  Likely Epic
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-2 flex-wrap">
                              {renderLabels(issue.labels)}
                              {issue.labels.length > 3 && (
                                <span className="text-xs text-muted-foreground">
                                  +{issue.labels.length - 3} more
                                </span>
                              )}
                            </div>
                            {issue.assignees.length > 0 && (
                              <div className="flex items-center gap-1 mt-2">
                                {issue.assignees.slice(0, 3).map((assignee) => (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    key={assignee.id}
                                    src={assignee.avatar_url}
                                    alt={assignee.login}
                                    title={assignee.login}
                                    className="w-5 h-5 rounded-full border border-border"
                                  />
                                ))}
                                {issue.assignees.length > 3 && (
                                  <span className="text-xs text-muted-foreground ml-1">
                                    +{issue.assignees.length - 3}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                          <LinkExternalIcon
                            size={16}
                            className="text-muted-foreground shrink-0 group-hover:text-foreground transition-colors"
                          />
                        </div>
                      </button>
                    ))}
                </div>
              )}
            </ScrollArea>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
