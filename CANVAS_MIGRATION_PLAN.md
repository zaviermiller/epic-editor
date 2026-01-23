# Canvas-Based Layout Migration Plan

## Context

You are working on a GitHub Epic Visualizer application built with Next.js, React, and TypeScript. The application displays GitHub issues in a hierarchical structure: Epic → Batches → Tasks.

Currently, the `BatchContainer` component displays tasks within a batch using CSS Grid, with SVG arrows drawn to show dependencies between tasks. However, this approach has visual issues with arrow placement and task positioning.

**Your task is to migrate to a canvas-based approach** where tasks are positioned on a virtual grid and arrows are routed cleanly between them.

---

## Current Architecture

### Relevant Files

| File                                | Purpose                                               |
| ----------------------------------- | ----------------------------------------------------- |
| `src/components/BatchContainer.tsx` | Displays a batch with its tasks and dependency arrows |
| `src/components/TaskCard.tsx`       | Individual task card component                        |
| `src/types/index.ts`                | TypeScript types for Task, Batch, Epic, etc.          |
| `src/lib/github.ts`                 | GitHub API client                                     |

### Current Data Structures

```typescript
interface Task {
  number: number;
  title: string;
  status: "done" | "in-progress" | "planned" | "not-planned";
  dependsOn: number[]; // Task numbers this task depends on
  // ... other fields
}

interface Batch {
  number: number;
  title: string;
  tasks: Task[];
  // ... other fields
}
```

### Problem Statement

The current layout has these issues:

1. Arrows cross over tasks and look messy
2. Tasks are not optimally positioned to minimize arrow crossings
3. CSS Grid doesn't allow precise control over arrow routing

---

## Target Architecture

### Virtual Grid System

Create a virtual grid where each task occupies a cell. Dependencies flow left-to-right (columns represent dependency depth).

```
┌─────────────────────────────────────────────────────────────┐
│  BatchContainer                                              │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ Virtual Grid (columns × rows)                           ││
│  │                                                          ││
│  │  Col 0       Col 1       Col 2                          ││
│  │ ┌────────┐  ┌────────┐  ┌────────┐                      ││
│  │ │ Task A │─→│ Task C │─→│ Task E │   Row 0              ││
│  │ └────────┘  └────────┘  └────────┘                      ││
│  │ ┌────────┐       │                                       ││
│  │ │ Task B │───────┘                       Row 1           ││
│  │ └────────┘                                               ││
│  │ ┌────────┐                                               ││
│  │ │ Task D │ (no dependencies)             Row 2           ││
│  │ └────────┘                                               ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

---

## Implementation Plan

### Phase 1: Create Layout Engine

**Create file: `src/lib/layoutEngine.ts`**

This module calculates optimal grid positions for each task.

#### Types

```typescript
export interface GridCell {
  col: number;
  row: number;
}

export interface LayoutConfig {
  cellWidth: number; // Width of each task card (e.g., 160)
  cellHeight: number; // Height of each task card (e.g., 60)
  horizontalGap: number; // Gap between columns for arrows (e.g., 50)
  verticalGap: number; // Gap between rows (e.g., 16)
}

export interface TaskLayout {
  taskNumber: number;
  col: number;
  row: number;
  x: number; // Pixel x coordinate
  y: number; // Pixel y coordinate
}

export interface LayoutResult {
  tasks: TaskLayout[];
  gridWidth: number; // Total columns
  gridHeight: number; // Total rows
  canvasWidth: number; // Pixel width
  canvasHeight: number; // Pixel height
}
```

#### Algorithm: Sugiyama-style Layered Layout

Implement a graph layout algorithm with these steps:

1. **Layer Assignment (Columns)**
   - Build dependency graph from `task.dependsOn`
   - Tasks with no intra-batch dependencies → column 0
   - Tasks depending on column 0 tasks → column 1
   - Handle cycles by breaking them

2. **Crossing Reduction (Row Ordering)**
   - For each column, order tasks to minimize edge crossings
   - Use barycenter heuristic: position each task near the average row of its dependencies
   - Iterate multiple passes until stable

3. **Coordinate Assignment**
   - Convert (col, row) to pixel (x, y) using `LayoutConfig`

#### Function Signature

```typescript
export function calculateLayout(
  tasks: Task[],
  config: LayoutConfig,
): LayoutResult;
```

---

### Phase 2: Create Arrow Router

**Create file: `src/lib/arrowRouter.ts`**

This module generates clean SVG paths for dependency arrows.

#### Types

```typescript
export interface Connection {
  from: number; // Source task number
  to: number; // Target task number
}

export interface ArrowPath {
  from: number;
  to: number;
  path: string; // SVG path d attribute
}
```

#### Routing Strategy

1. **Horizontal Flow (most common)** - Source is left of target
   - Exit from right edge of source
   - Enter left edge of target
   - Use smooth cubic bezier curve

2. **Same Column** - Vertical connection
   - Exit from bottom of source
   - Enter top of target

3. **Backwards/Complex** - Target is left of source
   - Route around: exit right, go down, curve left, enter target

#### Path Generation

```typescript
export function generateArrowPaths(
  connections: Connection[],
  taskLayouts: Map<number, TaskLayout>,
  config: LayoutConfig,
): ArrowPath[];
```

For horizontal connections, use this bezier formula:

```typescript
const controlPointOffset = (toX - fromX) * 0.4;
const path = `M ${fromX} ${fromY} C ${fromX + controlPointOffset} ${fromY}, ${toX - controlPointOffset} ${toY}, ${toX} ${toY}`;
```

---

### Phase 3: Create BatchCanvas Component

**Create file: `src/components/BatchCanvas.tsx`**

A pure SVG-based rendering component.

#### Component Structure

```tsx
interface BatchCanvasProps {
  tasks: Task[];
  highlightedTask?: number | null;
  onTaskHover?: (taskNumber: number | null) => void;
  onTaskClick?: (task: Task) => void;
}

