/**
 * AuthStatus Component
 *
 * Displays the GitHub authentication status.
 * Shows user avatar and access level for authenticated users,
 * or sign-in options (OAuth or PAT) for unauthenticated users.
 */

"use client";

import { useState } from "react";
import { Button, Avatar, TextInput, Text, Heading } from "@primer/react";
import {
  AlertIcon,
  LockIcon,
  UnlockIcon,
  SignOutIcon,
  KeyIcon,
  MarkGithubIcon,
  SyncIcon,
  XIcon,
  LinkExternalIcon,
} from "@primer/octicons-react";

interface AuthUser {
  id: number;
  login: string;
  avatar_url: string;
  name?: string | null;
}

interface AuthStatusProps {
  /** Whether the user is authenticated */
  isAuthenticated: boolean;
  /** Authenticated user info */
  user: AuthUser | null;
  /** Callback to sign in via OAuth */
  onSignIn?: () => void;
  /** Callback to sign in with PAT */
  onSignInWithPAT?: (
    token: string,
  ) => Promise<{ success: boolean; error?: string }>;
  /** Callback to sign out */
  onSignOut?: () => void;
}

export function AuthStatus({
  isAuthenticated,
  user,
  onSignIn,
  onSignInWithPAT,
  onSignOut,
}: AuthStatusProps) {
  const [showPATInput, setShowPATInput] = useState(false);
  const [patValue, setPATValue] = useState("");
  const [patError, setPATError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handlePATSubmit = async () => {
    if (!patValue.trim() || !onSignInWithPAT) return;

    setIsSubmitting(true);
    setPATError(null);

    const result = await onSignInWithPAT(patValue.trim());

    setIsSubmitting(false);

    if (result.success) {
      setPATValue("");
      setShowPATInput(false);
    } else {
      setPATError(result.error || "Authentication failed");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handlePATSubmit();
    } else if (e.key === "Escape") {
      setShowPATInput(false);
      setPATValue("");
      setPATError(null);
    }
  };

  if (isAuthenticated && user) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-[var(--borderColor-default)] bg-[var(--bgColor-muted)] p-3">
        <Avatar src={user.avatar_url} alt={user.login} size={32} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Text className="font-medium truncate">{user.login}</Text>
            <LockIcon size={12} className="text-green-500" />
          </div>
          <Text className="text-xs text-[var(--fgColor-muted)]">
            Private repos accessible
          </Text>
        </div>
        {onSignOut && (
          <Button variant="invisible" size="small" onClick={onSignOut}>
            <SignOutIcon size={16} />
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-3">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-yellow-500/20">
          <AlertIcon size={16} className="text-yellow-500" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Text className="font-medium">Not authenticated</Text>
            <UnlockIcon size={12} className="text-yellow-500" />
          </div>
          <Text className="text-xs text-[var(--fgColor-muted)]">
            Only public repositories accessible
          </Text>
        </div>
      </div>

      {showPATInput ? (
        <div className="mt-3 space-y-2">
          <div className="flex gap-2">
            <TextInput
              type="password"
              placeholder="ghp_xxxxxxxxxxxx"
              value={patValue}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                setPATValue(e.target.value);
                setPATError(null);
              }}
              onKeyDown={handleKeyDown}
              disabled={isSubmitting}
              className="flex-1 text-sm"
              autoFocus
            />
            <Button
              size="small"
              onClick={handlePATSubmit}
              disabled={!patValue.trim() || isSubmitting}
            >
              {isSubmitting ? (
                <SyncIcon size={16} className="animate-spin" />
              ) : (
                "Submit"
              )}
            </Button>
            <Button
              size="small"
              variant="invisible"
              onClick={() => {
                setShowPATInput(false);
                setPATValue("");
                setPATError(null);
              }}
              disabled={isSubmitting}
            >
              <XIcon size={16} />
            </Button>
          </div>
          {patError && <Text className="text-xs text-red-500">{patError}</Text>}
          <Text className="text-xs text-[var(--fgColor-muted)]">
            <a
              href="https://github.com/settings/tokens?type=beta"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-blue-500 hover:underline"
            >
              Create a token
              <LinkExternalIcon size={12} />
            </a>{" "}
            with{" "}
            <code className="text-xs bg-[var(--bgColor-muted)] px-1 rounded">
              repo
            </code>{" "}
            scope
          </Text>
        </div>
      ) : (
        <div className="mt-3 flex gap-2">
          {onSignIn && (
            <Button
              variant="default"
              size="small"
              onClick={onSignIn}
              className="flex-1"
              leadingVisual={MarkGithubIcon}
            >
              Sign in with GitHub
            </Button>
          )}
          {onSignInWithPAT && (
            <Button
              variant="default"
              size="small"
              onClick={() => setShowPATInput(true)}
              className="flex-1"
              leadingVisual={KeyIcon}
            >
              Use Token (PAT)
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
