/**
 * EpicInput Component
 *
 * Input field for users to enter a GitHub Epic issue URL.
 * Validates the URL format and provides feedback.
 */

"use client";

import { useState, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { isValidGitHubUrl, parseGitHubUrl } from "@/lib/github";
import { Link, Loader2, AlertCircle } from "lucide-react";
import { RepoInfo } from "@/types";

interface EpicInputProps {
  /** Callback when a valid URL is submitted */
  onSubmit: (repoInfo: RepoInfo) => void;
  /** Whether the input is disabled (e.g., during loading) */
  disabled?: boolean;
  /** Initial URL value */
  initialValue?: string;
}

export function EpicInput({
  onSubmit,
  disabled = false,
  initialValue = "",
}: EpicInputProps) {
  const [url, setUrl] = useState(initialValue);
  const [error, setError] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);

  /**
   * Handle form submission
   */
  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);

      if (!url.trim()) {
        setError("Please enter a GitHub issue URL");
        return;
      }

      const repoInfo = parseGitHubUrl(url);

      if (!repoInfo) {
        setError(
          "Invalid GitHub issue URL. Expected format: https://github.com/owner/repo/issues/123",
        );
        return;
      }

      setIsValidating(true);

      // Small delay for UX feedback
      setTimeout(() => {
        setIsValidating(false);
        onSubmit(repoInfo);
      }, 100);
    },
    [url, onSubmit],
  );

  /**
   * Handle input change with validation
   */
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setUrl(value);

      // Clear error when user starts typing
      if (error) {
        setError(null);
      }
    },
    [error],
  );

  const isLoading = disabled || isValidating;
  const showValidIndicator = url.trim() && isValidGitHubUrl(url);

  return (
    <form onSubmit={handleSubmit} className="w-full space-y-2">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            <Link className="h-4 w-4" />
          </div>
          <Input
            type="text"
            placeholder="Enter GitHub Epic issue URL (e.g., https://github.com/owner/repo/issues/123)"
            value={url}
            onChange={handleChange}
            disabled={isLoading}
            className={`pl-10 ${error ? "border-destructive" : ""} ${showValidIndicator ? "border-green-500" : ""}`}
          />
        </div>
        <Button
          type="submit"
          disabled={isLoading || !url.trim()}
          className="min-w-[100px]"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Loading
            </>
          ) : (
            "Visualize"
          )}
        </Button>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Enter the URL of a GitHub Epic issue to visualize its batches and tasks
      </p>
    </form>
  );
}
