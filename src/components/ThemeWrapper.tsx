/**
 * ThemeWrapper Component
 *
 * Wraps children with Primer's ThemeProvider, using the color mode from context.
 * This is needed because ThemeProvider needs the colorMode prop, which must
 * come from a client-side context.
 */

"use client";

import { ThemeProvider, BaseStyles } from "@primer/react";
import { useThemeContext } from "@/contexts/ThemeContext";
import { ReactNode } from "react";

export function ThemeWrapper({ children }: { children: ReactNode }) {
  const { colorMode } = useThemeContext();

  return (
    <ThemeProvider colorMode={colorMode}>
      <BaseStyles>{children}</BaseStyles>
    </ThemeProvider>
  );
}
