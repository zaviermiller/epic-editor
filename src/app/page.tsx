/**
 * GitHub Epic Visualizer - Home Page
 *
 * Landing page for the Epic Visualizer.
 * Shows favorites and allows users to enter an epic URL to visualize.
 */

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { EpicInput } from "@/components/EpicInput";
import { AuthStatus } from "@/components/AuthStatus";
import { FavoritesList } from "@/components/FavoritesList";
import { RepoBrowser } from "@/components/RepoBrowser";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  GitBranchIcon,
  MarkGithubIcon,
  StackIcon,
  BeakerIcon,
  FileDirectoryIcon,
} from "@primer/octicons-react";
import { RepoInfo } from "@/types";

/**
 * Welcome/empty state component
 */
function WelcomeState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="flex items-center justify-center w-20 h-20 rounded-full bg-primary/10 mb-6">
        <StackIcon size={40} className="text-primary" />
      </div>
      <h2 className="text-2xl font-bold mb-3">
        Welcome to GitHub Epic Visualizer
      </h2>
      <p className="text-muted-foreground max-w-md mb-6">
        Enter a GitHub Epic issue URL above to visualize its batches, tasks, and
        dependencies in an interactive diagram.
      </p>
      <div className="flex flex-col gap-2 text-sm text-muted-foreground">
        <p className="flex items-center gap-2">
          <GitBranchIcon size={16} />
          View hierarchical issue structures
        </p>
        <p className="flex items-center gap-2">
          <StackIcon size={16} />
          See dependency relationships
        </p>
      </div>
    </div>
  );
}

export default function Home() {
  const router = useRouter();
  const [repoBrowserOpen, setRepoBrowserOpen] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);

  const { isAuthenticated, user, signIn, signInWithPAT, signOut } = useAuth();

  /**
   * Navigate to visualization page
   */
  const handleVisualize = (repoInfo: RepoInfo) => {
    setIsNavigating(true);
    const url = `/vis/${encodeURIComponent(repoInfo.owner)}/${encodeURIComponent(repoInfo.repo)}/${repoInfo.issueNumber}`;
    router.push(url);
  };

  /**
   * Load mock data - navigate to mock vis route
   */
  const handleLoadMock = () => {
    setIsNavigating(true);
    router.push("/vis/mock/demo/1");
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Header */}
      <header className="border-b border-border bg-card shrink-0">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            {/* Logo and title */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <MarkGithubIcon size={24} className="text-primary" />
                <h1 className="text-xl font-bold">Epic Visualizer</h1>
              </div>
            </div>

            {/* Auth status in header */}
            <div className="flex items-center gap-3">
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
                  <MarkGithubIcon size={16} className="mr-2" />
                  Sign in with GitHub
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-auto min-h-0 container mx-auto px-4 py-6">
        {/* Auth status banner */}
        <div className="mb-4">
          <AuthStatus
            isAuthenticated={isAuthenticated}
            user={user}
            onSignIn={signIn}
            onSignInWithPAT={signInWithPAT}
            onSignOut={signOut}
          />
        </div>

        {/* Favorites section */}
        <FavoritesList />

        {/* Epic URL Input */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Visualize an Epic</CardTitle>
            <CardDescription>
              Enter the URL of a GitHub Epic issue to see its structure
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <EpicInput onSubmit={handleVisualize} disabled={isNavigating} />
            <div className="flex items-center gap-4">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted-foreground">or</span>
              <div className="flex-1 h-px bg-border" />
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setRepoBrowserOpen(true)}
                disabled={isNavigating || !isAuthenticated}
              >
                <FileDirectoryIcon size={16} className="mr-2" />
                Browse Repositories
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={handleLoadMock}
                disabled={isNavigating}
              >
                <BeakerIcon size={16} className="mr-2" />
                Load Mock Data
              </Button>
            </div>
            {!isAuthenticated && (
              <p className="text-xs text-muted-foreground text-center">
                Sign in with GitHub to browse your repositories
              </p>
            )}
          </CardContent>
        </Card>

        {/* Welcome state */}
        <WelcomeState />
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-card shrink-0">
        <div className="container mx-auto px-4 py-3">
          <p className="text-xs text-muted-foreground text-center">
            GitHub Epic Visualizer • View issue hierarchies and dependencies
          </p>
        </div>
      </footer>

      {/* Repository Browser Dialog */}
      <RepoBrowser
        open={repoBrowserOpen}
        onOpenChange={setRepoBrowserOpen}
        onSelectEpic={handleVisualize}
      />
    </div>
  );
}
