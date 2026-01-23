/**
 * Visualization Page
 *
 * Displays an Epic visualization at a dedicated URL.
 * Supports caching via localStorage for favorites.
 */

"use client";

import { useEffect, useState, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import { ElkEpicDiagram } from "@/components/ElkEpicDiagram";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import {
  Github,
  ArrowLeft,
  Loader2,
  AlertCircle,
  Star,
  RefreshCw,
  ExternalLink,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Epic, Task, LoadingState, ApiError } from "@/types";
import { GitHubApi, fetchEpicHierarchy } from "@/lib/github";
import { getMockEpic } from "@/lib/mockData";
import {
  getFavoriteByRepoInfo,
  isFavorite,
  saveFavorite,
  removeFavoriteByRepoInfo,
  updateFavoriteEpic,
} from "@/lib/favorites";

interface VisPageProps {
  params: Promise<{
    owner: string;
    repo: string;
    issue: string;
  }>;
}

/**
 * Error display component
 */
function ErrorDisplay({
  error,
  onRetry,
  onGoHome,
}: {
  error: { message: string };
  onRetry: () => void;
  onGoHome: () => void;
}) {
  return (
    <Card className="border-destructive/50 bg-destructive/10 max-w-lg mx-auto mt-8">
      <CardContent className="flex flex-col items-center gap-4 p-6">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <div className="text-center">
          <h3 className="font-semibold text-destructive text-lg">
            Error Loading Epic
          </h3>
          <p className="text-sm text-muted-foreground mt-1">{error.message}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onGoHome}>
            Go Home
          </Button>
          <Button onClick={onRetry}>Try Again</Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function VisPage({ params }: VisPageProps) {
  const { owner, repo, issue } = use(params);
  const issueNumber = parseInt(issue, 10);
  const isMockRoute = owner === "mock" && repo === "demo";
  const router = useRouter();
  const { isAuthenticated, user, signIn, signOut, getToken } = useAuth();

  const [epic, setEpic] = useState<Epic | null>(null);
  const [loadingState, setLoadingState] = useState<LoadingState>("idle");
  const [error, setError] = useState<ApiError | null>(null);
  const [isFavorited, setIsFavorited] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Check favorite status on mount (not for mock)
  useEffect(() => {
    if (!isMockRoute) {
      setIsFavorited(isFavorite(owner, repo, issueNumber));
    }
  }, [owner, repo, issueNumber, isMockRoute]);

  /**
   * Fetch epic data from GitHub API (or load mock data)
   */
  const fetchEpic = useCallback(
    async (isBackgroundRefresh = false) => {
      // Handle mock route
      if (isMockRoute) {
        setLoadingState("loading");
        // Small delay to simulate loading
        setTimeout(() => {
          setEpic(getMockEpic());
          setLoadingState("success");
        }, 300);
        return;
      }

      if (!isBackgroundRefresh) {
        setLoadingState("loading");
        setError(null);
      } else {
        setIsRefreshing(true);
      }

      try {
        const token = await getToken();
        const api = new GitHubApi();
        api.setToken(token || undefined);

        const loadedEpic = await fetchEpicHierarchy(
          api,
          owner,
          repo,
          issueNumber,
        );

        setEpic(loadedEpic);
        setLoadingState("success");

        // Update localStorage if this is a favorite
        if (isFavorite(owner, repo, issueNumber)) {
          updateFavoriteEpic(loadedEpic);
        }
      } catch (err) {
        if (!isBackgroundRefresh) {
          const apiError: ApiError =
            err instanceof Error
              ? { message: err.message }
              : { message: "An unexpected error occurred" };
          setError(apiError);
          setLoadingState("error");
        } else {
          // Silently fail for background refresh
          console.error("Background refresh failed:", err);
        }
      } finally {
        if (isBackgroundRefresh) {
          setIsRefreshing(false);
        }
      }
    },
    [owner, repo, issueNumber, getToken, isMockRoute],
  );

  /**
   * Load epic - first check localStorage, then fetch
   */
  useEffect(() => {
    // Check if we have cached data for this epic
    const cached = getFavoriteByRepoInfo(owner, repo, issueNumber);

    if (cached) {
      // Use cached data immediately
      setEpic(cached.epic);
      setLoadingState("success");

      // Refresh in the background
      fetchEpic(true);
    } else {
      // No cached data, fetch fresh
      fetchEpic(false);
    }
  }, [owner, repo, issueNumber, fetchEpic]);

  /**
   * Handle task click to open in GitHub
   */
  const handleTaskClick = (task: Task) => {
    window.open(task.url, "_blank");
  };

  /**
   * Toggle favorite status
   */
  const handleToggleFavorite = () => {
    if (!epic) return;

    if (isFavorited) {
      removeFavoriteByRepoInfo(owner, repo, issueNumber);
      setIsFavorited(false);
    } else {
      saveFavorite(epic);
      setIsFavorited(true);
    }
  };

  /**
   * Manual refresh
   */
  const handleRefresh = () => {
    fetchEpic(false);
  };

  /**
   * Go back to home
   */
  const handleGoHome = () => {
    router.push("/");
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Header */}
      <header className="border-b border-border bg-card shrink-0">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            {/* Logo and navigation */}
            <div className="flex items-center gap-3 min-w-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleGoHome}
                className="shrink-0"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>

              {/* Epic title and link */}
              {epic ? (
                <div className="flex items-center gap-2 min-w-0">
                  <h1 className="text-lg font-semibold truncate">
                    {epic.title}{" "}
                    <span className="text-muted-foreground">
                      #{epic.number}
                    </span>
                  </h1>
                  <a
                    href={epic.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                    title="Open in GitHub"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Github className="h-5 w-5 text-primary" />
                  <span className="text-lg font-semibold">Epic Visualizer</span>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3">
              {epic && (
                <>
                  {!isMockRoute && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleRefresh}
                      disabled={loadingState === "loading" || isRefreshing}
                    >
                      <RefreshCw
                        className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
                      />
                    </Button>
                  )}
                  {!isMockRoute && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleToggleFavorite}
                      className={isFavorited ? "text-yellow-500" : ""}
                    >
                      <Star
                        className={`h-4 w-4 ${isFavorited ? "fill-current" : ""}`}
                      />
                    </Button>
                  )}
                </>
              )}

              {/* Auth status */}
              {isAuthenticated && user ? (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    {user.login}
                  </span>
                  <Button variant="outline" size="sm" onClick={signOut}>
                    Sign out
                  </Button>
                </div>
              ) : (
                <Button variant="outline" size="sm" onClick={signIn}>
                  <Github className="h-4 w-4 mr-2" />
                  Sign in with GitHub
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-hidden min-h-0">
        {/* Loading state */}
        {loadingState === "loading" && (
          <div className="flex-1 flex flex-col items-center justify-center py-16">
            <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Loading Epic hierarchy...</p>
            <p className="text-xs text-muted-foreground mt-1">
              {owner}/{repo}#{issue}
            </p>
          </div>
        )}

        {/* Error state */}
        {loadingState === "error" && error && (
          <div className="p-4">
            <ErrorDisplay
              error={error}
              onRetry={handleRefresh}
              onGoHome={handleGoHome}
            />
          </div>
        )}

        {/* Epic diagram */}
        {epic && loadingState === "success" && (
          <div className="flex-1 min-h-0 h-full relative">
            {isRefreshing && (
              <div className="absolute top-4 right-4 z-30 bg-background/80 rounded-full px-3 py-1 flex items-center gap-2 text-sm text-muted-foreground">
                <RefreshCw className="h-3 w-3 animate-spin" />
                Refreshing...
              </div>
            )}
            <ElkEpicDiagram
              epic={epic}
              onTaskClick={handleTaskClick}
              showHeader={false}
            />
          </div>
        )}
      </main>
    </div>
  );
}
