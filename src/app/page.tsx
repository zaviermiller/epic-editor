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
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAuth } from "@/lib/auth";
import { Button, Heading, Text } from "@primer/react";
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
      <div className="flex items-center justify-center w-20 h-20 rounded-full bg-[var(--bgColor-accent-muted)] mb-6">
        <StackIcon size={40} />
      </div>
      <Heading as="h2" className="text-2xl mb-3">
        Welcome to GitHub Epic Visualizer
      </Heading>
      <Text as="p" className="text-[var(--fgColor-muted)] max-w-md mb-6">
        Enter a GitHub Epic issue URL above to visualize its batches, tasks, and
        dependencies in an interactive diagram.
      </Text>
      <div className="flex flex-col gap-2 text-sm text-[var(--fgColor-muted)]">
        <Text as="p" className="flex items-center gap-2">
          <GitBranchIcon size={16} />
          View hierarchical issue structures
        </Text>
        <Text as="p" className="flex items-center gap-2">
          <StackIcon size={16} />
          See dependency relationships
        </Text>
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
    <div className="h-screen flex flex-col overflow-hidden bg-[var(--bgColor-default)]">
      {/* Header */}
      <header className="border-b border-[var(--borderColor-default)] bg-[var(--bgColor-muted)] shrink-0">
        <div className="max-w-[1200px] mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            {/* Logo and title */}
            <div className="flex items-center gap-2">
              <MarkGithubIcon size={24} />
              <Heading as="h1" className="text-xl">
                Epic Visualizer
              </Heading>
            </div>

            {/* Theme toggle and auth status in header */}
            <div className="flex items-center gap-2">
              <ThemeToggle />
              {isAuthenticated && user ? (
                <div className="flex items-center gap-2">
                  <Text className="text-sm text-[var(--fgColor-muted)]">
                    {user.login}
                  </Text>
                  <Button variant="invisible" size="small" onClick={signOut}>
                    Sign out
                  </Button>
                </div>
              ) : (
                <Button
                  variant="invisible"
                  size="small"
                  onClick={signIn}
                  leadingVisual={MarkGithubIcon}
                >
                  Sign in with GitHub
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-auto min-h-0 max-w-[1200px] mx-auto px-4 py-4 w-full">
        {/* Auth status banner */}
        <div className="mb-3">
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
        <div className="border border-[var(--borderColor-default)] rounded-lg bg-[var(--bgColor-muted)] mb-4">
          <div className="p-4 border-b border-[var(--borderColor-default)]">
            <Heading as="h2" className="text-lg mb-1">
              Visualize an Epic
            </Heading>
            <Text as="p" className="text-sm text-[var(--fgColor-muted)]">
              Enter the URL of a GitHub Epic issue to see its structure
            </Text>
          </div>
          <div className="p-4">
            <div className="mb-3">
              <EpicInput onSubmit={handleVisualize} disabled={isNavigating} />
            </div>
            <div className="flex items-center gap-4 mb-3">
              <div className="flex-1 h-px bg-[var(--borderColor-default)]" />
              <Text className="text-xs text-[var(--fgColor-muted)]">or</Text>
              <div className="flex-1 h-px bg-[var(--borderColor-default)]" />
            </div>
            <div className="flex gap-2">
              <Button
                variant="invisible"
                className="flex-1"
                onClick={() => setRepoBrowserOpen(true)}
                disabled={isNavigating || !isAuthenticated}
                leadingVisual={FileDirectoryIcon}
              >
                Browse Repositories
              </Button>
              <Button
                variant="invisible"
                className="flex-1"
                onClick={handleLoadMock}
                disabled={isNavigating}
                leadingVisual={BeakerIcon}
              >
                Load Mock Data
              </Button>
            </div>
            {!isAuthenticated && (
              <Text
                as="p"
                className="text-xs text-[var(--fgColor-muted)] text-center mt-2"
              >
                Sign in with GitHub to browse your repositories
              </Text>
            )}
          </div>
        </div>

        {/* Welcome state */}
        <WelcomeState />
      </main>

      {/* Footer */}
      <footer className="border-t border-[var(--borderColor-default)] bg-[var(--bgColor-muted)] shrink-0">
        <div className="max-w-[1200px] mx-auto px-4 py-2">
          <Text
            as="p"
            className="text-xs text-[var(--fgColor-muted)] text-center"
          >
            GitHub Epic Visualizer • View issue hierarchies and dependencies
          </Text>
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
