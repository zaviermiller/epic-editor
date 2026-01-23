/**
 * ElkCanvas Component
 *
 * Main visualization canvas that renders the Epic diagram using ELK layout.
 * Uses SVG for rendering with custom styling and interactivity.
 */

"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { Epic, Task } from "@/types";
import {
  calculateElkLayout,
  routeEdges,
  ElkLayoutResult,
  ElkLayoutConfig,
  DEFAULT_ELK_CONFIG,
} from "@/lib/elk";
import { ElkBatchGroup } from "./ElkBatchGroup";
import { ElkTaskNode } from "./ElkTaskNode";
import { ElkEdges } from "./ElkEdges";
import { CanvasToolbar, ToolType } from "./CanvasToolbar";
import { GitHubApi } from "@/lib/github";
import { Loader2 } from "lucide-react";

/**
 * Result of a save operation for relationship changes
 */
export interface SaveResult {
  success: boolean;
  addedCount: number;
  removedCount: number;
  errors: string[];
  /** Successfully added task dependencies (from blocks to) */
  addedTaskEdges: { from: number; to: number }[];
  /** Successfully added batch dependencies (from blocks to) */
  addedBatchEdges: { from: number; to: number }[];
  /** Successfully removed task dependencies (from blocks to) */
  removedTaskEdges: { from: number; to: number }[];
  /** Successfully removed batch dependencies (from blocks to) */
  removedBatchEdges: { from: number; to: number }[];
}

interface ElkCanvasProps {
  /** Epic to visualize */
  epic: Epic;
  /** Layout configuration */
  config?: ElkLayoutConfig;
  /** Callback when a task is clicked */
  onTaskClick?: (task: Task) => void;
  /** Callback when relationship changes are saved */
  onSave?: (result: SaveResult) => void;
  /** GitHub API instance (required for saving changes) */
  api?: GitHubApi;
  /** Class name for the container */
  className?: string;
}

/**
 * Transform state for pan and zoom
 */
interface TransformState {
  x: number;
  y: number;
  scale: number;
}

