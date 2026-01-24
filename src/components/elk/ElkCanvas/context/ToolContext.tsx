/**
 * ToolContext
 *
 * React context for managing the currently selected canvas tool.
 * This allows subcomponents to access tool state without prop drilling.
 */

"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
} from "react";

/**
 * Available tool types
 */
export type ToolType = "select" | "edit-relationships" | "move-issue";

interface ToolContextValue {
  /** Currently active tool */
  activeTool: ToolType;
  /** Set the active tool */
  setActiveTool: (tool: ToolType) => void;
  /** Whether edit relationships mode is active */
  isEditMode: boolean;
  /** Whether move issue mode is active */
  isMoveMode: boolean;
  /** Callback when tool changes - for cleanup */
  onToolChange?: (tool: ToolType) => void;
  /** Register a cleanup callback for tool changes */
  registerToolChangeCallback: (callback: (tool: ToolType) => void) => void;
}

const ToolContext = createContext<ToolContextValue | null>(null);

interface ToolProviderProps {
  children: ReactNode;
  /** Initial tool selection */
  initialTool?: ToolType;
}

export function ToolProvider({
  children,
  initialTool = "select",
}: ToolProviderProps) {
  const [activeTool, setActiveToolState] = useState<ToolType>(initialTool);
  const [toolChangeCallback, setToolChangeCallback] = useState<
    ((tool: ToolType) => void) | undefined
  >();

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

  return (
    <ToolContext.Provider
      value={{
        activeTool,
        setActiveTool,
        isEditMode,
        isMoveMode,
        registerToolChangeCallback,
      }}
    >
      {children}
    </ToolContext.Provider>
  );
}

/**
 * Hook to access the tool context
 */
export function useTool(): ToolContextValue {
  const context = useContext(ToolContext);
  if (!context) {
    throw new Error("useTool must be used within a ToolProvider");
  }
  return context;
}

/**
 * Hook to check if a specific tool is active
 */
export function useIsToolActive(tool: ToolType): boolean {
  const { activeTool } = useTool();
  return activeTool === tool;
}
