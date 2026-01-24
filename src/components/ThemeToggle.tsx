/**
 * ThemeToggle Component
 *
 * A button to toggle between light and dark color modes.
 * Uses Primer's IconButton for consistent styling.
 */

"use client";

import { IconButton } from "@primer/react";
import { SunIcon, MoonIcon } from "@primer/octicons-react";
import { useThemeContext } from "@/contexts/ThemeContext";

export function ThemeToggle() {
  const { colorMode, toggleColorMode } = useThemeContext();

  return (
    <IconButton
      aria-label={`Switch to ${colorMode === "light" ? "dark" : "light"} mode`}
      icon={colorMode === "light" ? MoonIcon : SunIcon}
      variant="invisible"
      size="small"
      onClick={toggleColorMode}
    />
  );
}
