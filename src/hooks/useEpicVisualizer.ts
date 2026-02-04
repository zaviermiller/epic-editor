/**
 * useEpicVisualizer Hook
 *
 * Custom hook that manages the state and data fetching for the Epic Visualizer.
 * Handles loading Epic hierarchies from GitHub.
 */

"use client";

import { useState, useCallback, useRef } from "react";
import { Epic, RepoInfo, LoadingState, ApiError } from "@/types";
import { GitHubApi, fetchEpicHierarchy } from "@/lib/github";
import { getMockEpic } from "@/lib/mockData";
import { useAuth } from "@/lib/auth";

interface UseEpicVisualizerReturn {
  /** Current loading state */
  loadingState: LoadingState;
  /** Error if any */
  error: ApiError | null;
  /** Warning message (e.g., project status fetch failed) */
  warning: string | null;
  /** Currently loaded epic */
  epic: Epic | null;
  /** Load an Epic from a repository */
  loadEpic: (repoInfo: RepoInfo) => Promise<void>;
  /** Load mock data for testing */
  loadMockEpic: () => void;
  /** Clear the current epic */
  clearEpic: () => void;
  /** Clear any errors */
  clearError: () => void;
  /** Clear the warning */
  clearWarning: () => void;
}

export function useEpicVisualizer(): UseEpicVisualizerReturn {
  const [loadingState, setLoadingState] = useState<LoadingState>("idle");
  const [error, setError] = useState<ApiError | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [epic, setEpic] = useState<Epic | null>(null);
  const apiRef = useRef<GitHubApi>(new GitHubApi());
  const { getToken } = useAuth();

  /**
   * Ensure the API has the current token before making requests
   */
  const ensureToken = useCallback(async () => {
    const token = await getToken();
    apiRef.current.setToken(token || undefined);
  }, [getToken]);

  /**
   * Load an Epic from GitHub
   */
  const loadEpic = useCallback(
    async (repoInfo: RepoInfo) => {
      setLoadingState("loading");
      setError(null);
      setWarning(null);

      try {
        // Ensure we have the latest token
        await ensureToken();

        const result = await fetchEpicHierarchy(
          apiRef.current,
          repoInfo.owner,
          repoInfo.repo,
          repoInfo.issueNumber,
        );

        setEpic(result.epic);
        if (result.warning) {
          setWarning(result.warning);
        }
        setLoadingState("success");
      } catch (err) {
        const apiError: ApiError =
          err instanceof Error
            ? { message: err.message }
            : { message: "An unexpected error occurred" };

        setError(apiError);
        setLoadingState("error");
      }
    },
    [ensureToken],
  );

  /**
   * Clear the current epic
   */
  const clearEpic = useCallback(() => {
    setEpic(null);
    setLoadingState("idle");
    setError(null);
    setWarning(null);
  }, []);

  /**
   * Clear any errors
   */
  const clearError = useCallback(() => {
    setError(null);
    if (loadingState === "error") {
      setLoadingState("idle");
    }
  }, [loadingState]);

  /**
   * Clear the warning
   */
  const clearWarning = useCallback(() => {
    setWarning(null);
  }, []);

  /**
   * Load mock data for testing
   */
  const loadMockEpic = useCallback(() => {
    setLoadingState("loading");
    setError(null);
    setWarning(null);
    // Small delay to simulate loading
    setTimeout(() => {
      setEpic(getMockEpic());
      setLoadingState("success");
    }, 500);
  }, []);

  return {
    loadingState,
    error,
    warning,
    epic,
    loadEpic,
    loadMockEpic,
    clearEpic,
    clearError,
    clearWarning,
  };
}
