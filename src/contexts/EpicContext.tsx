/**
 * EpicContext
 *
 * React context for managing shared state across the ElkCanvas component tree.
 * Includes tool selection, repository info, and other global canvas state.
 */

"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  ReactNode,
} from "react";
import { Epic } from "@/types";
import { GitHubApi } from "@/lib/github";

/**
 * Canvas display settings
 */
export interface CanvasSettings {
  /** Whether to show edges between tasks in different batches */
  showInterBatchEdges: boolean;
  /** Whether to show dependency arrows between tasks (within and across batches) */
  showTaskDependencies: boolean;
}

const DEFAULT_SETTINGS: CanvasSettings = {
  showInterBatchEdges: true,
  showTaskDependencies: false,
};

/**
 * Available tool types
 */
export type ToolType = "select" | "edit-relationships" | "move-issue";

/**
 * Repository information
 */
export interface RepoInfo {
  owner: string;
  repo: string;
}

/**
 * Epic context value - all shared state for the canvas
 */
interface EpicContextValue {
  // Repository info
  /** Repository owner */
  owner: string;
  /** Repository name */
  repo: string;
  /** Epic title */
  epicTitle: string;
  /** GitHub API instance (if authenticated) */
  api?: GitHubApi;

  // Tool state
  /** Currently active tool */
  activeTool: ToolType;
  /** Set the active tool */
  setActiveTool: (tool: ToolType) => void;
  /** Whether edit relationships mode is active */
  isEditMode: boolean;
  /** Whether move issue mode is active */
  isMoveMode: boolean;
  /** Register a cleanup callback for tool changes */
  registerToolChangeCallback: (callback: (tool: ToolType) => void) => void;

  // Export state
  /** Whether an export is in progress */
  isExporting: boolean;
  /** Set export state */
  setIsExporting: (exporting: boolean) => void;

  // Settings state
  /** Canvas display settings */
  settings: CanvasSettings;
  /** Update a specific setting */
  updateSetting: <K extends keyof CanvasSettings>(
    key: K,
    value: CanvasSettings[K],
  ) => void;
}

const EpicContext = createContext<EpicContextValue | null>(null);

interface EpicProviderProps {
  children: ReactNode;
  /** The epic being visualized */
  epic: Epic;
  /** GitHub API instance (if authenticated) */
  api?: GitHubApi;
  /** Initial tool selection */
  initialTool?: ToolType;
}

export function EpicProvider({
  children,
  epic,
  api,
  initialTool = "select",
}: EpicProviderProps) {
  // Tool state
  const [activeTool, setActiveToolState] = useState<ToolType>(initialTool);
  const [toolChangeCallback, setToolChangeCallback] = useState<
    ((tool: ToolType) => void) | undefined
  >();

  // Export state
  const [isExporting, setIsExporting] = useState(false);

  // Settings state
  const [settings, setSettings] = useState<CanvasSettings>(DEFAULT_SETTINGS);

  const updateSetting = useCallback(
    <K extends keyof CanvasSettings>(key: K, value: CanvasSettings[K]) => {
      setSettings((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  // Derived tool modes
  const isEditMode = activeTool === "edit-relationships";
  const isMoveMode = activeTool === "move-issue";

  const setActiveTool = useCallback(
    (tool: ToolType) => {
      setActiveToolState(tool);
      toolChangeCallback?.(tool);
    },
    [toolChangeCallback],
  );

  const registerToolChangeCallback = useCallback(
    (callback: (tool: ToolType) => void) => {
      setToolChangeCallback(() => callback);
    },
    [],
  );

  const value = useMemo<EpicContextValue>(
    () => ({
      // Repository info
      owner: epic.owner,
      repo: epic.repo,
      epicTitle: epic.title,
      api,

      // Tool state
      activeTool,
      setActiveTool,
      isEditMode,
      isMoveMode,
      registerToolChangeCallback,

      // Export state
      isExporting,
      setIsExporting,

      // Settings state
      settings,
      updateSetting,
    }),
    [
      epic.owner,
      epic.repo,
      epic.title,
      api,
      activeTool,
      setActiveTool,
      isEditMode,
      isMoveMode,
      registerToolChangeCallback,
      isExporting,
      settings,
      updateSetting,
    ],
  );

  return <EpicContext.Provider value={value}>{children}</EpicContext.Provider>;
}

/**
 * Hook to access the full epic context
 */
export function useEpicContext(): EpicContextValue {
  const context = useContext(EpicContext);
  if (!context) {
    throw new Error("useEpicContext must be used within an EpicProvider");
  }
  return context;
}

/**
 * Hook to access just the tool state
 */
export function useTool() {
  const {
    activeTool,
    setActiveTool,
    isEditMode,
    isMoveMode,
    registerToolChangeCallback,
  } = useEpicContext();
  return {
    activeTool,
    setActiveTool,
    isEditMode,
    isMoveMode,
    registerToolChangeCallback,
  };
}

/**
 * Hook to access just the repository info
 */
export function useRepoInfo(): RepoInfo {
  const { owner, repo } = useEpicContext();
  return { owner, repo };
}

/**
 * Hook to check if a specific tool is active
 */
export function useIsToolActive(tool: ToolType): boolean {
  const { activeTool } = useEpicContext();
  return activeTool === tool;
}

/**
 * Hook to access the GitHub API
 */
export function useGitHubApi(): GitHubApi | undefined {
  const { api } = useEpicContext();
  return api;
}

/**
 * Hook to access canvas settings
 */
export function useCanvasSettings() {
  const { settings, updateSetting } = useEpicContext();
  return { settings, updateSetting };
}
