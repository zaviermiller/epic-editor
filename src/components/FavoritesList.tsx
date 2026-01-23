/**
 * FavoritesList Component
 *
 * Displays a list of favorited epics with links to their visualization pages.
 */

"use client";

import { useSyncExternalStore, useCallback } from "react";
import Link from "next/link";
import { getFavorites, removeFavorite, FavoriteEpic } from "@/lib/favorites";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Star, ExternalLink, Trash2, Clock } from "lucide-react";

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
    <Card className="group hover:border-primary/50 transition-colors">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="shrink-0 mt-1">
            <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
          </div>
          <div className="flex-1 min-w-0">
            <Link
              href={visUrl}
              className="text-sm font-medium hover:text-primary hover:underline block truncate"
            >
              {favorite.title}
            </Link>
            <p className="text-xs text-muted-foreground mt-1">
              {favorite.owner}/{favorite.repo}#{favorite.issueNumber}
            </p>
            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Updated {formatRelativeTime(favorite.lastRefreshedAt)}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => window.open(favorite.epic.url, "_blank")}
              title="Open in GitHub"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-destructive hover:text-destructive"
              onClick={() => onRemove(favorite.key)}
              title="Remove from favorites"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
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
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Star className="h-5 w-5 text-yellow-500" />
          Favorite Epics
        </CardTitle>
        <CardDescription>
          Quick access to your saved epic visualizations
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {favorites.map((favorite) => (
            <FavoriteCard
              key={favorite.key}
              favorite={favorite}
              onRemove={handleRemove}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
