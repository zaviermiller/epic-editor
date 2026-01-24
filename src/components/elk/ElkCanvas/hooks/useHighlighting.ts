/**
 * useHighlighting Hook
 *
 * Manages task highlighting state and computes related edges/tasks.
 */

import { useState, useMemo } from "react";
import { ElkLayoutResult } from "@/lib/elk";

interface UseHighlightingOptions {
  layout: ElkLayoutResult | null;
}

interface UseHighlightingReturn {
  highlightedTask: number | null;
  setHighlightedTask: React.Dispatch<React.SetStateAction<number | null>>;
  highlightedEdges: Set<string>;
  relatedTasks: Set<number>;
}

export function useHighlighting({
  layout,
}: UseHighlightingOptions): UseHighlightingReturn {
  const [highlightedTask, setHighlightedTask] = useState<number | null>(null);

  const { highlightedEdges, relatedTasks } = useMemo(() => {
    if (!layout || highlightedTask === null) {
      return {
        highlightedEdges: new Set<string>(),
        relatedTasks: new Set<number>(),
      };
    }

    const edges = new Set<string>();
    const tasks = new Set<number>();
    tasks.add(highlightedTask);

    for (const edge of layout.edges) {
      if (edge.from === highlightedTask || edge.to === highlightedTask) {
        edges.add(edge.id);
        tasks.add(edge.from);
        tasks.add(edge.to);
      }
    }

    return { highlightedEdges: edges, relatedTasks: tasks };
  }, [layout, highlightedTask]);

  return {
    highlightedTask,
    setHighlightedTask,
    highlightedEdges,
    relatedTasks,
  };
}