export function BatchCanvas({
  tasks,
  highlightedTask,
  onTaskHover,
  onTaskClick
}: BatchCanvasProps) {
  // 1. Calculate layout
  const layout = useMemo(() => calculateLayout(tasks, config), [tasks]);

  // 2. Build connections from task.dependsOn
  const connections = useMemo(() => buildConnections(tasks), [tasks]);

  // 3. Generate arrow paths
  const arrows = useMemo(() => generateArrowPaths(connections, layout), [connections, layout]);

  return (
    <svg
      width={layout.canvasWidth}
      height={layout.canvasHeight}
      viewBox={`0 0 ${layout.canvasWidth} ${layout.canvasHeight}`}
    >
      {/* Arrow marker definitions */}
      <defs>
        <marker id="arrowhead" ...>
          <polygon points="0 0, 8 4, 0 8" />
        </marker>
      </defs>

      {/* Arrows layer (behind tasks) */}
      <g className="arrows">
        {arrows.map(arrow => (
          <path
            key={`${arrow.from}-${arrow.to}`}
            d={arrow.path}
            stroke="rgba(148, 163, 184, 0.6)"
            strokeWidth={1.5}
            fill="none"
            markerEnd="url(#arrowhead)"
          />
        ))}
      </g>

      {/* Tasks layer (using foreignObject for React components) */}
      <g className="tasks">
        {layout.tasks.map(taskLayout => {
          const task = tasks.find(t => t.number === taskLayout.taskNumber);
          if (!task) return null;

          return (
            <foreignObject
              key={task.number}
              x={taskLayout.x}
              y={taskLayout.y}
              width={config.cellWidth}
              height={config.cellHeight}
            >
              <TaskCard
                task={task}
                isHighlighted={highlightedTask === task.number}
                onHover={onTaskHover}
                onClick={onTaskClick}
              />
            </foreignObject>
          );
        })}
      </g>
    </svg>
  );
}
```

---

### Phase 4: Update BatchContainer

**Modify file: `src/components/BatchContainer.tsx`**

Replace the current CSS Grid + SVG overlay approach with the new `BatchCanvas`.

```tsx
export function BatchContainer({
  batch,
  highlightedTask,
  onTaskHover,
  onTaskClick,
}: BatchContainerProps) {
  return (
    <div className="bg-card border border-border rounded-lg shadow-sm">
      {/* Header */}
      <div className="px-3 py-2 border-b border-border bg-muted/30 rounded-t-lg">
        <h3 className="text-sm font-medium">
          {batch.title} #{batch.number}
        </h3>
      </div>

      {/* Canvas */}
      <div className="p-3 overflow-auto">
        <BatchCanvas
          tasks={batch.tasks}
          highlightedTask={highlightedTask}
          onTaskHover={onTaskHover}
          onTaskClick={onTaskClick}
        />
      </div>
    </div>
  );
}
```

---

### Phase 5: Update TaskCard

**Modify file: `src/components/TaskCard.tsx`**

Ensure TaskCard works well inside `foreignObject`:

- Use fixed dimensions that match `LayoutConfig.cellWidth` and `cellHeight`
- Ensure full title is visible (no truncation)
- Keep hover/click handlers

---

## File Structure After Migration

```
src/
├── components/
│   ├── BatchContainer.tsx      # Simplified, uses BatchCanvas
│   ├── BatchCanvas.tsx         # NEW: SVG rendering layer
│   ├── TaskCard.tsx            # Updated for fixed dimensions
│   └── ...
├── lib/
│   ├── layoutEngine.ts         # NEW: Grid position calculator
│   ├── arrowRouter.ts          # NEW: Arrow path generator
│   ├── github.ts               # Unchanged
│   └── ...
└── types/
    └── index.ts                # May need new layout types
```

---

## Configuration Constants

Use these values as starting points (adjust as needed):

```typescript
const LAYOUT_CONFIG: LayoutConfig = {
  cellWidth: 150,
  cellHeight: 55,
  horizontalGap: 50,
  verticalGap: 16,
};
```

---

## Testing Checklist

After implementation, verify:

- [ ] Tasks with no dependencies appear in column 0
- [ ] Dependent tasks appear in later columns
- [ ] Arrows flow cleanly from left to right
- [ ] No arrows cross over task cards
- [ ] Minimal arrow crossings between each other
- [ ] Task titles are fully visible (not truncated)
- [ ] Hover highlighting works on tasks and related arrows
- [ ] Click handlers work correctly
- [ ] Layout scales well with 2-15 tasks per batch
- [ ] Works with the existing mock data in `src/lib/mockData.ts`

---

## Notes

- Keep using the existing `TaskCard` component - just render it inside `foreignObject`
- The `BatchCanvas` should be a pure function of its props - no internal state for layout
- Arrow highlighting should work: when hovering a task, highlight arrows to/from it
- Consider adding a small padding/margin inside the canvas for visual breathing room
