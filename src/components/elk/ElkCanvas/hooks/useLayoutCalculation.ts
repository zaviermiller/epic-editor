/**
 * useLayoutCalculation Hook
 *
 * Handles ELK layout calculation and edge routing.
 */

import { useState, useEffect, useRef } from "react";
import { Epic } from "@/types";
import {
  calculateElkLayout,
  routeEdges,
  ElkLayoutResult,
  ElkLayoutConfig,
} from "@/lib/elk";

interface UseLayoutCalculationOptions {
  epic: Epic;
  config: ElkLayoutConfig;
}

interface UseLayoutCalculationReturn {
  layout: ElkLayoutResult | null;
  isLoading: boolean;
  error: string | null;
}

export function useLayoutCalculation({
  epic,
  config,
}: UseLayoutCalculationOptions): UseLayoutCalculationReturn {
  const [layout, setLayout] = useState<ElkLayoutResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasInitialLayout = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function runLayout() {
      // Don't show loading spinner for edit mode recalculations after initial load
      if (!hasInitialLayout.current) {
        setIsLoading(true);
      }
      setError(null);

      try {
        const result = await calculateElkLayout(epic, config);

        if (!cancelled) {
          // Route edges after layout
          const routedEdges = routeEdges(
            result.edges,
            result.tasks,
            result.batches,
            config,
          );

          setLayout({
            ...result,
            edges: routedEdges,
          });
          setIsLoading(false);
          hasInitialLayout.current = true;
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Layout failed");
          setIsLoading(false);
        }
      }
    }

    runLayout();

    return () => {
      cancelled = true;
    };
  }, [epic, config]);

  return {
    layout,
    isLoading,
    error,
  };
}
