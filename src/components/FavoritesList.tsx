/**
 * FavoritesList Component
 *
 * Displays a list of favorited epics with links to their visualization pages.
 */

"use client";

import { useSyncExternalStore, useCallback } from "react";
import Link from "next/link";
import { getFavorites, removeFavorite, FavoriteEpic } from "@/lib/favorites";
import { Button, Text, Heading } from "@primer/react";
import {
  StarFillIcon,
  LinkExternalIcon,
  TrashIcon,
  ClockIcon,
} from "@primer/octicons-react";

/**
 * Format a relative time string
 */
function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString();
}

interface FavoriteCardProps {
  favorite: FavoriteEpic;
  onRemove: (key: string) => void;
}

function FavoriteCard({ favorite, onRemove }: FavoriteCardProps) {
  const visUrl = `/vis/${encodeURIComponent(favorite.owner)}/${encodeURIComponent(favorite.repo)}/${favorite.issueNumber}`;

  return (
    <div className="group border border-[var(--borderColor-default)] rounded-lg hover:border-[var(--borderColor-accent-emphasis)] transition-colors">
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className="shrink-0 mt-1">
            <StarFillIcon size={16} className="text-yellow-500" />
          </div>
          <div className="flex-1 min-w-0">
            <Link
              href={visUrl}
              className="text-sm font-medium hover:text-[var(--fgColor-accent)] hover:underline block truncate"
            >
              {favorite.title}
            </Link>
            <Text className="text-xs text-[var(--fgColor-muted)] mt-1 block">
              {favorite.owner}/{favorite.repo}#{favorite.issueNumber}
            </Text>
            <div className="flex items-center gap-3 mt-2 text-xs text-[var(--fgColor-muted)]">
              <span className="flex items-center gap-1">
                <ClockIcon size={12} />
                Updated {formatRelativeTime(favorite.lastRefreshedAt)}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              variant="invisible"
              size="small"
              onClick={() => window.open(favorite.epic.url, "_blank")}
              aria-label="Open in GitHub"
            >
              <LinkExternalIcon size={14} />
            </Button>
            <Button
              variant="invisible"
              size="small"
              className="text-red-500 hover:text-red-500"
              onClick={() => onRemove(favorite.key)}
              aria-label="Remove from favorites"
            >
              <TrashIcon size={14} />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function FavoritesList() {
  // Use useSyncExternalStore to safely read from localStorage
  const subscribe = useCallback((callback: () => void) => {
    // Listen for storage events from other tabs
    window.addEventListener("storage", callback);
    // Also listen for custom events for same-tab updates
    window.addEventListener("favorites-updated", callback);
    return () => {
      window.removeEventListener("storage", callback);
      window.removeEventListener("favorites-updated", callback);
    };
  }, []);

  const getSnapshot = useCallback(() => {
    return JSON.stringify(getFavorites());
  }, []);

  const getServerSnapshot = useCallback(() => {
    return "[]";
  }, []);

  const favoritesJson = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  const favorites: FavoriteEpic[] = JSON.parse(favoritesJson);

  const handleRemove = (key: string) => {
    removeFavorite(key);
    // Dispatch custom event to trigger re-render
    window.dispatchEvent(new Event("favorites-updated"));
  };

  if (favorites.length === 0) {
    return null;
  }

  return (
    <div className="border border-[var(--borderColor-default)] rounded-lg bg-[var(--bgColor-muted)] mb-6">
      <div className="p-4 border-b border-[var(--borderColor-default)]">
        <Heading as="h2" className="flex items-center gap-2 text-lg">
          <StarFillIcon size={20} className="text-yellow-500" />
          Favorite Epics
        </Heading>
        <Text className="text-sm text-[var(--fgColor-muted)]">
          Quick access to your saved epic visualizations
        </Text>
      </div>
      <div className="p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {favorites.map((favorite) => (
            <FavoriteCard
              key={favorite.key}
              favorite={favorite}
              onRemove={handleRemove}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
