/**
 * Node Measurement Utilities
 *
 * Provides functions to measure the dimensions of task cards
 * before layout. This is critical for getting accurate layout results.
 */

import { Task } from "@/types";
import {
  NodeDimensions,
  MeasurementCache,
  ElkLayoutConfig,
  DEFAULT_ELK_CONFIG,
} from "./types";

// Global measurement cache
const measurementCache: MeasurementCache = new Map();

/**
 * Generate a cache key for a task based on its content
 */
function getTaskCacheKey(task: Task, fixedWidth: number): string {
  // Key based on title length and width since that determines height
  const titleBucket = Math.ceil(task.title.length / 10) * 10;
  return `task:${titleBucket}:${fixedWidth}`;
}

/**
 * Estimate task card height based on title length
 * This provides a fast estimation without DOM measurement
 */
function estimateTaskHeight(
  title: string,
  width: number,
  config: ElkLayoutConfig,
): number {
  // Approximate characters per line based on width
  // Using ~7px per character average for the font size
  const charsPerLine = Math.floor((width - 24) / 7); // 24px for padding
  const lines = Math.ceil(title.length / charsPerLine);

  // Base height: padding (16px) + lines * line height (18px) + issue number (16px)
  const baseHeight = 16 + lines * 18 + 16;

  return Math.max(config.taskMinHeight, baseHeight);
}

/**
 * Measure a single task's dimensions
 * Uses estimation by default, can use DOM measurement for precision
 */
export function measureTask(
  task: Task,
  config: ElkLayoutConfig = DEFAULT_ELK_CONFIG,
  useDomMeasurement: boolean = false,
): NodeDimensions {
  const width = config.taskWidth;
  const cacheKey = getTaskCacheKey(task, width);

  // Check cache first
  const cached = measurementCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  let height: number;

  if (useDomMeasurement && typeof document !== "undefined") {
    // Create an offscreen element to measure
    const measureDiv = document.createElement("div");
    measureDiv.style.cssText = `
      position: absolute;
      visibility: hidden;
      width: ${width}px;
      padding: 8px 12px;
      font-size: 12px;
      line-height: 1.4;
      font-family: var(--font-sans, system-ui, sans-serif);
    `;
    measureDiv.innerHTML = `
      <div style="word-break: break-words;">${task.title}</div>
      <div style="font-size: 10px; margin-top: 4px;">#${task.number}</div>
    `;

    document.body.appendChild(measureDiv);
    height = Math.max(config.taskMinHeight, measureDiv.offsetHeight);
    document.body.removeChild(measureDiv);
  } else {
    // Use estimation
    height = estimateTaskHeight(task.title, width, config);
  }

  const dimensions: NodeDimensions = { width, height };
  measurementCache.set(cacheKey, dimensions);

  return dimensions;
}

/**
 * Measure all tasks in a batch
 */
export function measureBatchTasks(
  tasks: Task[],
  config: ElkLayoutConfig = DEFAULT_ELK_CONFIG,
): Map<number, NodeDimensions> {
  const measurements = new Map<number, NodeDimensions>();

  for (const task of tasks) {
    measurements.set(task.number, measureTask(task, config));
  }

  return measurements;
}

/**
 * Clear the measurement cache
 * Call this when layout config changes
 */
export function clearMeasurementCache(): void {
  measurementCache.clear();
}

/**
 * Pre-warm the measurement cache for a set of tasks
 * Useful for batch processing before layout
 */
export function prewarmCache(
  tasks: Task[],
  config: ElkLayoutConfig = DEFAULT_ELK_CONFIG,
): void {
  for (const task of tasks) {
    measureTask(task, config);
  }
}
