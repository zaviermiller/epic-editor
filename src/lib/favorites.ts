/**
 * Favorites Management
 *
 * Utilities for saving and loading favorite epics to/from localStorage.
 * Favorites store the full Epic data for offline access and fast loading.
 */

import { Epic } from "@/types";

/**
 * A saved favorite epic with metadata
 */
export interface FavoriteEpic {
  /** Unique key for the favorite (owner/repo#issue) */
  key: string;
  /** Repository owner */
  owner: string;
  /** Repository name */
  repo: string;
  /** Issue number */
  issueNumber: number;
  /** Epic title for display */
  title: string;
  /** Full Epic data for rendering */
  epic: Epic;
  /** When this was favorited */
  favoritedAt: string;
  /** When the data was last refreshed */
  lastRefreshedAt: string;
}

const FAVORITES_STORAGE_KEY = "github-epic-visualizer-favorites";

/**
 * Generate a unique key for a favorite
 */
export function getFavoriteKey(
  owner: string,
  repo: string,
  issueNumber: number,
): string {
  return `${owner}/${repo}#${issueNumber}`;
}

/**
 * Get all favorites from localStorage
 */
export function getFavorites(): FavoriteEpic[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const stored = localStorage.getItem(FAVORITES_STORAGE_KEY);
    if (!stored) {
      return [];
    }
    return JSON.parse(stored) as FavoriteEpic[];
  } catch (error) {
    console.error("Failed to load favorites from localStorage:", error);
    return [];
  }
}

/**
 * Get a specific favorite by key
 */
export function getFavorite(key: string): FavoriteEpic | null {
  const favorites = getFavorites();
  return favorites.find((f) => f.key === key) || null;
}

/**
 * Get a favorite by owner/repo/issue
 */
export function getFavoriteByRepoInfo(
  owner: string,
  repo: string,
  issueNumber: number,
): FavoriteEpic | null {
  const key = getFavoriteKey(owner, repo, issueNumber);
  return getFavorite(key);
}

/**
 * Save a new favorite or update an existing one
 */
export function saveFavorite(epic: Epic): FavoriteEpic {
  const favorites = getFavorites();
  const key = getFavoriteKey(epic.owner, epic.repo, epic.number);
  const now = new Date().toISOString();

  const existingIndex = favorites.findIndex((f) => f.key === key);
  const favorite: FavoriteEpic = {
    key,
    owner: epic.owner,
    repo: epic.repo,
    issueNumber: epic.number,
    title: epic.title,
    epic,
    favoritedAt:
      existingIndex >= 0 ? favorites[existingIndex].favoritedAt : now,
    lastRefreshedAt: now,
  };

  if (existingIndex >= 0) {
    favorites[existingIndex] = favorite;
  } else {
    favorites.unshift(favorite); // Add to beginning for recency
  }

  try {
    localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favorites));
  } catch (error) {
    console.error("Failed to save favorite to localStorage:", error);
  }

  return favorite;
}

/**
 * Update just the epic data for an existing favorite (for background refresh)
 */
export function updateFavoriteEpic(epic: Epic): void {
  const favorites = getFavorites();
  const key = getFavoriteKey(epic.owner, epic.repo, epic.number);
  const index = favorites.findIndex((f) => f.key === key);

  if (index >= 0) {
    favorites[index].epic = epic;
    favorites[index].lastRefreshedAt = new Date().toISOString();

    try {
      localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favorites));
    } catch (error) {
      console.error("Failed to update favorite in localStorage:", error);
    }
  }
}

/**
 * Remove a favorite
 */
export function removeFavorite(key: string): void {
  const favorites = getFavorites();
  const filtered = favorites.filter((f) => f.key !== key);

  try {
    localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.error("Failed to remove favorite from localStorage:", error);
  }
}

/**
 * Remove a favorite by owner/repo/issue
 */
export function removeFavoriteByRepoInfo(
  owner: string,
  repo: string,
  issueNumber: number,
): void {
  const key = getFavoriteKey(owner, repo, issueNumber);
  removeFavorite(key);
}

/**
 * Check if an epic is favorited
 */
export function isFavorite(
  owner: string,
  repo: string,
  issueNumber: number,
): boolean {
  const key = getFavoriteKey(owner, repo, issueNumber);
  const favorites = getFavorites();
  return favorites.some((f) => f.key === key);
}

/**
 * Toggle favorite status for an epic
 * Returns true if now favorited, false if unfavorited
 */
export function toggleFavorite(epic: Epic): boolean {
  const key = getFavoriteKey(epic.owner, epic.repo, epic.number);
  const existing = getFavorite(key);

  if (existing) {
    removeFavorite(key);
    return false;
  } else {
    saveFavorite(epic);
    return true;
  }
}