export function ElkCanvas({
  epic,
  config = DEFAULT_ELK_CONFIG,
  onTaskClick,
  onSave,
  api,
  className = "",
}: ElkCanvasProps) {
  // Layout state
  const [layout, setLayout] = useState<ElkLayoutResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Interaction state
  const [highlightedTask, setHighlightedTask] = useState<number | null>(null);
  const [activeTool, setActiveTool] = useState<ToolType>("select");
  const [cursorStyle, setCursorStyle] = useState<"grab" | "grabbing">("grab");
  const [transform, setTransform] = useState<TransformState>({
    x: 0,
    y: 0,
    scale: 1,
  });

  // Edit mode state - Tasks
  const [editModeSourceTask, setEditModeSourceTask] = useState<number | null>(
    null,
  );
  const [pendingEdges, setPendingEdges] = useState<
    { from: number; to: number }[]
  >([]);
  const [removedEdges, setRemovedEdges] = useState<Set<string>>(new Set());

  // Edit mode state - Batches
  const [editModeSourceBatch, setEditModeSourceBatch] = useState<number | null>(
    null,
  );
  const [pendingBatchEdges, setPendingBatchEdges] = useState<
    { from: number; to: number }[]
  >([]);
  const [removedBatchEdges, setRemovedBatchEdges] = useState<Set<string>>(
    new Set(),
  );

  const isEditMode = activeTool === "edit-relationships";

  // Compute original task edges from the epic for comparison
  const originalEdges = useMemo(() => {
    const edges = new Set<string>();
    for (const dep of epic.dependencies) {
      // Edge ID format: "edge-{dependency}-{dependent}" where dependent depends on dependency
      // In Dependency type, "from" is the dependent, "to" is the dependency
      edges.add(`edge-${dep.to}-${dep.from}`);
    }
    return edges;
  }, [epic.dependencies]);

  // Compute original batch edges from the epic for comparison
  const originalBatchEdges = useMemo(() => {
    const edges = new Set<string>();
    for (const batch of epic.batches) {
      for (const depBatchNum of batch.dependsOn) {
        // Batch edge ID format: "batch-edge-{dependency}-{dependent}"
        edges.add(`batch-edge-${depBatchNum}-${batch.number}`);
      }
    }
    return edges;
  }, [epic.batches]);

  // Check if there are actual changes compared to original state
  const hasChanges = useMemo(() => {
    // Build current task edge set from original + pending - removed
    const currentEdges = new Set<string>();

    // Start with original edges
    for (const edge of originalEdges) {
      if (!removedEdges.has(edge)) {
        currentEdges.add(edge);
      }
    }

    // Add pending edges
    for (const pending of pendingEdges) {
      const edgeId = `edge-${pending.from}-${pending.to}`;
      currentEdges.add(edgeId);
    }

    // Check task edge changes
    if (currentEdges.size !== originalEdges.size) {
      return true;
    }

    for (const edge of originalEdges) {
      if (!currentEdges.has(edge)) {
        return true;
      }
    }

    for (const edge of currentEdges) {
      if (!originalEdges.has(edge)) {
        return true;
      }
    }

    // Build current batch edge set from original + pending - removed
    const currentBatchEdges = new Set<string>();

    for (const edge of originalBatchEdges) {
      if (!removedBatchEdges.has(edge)) {
        currentBatchEdges.add(edge);
      }
    }

    for (const pending of pendingBatchEdges) {
      const edgeId = `batch-edge-${pending.from}-${pending.to}`;
      currentBatchEdges.add(edgeId);
    }

    // Check batch edge changes
    if (currentBatchEdges.size !== originalBatchEdges.size) {
      return true;
    }

    for (const edge of originalBatchEdges) {
      if (!currentBatchEdges.has(edge)) {
        return true;
      }
    }

    for (const edge of currentBatchEdges) {
      if (!originalBatchEdges.has(edge)) {
        return true;
      }
    }

    return false;
  }, [
    originalEdges,
    pendingEdges,
    removedEdges,
    originalBatchEdges,
    pendingBatchEdges,
    removedBatchEdges,
  ]);

  // Helper to find an issue (task or batch) by its number and get its ID
  const findIssueIdByNumber = useCallback(
    (issueNumber: number): number | null => {
      // Check if it's the epic itself
      if (epic.number === issueNumber) {
        return epic.id;
      }
      // Check batches
      for (const batch of epic.batches) {
        if (batch.number === issueNumber) {
          return batch.id;
        }
        // Check tasks within batch
        for (const task of batch.tasks) {
          if (task.number === issueNumber) {
            return task.id;
          }
        }
      }
      return null;
    },
    [epic],
  );

  // Handle save button click - saves changes to GitHub
  const handleSave = useCallback(async () => {
    if (!api) {
      console.error("Cannot save: No API instance provided");
      onSave?.({
        success: false,
        addedCount: 0,
        removedCount: 0,
        errors: ["No API instance provided. Please sign in to save changes."],
        addedTaskEdges: [],
        addedBatchEdges: [],
        removedTaskEdges: [],
        removedBatchEdges: [],
      });
      return;
    }

    setIsSaving(true);
    const errors: string[] = [];
    let addedCount = 0;
    let removedCount = 0;

    // Track successfully saved edges
    const successfullyAddedTaskEdges: { from: number; to: number }[] = [];
    const successfullyAddedBatchEdges: { from: number; to: number }[] = [];
    const successfullyRemovedTaskEdges: { from: number; to: number }[] = [];
    const successfullyRemovedBatchEdges: { from: number; to: number }[] = [];

    try {
      // Process added task edges
      // When user clicks A then B, they create edge from A to B
      // This means B is blocked by A, so we need to add A as a dependency of B
      for (const pending of pendingEdges) {
        const blockingIssueId = findIssueIdByNumber(pending.from);
        if (!blockingIssueId) {
          errors.push(`Could not find issue ID for task #${pending.from}`);
          continue;
        }

        try {
          await api.addDependency(
            epic.owner,
            epic.repo,
            pending.to, // The issue that will be blocked (issue_number)
            blockingIssueId, // The blocking issue (issue_id)
          );
          addedCount++;
          successfullyAddedTaskEdges.push({
            from: pending.from,
            to: pending.to,
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : "Unknown error";
          errors.push(
            `Failed to add dependency: #${pending.to} blocked by #${pending.from} - ${message}`,
          );
        }
      }

      // Process added batch edges
      for (const pending of pendingBatchEdges) {
        const blockingIssueId = findIssueIdByNumber(pending.from);
        if (!blockingIssueId) {
          errors.push(`Could not find issue ID for batch #${pending.from}`);
          continue;
        }

        try {
          await api.addDependency(
            epic.owner,
            epic.repo,
            pending.to,
            blockingIssueId,
          );
          addedCount++;
          successfullyAddedBatchEdges.push({
            from: pending.from,
            to: pending.to,
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : "Unknown error";
          errors.push(
            `Failed to add batch dependency: #${pending.to} blocked by #${pending.from} - ${message}`,
          );
        }
      }

      // Process removed task edges
      // Edge IDs are in format "edge-{dependency}-{dependent}"
      // where dependency blocks dependent
      for (const edgeId of removedEdges) {
        const match = edgeId.match(/^edge-(\d+)-(\d+)$/);
        if (!match) continue;

        const dependencyNumber = parseInt(match[1], 10); // The blocking issue
        const dependentNumber = parseInt(match[2], 10); // The blocked issue

        const blockingIssueId = findIssueIdByNumber(dependencyNumber);
        if (!blockingIssueId) {
          errors.push(`Could not find issue ID for task #${dependencyNumber}`);
          continue;
        }

        try {
          await api.removeDependency(
            epic.owner,
            epic.repo,
            dependentNumber, // The issue that is blocked
            blockingIssueId, // The blocking issue ID
          );
          removedCount++;
          successfullyRemovedTaskEdges.push({
            from: dependencyNumber,
            to: dependentNumber,
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : "Unknown error";
          errors.push(
            `Failed to remove dependency: #${dependentNumber} blocked by #${dependencyNumber} - ${message}`,
          );
        }
      }

      // Process removed batch edges
      for (const edgeId of removedBatchEdges) {
        const match = edgeId.match(/^batch-edge-(\d+)-(\d+)$/);
        if (!match) continue;

        const dependencyNumber = parseInt(match[1], 10);
        const dependentNumber = parseInt(match[2], 10);

        const blockingIssueId = findIssueIdByNumber(dependencyNumber);
        if (!blockingIssueId) {
          errors.push(`Could not find issue ID for batch #${dependencyNumber}`);
          continue;
        }

        try {
          await api.removeDependency(
            epic.owner,
            epic.repo,
            dependentNumber,
            blockingIssueId,
          );
          removedCount++;
          successfullyRemovedBatchEdges.push({
            from: dependencyNumber,
            to: dependentNumber,
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : "Unknown error";
          errors.push(
            `Failed to remove batch dependency: #${dependentNumber} blocked by #${dependencyNumber} - ${message}`,
          );
        }
      }

      // Clear only the successfully saved edges from pending state
      // Remove successfully added edges from pending
      setPendingEdges((prev) =>
        prev.filter(
          (e) =>
            !successfullyAddedTaskEdges.some(
              (s) => s.from === e.from && s.to === e.to,
            ),
        ),
      );
      setPendingBatchEdges((prev) =>
        prev.filter(
          (e) =>
            !successfullyAddedBatchEdges.some(
              (s) => s.from === e.from && s.to === e.to,
            ),
        ),
      );

      // Remove successfully removed edges from the removed set
      setRemovedEdges((prev) => {
        const next = new Set(prev);
        for (const edge of successfullyRemovedTaskEdges) {
          next.delete(`edge-${edge.from}-${edge.to}`);
        }
        return next;
      });
      setRemovedBatchEdges((prev) => {
        const next = new Set(prev);
        for (const edge of successfullyRemovedBatchEdges) {
          next.delete(`batch-edge-${edge.from}-${edge.to}`);
        }
        return next;
      });

      // Clear selection state
      setEditModeSourceTask(null);
      setEditModeSourceBatch(null);

      const result: SaveResult = {
        success: errors.length === 0,
        addedCount,
        removedCount,
        errors,
        addedTaskEdges: successfullyAddedTaskEdges,
        addedBatchEdges: successfullyAddedBatchEdges,
        removedTaskEdges: successfullyRemovedTaskEdges,
        removedBatchEdges: successfullyRemovedBatchEdges,
      };

      onSave?.(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      errors.push(`Save operation failed: ${message}`);
      onSave?.({
        success: false,
        addedCount,
        removedCount,
        errors,
        addedTaskEdges: successfullyAddedTaskEdges,
        addedBatchEdges: successfullyAddedBatchEdges,
        removedTaskEdges: successfullyRemovedTaskEdges,
        removedBatchEdges: successfullyRemovedBatchEdges,
      });
    } finally {
      setIsSaving(false);
    }
  }, [
    api,
    epic,
    pendingEdges,
    pendingBatchEdges,
    removedEdges,
    removedBatchEdges,
    findIssueIdByNumber,
    onSave,
  ]);

  // Handle clear changes button click
  const handleClearChanges = useCallback(() => {
    setPendingEdges([]);
    setRemovedEdges(new Set());
    setEditModeSourceTask(null);
    setPendingBatchEdges([]);
    setRemovedBatchEdges(new Set());
    setEditModeSourceBatch(null);
  }, []);

  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const isPanning = useRef(false);
  const lastMousePos = useRef({ x: 0, y: 0 });
  const hasInitialLayout = useRef(false);

  // Create a modified epic that includes pending edges and excludes removed edges
  const modifiedEpic = useMemo(() => {
    // Deep clone the epic to avoid mutating the original
    const clonedEpic: Epic = JSON.parse(JSON.stringify(epic));

    // Add pending edges as dependencies
    // When user clicks A then B, they want arrow from A to B
    // This means B depends on A, so we add A to B's dependsOn
    for (const pending of pendingEdges) {
      // Find the task that should have this dependency added (the target task)
      for (const batch of clonedEpic.batches) {
        const task = batch.tasks.find((t) => t.number === pending.to);
        if (task && !task.dependsOn.includes(pending.from)) {
          task.dependsOn.push(pending.from);
        }
      }
      // Also add to the epic's dependencies array
      // Note: in the Dependency type, "from" is the task that depends, "to" is what it depends on
      // But for visual clarity, we keep pending as { from: source, to: target }
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
    // Edge IDs are in format "edge-{dependency}-{dependent}"
    // So edge-A-B means B depends on A (arrow from A to B)
    for (const edgeId of removedEdges) {
      const match = edgeId.match(/^edge-(\d+)-(\d+)$/);
      if (match) {
        const dependency = parseInt(match[1], 10); // The task being depended on
        const dependent = parseInt(match[2], 10); // The task that depends

        // Remove from task dependsOn arrays
        // Find the dependent task and remove the dependency from its dependsOn
        for (const batch of clonedEpic.batches) {
          const task = batch.tasks.find((t) => t.number === dependent);
          if (task) {
            task.dependsOn = task.dependsOn.filter((d) => d !== dependency);
          }
        }

        // Remove from epic dependencies
        // In Dependency type, "from" is the dependent, "to" is the dependency
        clonedEpic.dependencies = clonedEpic.dependencies.filter(
          (d) => !(d.from === dependent && d.to === dependency),
        );
      }
    }

    // Add pending batch edges as dependencies
    for (const pending of pendingBatchEdges) {
      // Find the batch that should have this dependency added
      const batch = clonedEpic.batches.find((b) => b.number === pending.to);
      if (batch && !batch.dependsOn.includes(pending.from)) {
        batch.dependsOn.push(pending.from);
      }
    }

    // Remove batch edges that are marked as removed
    for (const edgeId of removedBatchEdges) {
      const match = edgeId.match(/^batch-edge-(\d+)-(\d+)$/);
      if (match) {
        const dependency = parseInt(match[1], 10); // The batch being depended on
        const dependent = parseInt(match[2], 10); // The batch that depends

        // Remove from batch dependsOn array
        const batch = clonedEpic.batches.find((b) => b.number === dependent);
        if (batch) {
          batch.dependsOn = batch.dependsOn.filter((d) => d !== dependency);
        }
      }
    }

    return clonedEpic;
  }, [epic, pendingEdges, removedEdges, pendingBatchEdges, removedBatchEdges]);

  // Calculate layout when epic or modifications change
  useEffect(() => {
    let cancelled = false;

    async function runLayout() {
      // Don't show loading spinner for edit mode recalculations after initial load
      if (!hasInitialLayout.current) {
        setIsLoading(true);
      }
      setError(null);

      try {
        const result = await calculateElkLayout(modifiedEpic, config);

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
  }, [modifiedEpic, config]);

  // Get highlighted edges and related tasks
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

  // Pan handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 0) {
      isPanning.current = true;
      setCursorStyle("grabbing");
      lastMousePos.current = { x: e.clientX, y: e.clientY };
    }
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning.current) return;

    const dx = e.clientX - lastMousePos.current.x;
    const dy = e.clientY - lastMousePos.current.y;

    setTransform((prev) => ({
      ...prev,
      x: prev.x + dx,
      y: prev.y + dy,
    }));

    lastMousePos.current = { x: e.clientX, y: e.clientY };
  }, []);

  const handleMouseUp = useCallback(() => {
    isPanning.current = false;
    setCursorStyle("grab");
  }, []);

  const handleMouseLeave = useCallback(() => {
    isPanning.current = false;
    setCursorStyle("grab");
  }, []);

  // Zoom handler
  const handleWheel = useCallback(
    (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const container = containerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      // Use a gentler zoom factor based on actual delta
      // Trackpad pinch gestures have smaller deltaY values
      const zoomSensitivity = 0.002;
      const delta = 1 - e.deltaY * zoomSensitivity;
      const newScale = Math.min(Math.max(transform.scale * delta, 0.25), 2);

      // Zoom towards mouse position
      const scaleChange = newScale / transform.scale;
      const newX = mouseX - (mouseX - transform.x) * scaleChange;
      const newY = mouseY - (mouseY - transform.y) * scaleChange;

      setTransform({
        x: newX,
        y: newY,
        scale: newScale,
      });
    },
    [transform],
  );

  // Attach non-passive wheel listener to prevent page scroll
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      container.removeEventListener("wheel", handleWheel);
    };
  }, [handleWheel]);

  // Reset view
  const handleResetView = useCallback(() => {
    setTransform({ x: 0, y: 0, scale: 1 });
  }, []);

  // Fit to view
  const handleFitToView = useCallback(() => {
    if (!layout || !containerRef.current) return;

    const container = containerRef.current;
    const rect = container.getBoundingClientRect();

    const scaleX = (rect.width - 48) / layout.canvasWidth;
    const scaleY = (rect.height - 48) / layout.canvasHeight;
    const scale = Math.min(scaleX, scaleY, 1);

    const x = (rect.width - layout.canvasWidth * scale) / 2;
    const y = (rect.height - layout.canvasHeight * scale) / 2;

    setTransform({ x, y, scale });
  }, [layout]);

  // Find original task data
  const findTask = useCallback(
    (taskNumber: number): Task | undefined => {
      for (const batch of epic.batches) {
        const task = batch.tasks.find((t) => t.number === taskNumber);
        if (task) return task;
      }
      return undefined;
    },
    [epic],
  );

  // Handle task click - different behavior in edit mode
  const handleTaskClick = useCallback(
    (taskNumber: number) => {
      if (isEditMode) {
        // Clear any batch source selection when clicking a task
        setEditModeSourceBatch(null);

        // Edit mode: first click selects source, second click creates relationship
        if (editModeSourceTask === null) {
          // First click - select source task
          setEditModeSourceTask(taskNumber);
        } else if (editModeSourceTask === taskNumber) {
          // Clicked same task - deselect
          setEditModeSourceTask(null);
        } else {
          // Second click on different task - create relationship
          // The edge ID format is "edge-{from}-{to}" where from is the dependency
          const edgeId = `edge-${editModeSourceTask}-${taskNumber}`;

          // Check if this edge was previously removed - if so, undo the removal
          if (removedEdges.has(edgeId)) {
            setRemovedEdges((prev) => {
              const next = new Set(prev);
              next.delete(edgeId);
              return next;
            });
            // Clear source selection
            setEditModeSourceTask(null);
            return;
          }

          // Check if this edge already exists or is pending
          const existingEdge = layout?.edges.find(
            (e) =>
              e.from === editModeSourceTask &&
              e.to === taskNumber &&
              !e.isBatchEdge,
          );
          const pendingExists = pendingEdges.some(
            (e) => e.from === editModeSourceTask && e.to === taskNumber,
          );

          if (!existingEdge && !pendingExists) {
            setPendingEdges((prev) => [
              ...prev,
              { from: editModeSourceTask, to: taskNumber },
            ]);
          }
          // Clear source selection
          setEditModeSourceTask(null);
        }
      } else {
        // Select mode: open task details
        const task = findTask(taskNumber);
        if (task && onTaskClick) {
          onTaskClick(task);
        }
      }
    },
    [
      isEditMode,
      editModeSourceTask,
      findTask,
      onTaskClick,
      layout,
      pendingEdges,
      removedEdges,
    ],
  );

  // Handle edge click in edit mode - remove the relationship
  const handleEdgeClick = useCallback(
    (edge: { id: string; from: number; to: number; isBatchEdge?: boolean }) => {
      if (isEditMode) {
        if (edge.isBatchEdge) {
          // Handle batch edge
          const pendingIndex = pendingBatchEdges.findIndex(
            (e) => e.from === edge.from && e.to === edge.to,
          );

          if (pendingIndex !== -1) {
            // Remove from pending batch edges
            setPendingBatchEdges((prev) =>
              prev.filter((_, i) => i !== pendingIndex),
            );
          } else {
            // Mark existing batch edge as removed
            setRemovedBatchEdges((prev) => new Set(prev).add(edge.id));
          }
        } else {
          // Handle task edge
          const pendingIndex = pendingEdges.findIndex(
            (e) => e.from === edge.from && e.to === edge.to,
          );

          if (pendingIndex !== -1) {
            // Remove from pending edges
            setPendingEdges((prev) =>
              prev.filter((_, i) => i !== pendingIndex),
            );
          } else {
            // Mark existing edge as removed
            setRemovedEdges((prev) => new Set(prev).add(edge.id));
          }
        }
      }
    },
    [isEditMode, pendingEdges, pendingBatchEdges],
  );

  // Handle batch click - starts or completes a batch relationship
  const handleBatchClick = useCallback(
    (batchNumber: number) => {
      if (isEditMode) {
        // Clear any task source selection when clicking a batch
        setEditModeSourceTask(null);

        if (editModeSourceBatch === batchNumber) {
          // Clicked same batch - deselect
          setEditModeSourceBatch(null);
        } else if (editModeSourceBatch === null) {
          // First click - select source batch
          setEditModeSourceBatch(batchNumber);
        } else {
          // Second click on different batch - complete the relationship
          const edgeId = `batch-edge-${editModeSourceBatch}-${batchNumber}`;

          // Check if this edge was previously removed - if so, undo the removal
          if (removedBatchEdges.has(edgeId)) {
            setRemovedBatchEdges((prev) => {
              const next = new Set(prev);
              next.delete(edgeId);
              return next;
            });
            setEditModeSourceBatch(null);
            return;
          }

          // Check if this edge already exists or is pending
          const existingEdge = layout?.edges.find(
            (e) =>
              e.from === editModeSourceBatch &&
              e.to === batchNumber &&
              e.isBatchEdge,
          );
          const pendingExists = pendingBatchEdges.some(
            (e) => e.from === editModeSourceBatch && e.to === batchNumber,
          );

          if (!existingEdge && !pendingExists) {
            setPendingBatchEdges((prev) => [
              ...prev,
              { from: editModeSourceBatch, to: batchNumber },
            ]);
          }
          // Clear source selection
          setEditModeSourceBatch(null);
        }
      }
    },
    [
      isEditMode,
      editModeSourceBatch,
      layout,
      pendingBatchEdges,
      removedBatchEdges,
    ],
  );

  // Reset edit mode state when switching tools
  const handleToolChange = useCallback((tool: ToolType) => {
    setActiveTool(tool);
    setEditModeSourceTask(null);
    setEditModeSourceBatch(null);
  }, []);

  // Get filtered edges (excluding removed ones)
  const visibleEdges = useMemo(() => {
    if (!layout) return [];
    return layout.edges.filter((edge) => {
      if (edge.isBatchEdge) {
        return !removedBatchEdges.has(edge.id);
      }
      return !removedEdges.has(edge.id);
    });
  }, [layout, removedEdges, removedBatchEdges]);

  // Get set of pending edge IDs for styling
  const pendingEdgeIds = useMemo(() => {
    const ids = new Set<string>();
    // Task edges
    for (const pending of pendingEdges) {
      // Edge IDs are in format "edge-{dependency}-{dependent}"
      // When user clicks A then B, they want B to depend on A (arrow from A to B)
      // So pending.from is the dependency (source of arrow) and pending.to is the dependent (target of arrow)
      // The layout engine creates edges as "edge-{depNum}-{task.number}" where task depends on depNum
      // So the edge ID should be "edge-{from}-{to}"
      ids.add(`edge-${pending.from}-${pending.to}`);
    }
    // Batch edges
    for (const pending of pendingBatchEdges) {
      ids.add(`batch-edge-${pending.from}-${pending.to}`);
    }
    return ids;
  }, [pendingEdges, pendingBatchEdges]);

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center h-full ${className}`}>
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Calculating layout...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`flex items-center justify-center h-full ${className}`}>
        <div className="text-center">
          <p className="text-destructive font-medium">Layout Error</p>
          <p className="text-sm text-muted-foreground mt-1">{error}</p>
        </div>
      </div>
    );
  }

  if (!layout) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden bg-background ${className}`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      style={{ cursor: cursorStyle }}
    >
      {/* Controls */}
      <div className="absolute top-4 right-4 z-10 flex gap-2">
        <button
          onClick={handleFitToView}
          className="px-3 py-1.5 text-xs font-medium bg-card border border-border rounded-md hover:bg-muted transition-colors"
        >
          Fit
        </button>
        <button
          onClick={handleResetView}
          className="px-3 py-1.5 text-xs font-medium bg-card border border-border rounded-md hover:bg-muted transition-colors"
        >
          Reset
        </button>
        <span className="px-3 py-1.5 text-xs font-medium bg-card border border-border rounded-md">
          {Math.round(transform.scale * 100)}%
        </span>
      </div>

      {/* Bottom Toolbar */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-2">
        {/* Save/Clear buttons - only shown when there are changes */}
        {hasChanges && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleClearChanges}
              disabled={isSaving}
              className="px-4 py-2 text-sm font-medium bg-card border border-border text-foreground rounded-lg hover:bg-muted transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Clear Changes
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || !api}
              className="px-4 py-2 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : !api ? (
                "Sign in to Save"
              ) : (
                "Save Changes"
              )}
            </button>
          </div>
        )}
        <CanvasToolbar
          activeTool={activeTool}
          onToolChange={handleToolChange}
        />
      </div>

      {/* Edit mode hint */}
      {isEditMode && (
        <div className="absolute top-4 left-4 z-10 px-3 py-1.5 text-xs font-medium bg-card border border-border rounded-md">
          {editModeSourceTask !== null ? (
            <span className="text-green-500">
              Click another task to create link, or same task to cancel
            </span>
          ) : editModeSourceBatch !== null ? (
            <span className="text-green-500">
              Click another batch to create link, or same batch to cancel
            </span>
          ) : (
            <span className="text-muted-foreground">
              Click a task or batch to start, or click an arrow to remove
            </span>
          )}
        </div>
      )}

      {/* SVG Canvas */}
      <svg
        width={layout.canvasWidth}
        height={layout.canvasHeight}
        viewBox={`0 0 ${layout.canvasWidth} ${layout.canvasHeight}`}
        className="absolute"
        style={{
          transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
          transformOrigin: "0 0",
        }}
      >
        {/* Definitions */}
        <defs>
          <marker
            id="arrowhead"
            markerWidth="10"
            markerHeight="10"
            refX="9"
            refY="5"
            orient="auto"
            markerUnits="userSpaceOnUse"
          >
            <polyline
              points="1 1, 9 5, 1 9"
              fill="none"
              stroke="var(--muted-foreground)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </marker>
          <marker
            id="arrowhead-highlighted"
            markerWidth="10"
            markerHeight="10"
            refX="9"
            refY="5"
            orient="auto"
            markerUnits="userSpaceOnUse"
          >
            <polyline
              points="1 1, 9 5, 1 9"
              fill="none"
              stroke="var(--primary)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </marker>
          <marker
            id="arrowhead-batch"
            markerWidth="12"
            markerHeight="12"
            refX="10"
            refY="6"
            orient="auto"
            markerUnits="userSpaceOnUse"
          >
            <polyline
              points="2 2, 10 6, 2 10"
              fill="none"
              stroke="var(--primary)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </marker>
          <marker
            id="arrowhead-pending"
            markerWidth="10"
            markerHeight="10"
            refX="9"
            refY="5"
            orient="auto"
            markerUnits="userSpaceOnUse"
          >
            <polyline
              points="1 1, 9 5, 1 9"
              fill="none"
              stroke="#22c55e"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </marker>
          <marker
            id="arrowhead-snip"
            markerWidth="10"
            markerHeight="10"
            refX="9"
            refY="5"
            orient="auto"
            markerUnits="userSpaceOnUse"
          >
            <polyline
              points="1 1, 9 5, 1 9"
              fill="none"
              stroke="#f87171"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </marker>
        </defs>

        {/* Batch-to-batch edges (rendered BEFORE batches so they appear BEHIND) */}
        <ElkEdges
          edges={visibleEdges}
          highlightedEdges={highlightedEdges}
          hasHighlightedTask={highlightedTask !== null}
          isEditMode={isEditMode}
          onEdgeClick={handleEdgeClick}
          batchEdgesOnly={true}
          pendingEdgeIds={pendingEdgeIds}
        />

        {/* Batch groups (rendered after batch edges, before task edges) */}
        {layout.batches.map((batch) => (
          <ElkBatchGroup
            key={batch.id}
            batch={batch}
            isHighlighted={relatedTasks.size > 0}
            isEditMode={isEditMode}
            isEditModeSelected={editModeSourceBatch === batch.batchNumber}
            onClick={handleBatchClick}
          />
        ))}

        {/* Task edges (rendered after batches so they appear on top) */}
        <ElkEdges
          edges={visibleEdges}
          highlightedEdges={highlightedEdges}
          hasHighlightedTask={highlightedTask !== null}
          isEditMode={isEditMode}
          onEdgeClick={handleEdgeClick}
          taskEdgesOnly={true}
          pendingEdgeIds={pendingEdgeIds}
        />

        {/* Task nodes */}
        {layout.tasks.map((task) => (
          <ElkTaskNode
            key={task.id}
            task={task}
            isHighlighted={!isEditMode && highlightedTask === task.taskNumber}
            isRelated={
              !isEditMode &&
              relatedTasks.has(task.taskNumber) &&
              highlightedTask !== task.taskNumber
            }
            isDimmed={
              !isEditMode &&
              highlightedTask !== null &&
              !relatedTasks.has(task.taskNumber)
            }
            isEditModeSelected={editModeSourceTask === task.taskNumber}
            isEditMode={isEditMode}
            onHover={setHighlightedTask}
            onClick={handleTaskClick}
          />
        ))}
      </svg>
    </div>
  );
}
