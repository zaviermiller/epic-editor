/**
 * useModifiedEpic Hook
 *
 * Creates a modified copy of the epic that includes pending edge changes
 * and move operations for layout calculation.
 */

import { useMemo } from "react";
import { Epic } from "@/types";
import { EdgeChange, PendingMove } from "../types";

interface UseModifiedEpicOptions {
  epic: Epic;
  pendingEdges: EdgeChange[];
  removedEdges: Set<string>;
  pendingBatchEdges: EdgeChange[];
  removedBatchEdges: Set<string>;
  pendingMoves: PendingMove[];
}

export function useModifiedEpic({
  epic,
  pendingEdges,
  removedEdges,
  pendingBatchEdges,
  removedBatchEdges,
  pendingMoves,
}: UseModifiedEpicOptions): Epic {
  return useMemo(() => {
    // Deep clone the epic to avoid mutating the original
    const clonedEpic: Epic = JSON.parse(JSON.stringify(epic));

    // Add pending edges as dependencies
    for (const pending of pendingEdges) {
      for (const batch of clonedEpic.batches) {
        const task = batch.tasks.find((t) => t.number === pending.to);
        if (task && !task.dependsOn.includes(pending.from)) {
          task.dependsOn.push(pending.from);
        }
      }
      if (
        !clonedEpic.dependencies.some(
          (d) => d.from === pending.to && d.to === pending.from,
        )
      ) {
        clonedEpic.dependencies.push({
          from: pending.to,
          to: pending.from,
          type: "depends-on",
        });
      }
    }

    // Remove edges that are marked as removed
    for (const edgeId of removedEdges) {
      const match = edgeId.match(/^edge-(\d+)-(\d+)$/);
      if (match) {
        const dependency = parseInt(match[1], 10);
        const dependent = parseInt(match[2], 10);

        for (const batch of clonedEpic.batches) {
          const task = batch.tasks.find((t) => t.number === dependent);
          if (task) {
            task.dependsOn = task.dependsOn.filter((d) => d !== dependency);
          }
        }

        clonedEpic.dependencies = clonedEpic.dependencies.filter(
          (d) => !(d.from === dependent && d.to === dependency),
        );
      }
    }

    // Add pending batch edges as dependencies
    for (const pending of pendingBatchEdges) {
      const batch = clonedEpic.batches.find((b) => b.number === pending.to);
      if (batch && !batch.dependsOn.includes(pending.from)) {
        batch.dependsOn.push(pending.from);
      }
    }

    // Remove batch edges that are marked as removed
    for (const edgeId of removedBatchEdges) {
      const match = edgeId.match(/^batch-edge-(\d+)-(\d+)$/);
      if (match) {
        const dependency = parseInt(match[1], 10);
        const dependent = parseInt(match[2], 10);

        const batch = clonedEpic.batches.find((b) => b.number === dependent);
        if (batch) {
          batch.dependsOn = batch.dependsOn.filter((d) => d !== dependency);
        }
      }
    }

    // Apply pending moves - move tasks between batches
    for (const move of pendingMoves) {
      const sourceBatch = clonedEpic.batches.find(
        (b) => b.number === move.fromBatchNumber,
      );
      const targetBatch = clonedEpic.batches.find(
        (b) => b.number === move.toBatchNumber,
      );

      if (sourceBatch && targetBatch) {
        const taskIndex = sourceBatch.tasks.findIndex(
          (t) => t.number === move.taskNumber,
        );
        if (taskIndex !== -1) {
          const [task] = sourceBatch.tasks.splice(taskIndex, 1);
          targetBatch.tasks.push(task);
        }
      }
    }

    return clonedEpic;
  }, [
    epic,
    pendingEdges,
    removedEdges,
    pendingBatchEdges,
    removedBatchEdges,
    pendingMoves,
  ]);
}
