/**
 * AuthStatus Component
 *
 * Displays the GitHub authentication status.
 * Shows user avatar and access level for authenticated users,
 * or sign-in options (OAuth or PAT) for unauthenticated users.
 */

"use client";

import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertTriangle,
  Lock,
  Unlock,
  LogOut,
  Key,
  Github,
  Loader2,
  X,
  ExternalLink,
} from "lucide-react";

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
      <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
        <Avatar className="h-8 w-8">
          <AvatarImage src={user.avatar_url} alt={user.login} />
          <AvatarFallback>{user.login.charAt(0).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium truncate">{user.login}</span>
            <Lock className="h-3 w-3 text-green-500" />
          </div>
          <p className="text-xs text-muted-foreground">
            Private repos accessible
          </p>
        </div>
        {onSignOut && (
          <Button variant="ghost" size="sm" onClick={onSignOut}>
            <LogOut className="h-4 w-4" />
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-3">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-yellow-500/20">
          <AlertTriangle className="h-4 w-4 text-yellow-500" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium">Not authenticated</span>
            <Unlock className="h-3 w-3 text-yellow-500" />
          </div>
          <p className="text-xs text-muted-foreground">
            Only public repositories accessible
          </p>
        </div>
      </div>

      {showPATInput ? (
        <div className="mt-3 space-y-2">
          <div className="flex gap-2">
            <Input
              type="password"
              placeholder="ghp_xxxxxxxxxxxx"
              value={patValue}
              onChange={(e) => {
                setPATValue(e.target.value);
                setPATError(null);
              }}
              onKeyDown={handleKeyDown}
              disabled={isSubmitting}
              className="flex-1 text-sm"
              autoFocus
            />
            <Button
              size="sm"
              onClick={handlePATSubmit}
              disabled={!patValue.trim() || isSubmitting}
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Submit"
              )}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setShowPATInput(false);
                setPATValue("");
                setPATError(null);
              }}
              disabled={isSubmitting}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          {patError && <p className="text-xs text-red-500">{patError}</p>}
          <p className="text-xs text-muted-foreground">
            <a
              href="https://github.com/settings/tokens?type=beta"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-blue-500 hover:underline"
            >
              Create a token
              <ExternalLink className="h-3 w-3" />
            </a>{" "}
            with <code className="text-xs bg-muted px-1 rounded">repo</code>{" "}
            scope
          </p>
        </div>
      ) : (
        <div className="mt-3 flex gap-2">
          {onSignIn && (
            <Button
              variant="outline"
              size="sm"
              onClick={onSignIn}
              className="flex-1"
            >
              <Github className="h-4 w-4 mr-2" />
              Sign in with GitHub
            </Button>
          )}
          {onSignInWithPAT && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowPATInput(true)}
              className="flex-1"
            >
              <Key className="h-4 w-4 mr-2" />
              Use Token (PAT)
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
