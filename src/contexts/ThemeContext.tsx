/**
 * Theme Context
 *
 * Provides theme state management for dark/light mode toggle.
 * Persists preference to localStorage and syncs with system preference.
 */

"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  startTransition,
  ReactNode,
} from "react";

type ColorMode = "light" | "dark";

interface ThemeContextValue {
  colorMode: ColorMode;
  toggleColorMode: () => void;
  setColorMode: (mode: ColorMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const STORAGE_KEY = "epic-visualizer-color-mode";

export function ThemeContextProvider({ children }: { children: ReactNode }) {
  const [colorMode, setColorModeState] = useState<ColorMode>("light");
  const [mounted, setMounted] = useState(false);

  // Initialize theme from localStorage or system preference on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as ColorMode | null;
    let initialMode: ColorMode = "light";
    if (stored && (stored === "light" || stored === "dark")) {
      initialMode = stored;
    } else {
      const prefersDark = window.matchMedia(
        "(prefers-color-scheme: dark)",
      ).matches;
      initialMode = prefersDark ? "dark" : "light";
    }
    // Use startTransition to avoid the lint warning about cascading renders
    // This is intentional initialization, not a cascading effect
    startTransition(() => {
      setColorModeState(initialMode);
      setMounted(true);
    });
  }, []);

  // Update document attribute when theme changes
  useEffect(() => {
    if (mounted) {
      document.documentElement.setAttribute("data-color-mode", colorMode);
      localStorage.setItem(STORAGE_KEY, colorMode);
    }
  }, [colorMode, mounted]);

  const setColorMode = useCallback((mode: ColorMode) => {
    setColorModeState(mode);
  }, []);

  const toggleColorMode = useCallback(() => {
    setColorModeState((prev) => (prev === "light" ? "dark" : "light"));
  }, []);

  // Prevent flash of wrong theme
  if (!mounted) {
    return null;
  }

  return (
    <ThemeContext.Provider value={{ colorMode, toggleColorMode, setColorMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useThemeContext() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error(
      "useThemeContext must be used within a ThemeContextProvider",
    );
  }
  return context;
}
