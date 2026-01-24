/**
 * useHighlighting Hook
 *
 * Manages task and batch highlighting state and computes related edges/tasks/batches.
 */

import { useState, useMemo } from "react";
import { ElkLayoutResult } from "@/lib/elk";

interface UseHighlightingOptions {
  layout: ElkLayoutResult | null;
}

interface UseHighlightingReturn {
  // Task highlighting
  highlightedTask: number | null;
  setHighlightedTask: React.Dispatch<React.SetStateAction<number | null>>;
  highlightedEdges: Set<string>;
  relatedTasks: Set<number>;
  // Batch highlighting
  highlightedBatch: number | null;
  setHighlightedBatch: React.Dispatch<React.SetStateAction<number | null>>;
  highlightedBatchEdges: Set<string>;
  relatedBatches: Set<number>;
}

export function useHighlighting({
  layout,
}: UseHighlightingOptions): UseHighlightingReturn {
  const [highlightedTask, setHighlightedTask] = useState<number | null>(null);
  const [highlightedBatch, setHighlightedBatch] = useState<number | null>(null);

  // Task highlighting logic
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

  // Batch highlighting logic
  const { highlightedBatchEdges, relatedBatches } = useMemo(() => {
    if (!layout || highlightedBatch === null) {
      return {
        highlightedBatchEdges: new Set<string>(),
        relatedBatches: new Set<number>(),
      };
    }

    const edges = new Set<string>();
    const batches = new Set<number>();
    batches.add(highlightedBatch);

    // Find all inter-batch task edges that involve the hovered batch
    // and collect the connected batches
    for (const edge of layout.edges) {
      if (edge.isBatchEdge) {
        // Batch-to-batch edges: highlight if either end is the hovered batch
        if (edge.from === highlightedBatch || edge.to === highlightedBatch) {
          edges.add(edge.id);
          batches.add(edge.from);
          batches.add(edge.to);
        }
      } else if (edge.isInterBatch) {
        // Inter-batch task edges: highlight if either batch endpoint matches
        if (
          edge.fromBatch === highlightedBatch ||
          edge.toBatch === highlightedBatch
        ) {
          edges.add(edge.id);
          batches.add(edge.fromBatch);
          batches.add(edge.toBatch);
        }
      }
    }

    return { highlightedBatchEdges: edges, relatedBatches: batches };
  }, [layout, highlightedBatch]);

  return {
    highlightedTask,
    setHighlightedTask,
    highlightedEdges,
    relatedTasks,
    highlightedBatch,
    setHighlightedBatch,
    highlightedBatchEdges,
    relatedBatches,
  };
}
