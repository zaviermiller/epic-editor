/**
 * Mock Data for Testing
 *
 * Provides a complete mock Epic with batches, tasks, and dependencies
 * for testing the visualizer without requiring GitHub API access.
 */

import { Epic, Batch, Task, Dependency, IssueStatus } from "@/types";
import { resolveBlockedStatuses } from "./github";

/**
 * Create a mock task
 * Note: "ready" status will be resolved to "ready" or "blocked" by resolveBlockedStatuses()
 */
function createMockTask(
  number: number,
  title: string,
  status: IssueStatus,
  dependsOn: number[] = [],
): Task {
  return {
    id: number * 1000, // Mock ID based on number
    number,
    title,
    body: `This is the body of task #${number}`,
    status,
    url: `https://github.com/example/repo/issues/${number}`,
    labels: [{ id: number, name: status, color: "blue", description: "" }],
    assignees: [
      {
        id: 1,
        login: "developer1",
        avatar_url: "https://avatars.githubusercontent.com/u/1?v=4",
        html_url: "https://github.com/developer1",
      },
    ],
    dependsOn,
    blockedBy: [],
  };
}

/**
 * Create a mock batch
 */
function createMockBatch(
  number: number,
  title: string,
  tasks: Task[],
  dependsOn: number[] = [],
): Batch {
  const completedTasks = tasks.filter((t) => t.status === "done").length;
  const progress =
    tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0;

  return {
    id: number * 1000, // Mock ID based on number
    number,
    title,
    body: `This is the body of batch #${number}`,
    // Initial status - will be resolved by resolveBlockedStatuses()
    status:
      progress === 100 ? "done" : progress > 0 ? "in-progress" : "ready",
    url: `https://github.com/example/repo/issues/${number}`,
    labels: [{ id: number, name: "batch", color: "purple", description: "" }],
    assignees: [
      {
        id: 1,
        login: "developer1",
        avatar_url: "https://avatars.githubusercontent.com/u/1?v=4",
        html_url: "https://github.com/developer1",
      },
    ],
    tasks,
    dependsOn,
    progress,
  };
}

/**
 * Mock Epic data matching the reference image structure
 */
export const mockEpic: Epic = {
  id: 8833000, // Mock ID based on number
  number: 8833,
  title: "Remove friction from metered product launch",
  body: "Epic to track all work for removing friction from metered product launch",
  status: "in-progress",
  url: "https://github.com/example/repo/issues/8833",
  labels: [{ id: 1, name: "epic", color: "orange", description: "" }],
  assignees: [
    {
      id: 1,
      login: "lead-dev",
      avatar_url: "https://avatars.githubusercontent.com/u/1?v=4",
      html_url: "https://github.com/lead-dev",
    },
    {
      id: 2,
      login: "pm",
      avatar_url: "https://avatars.githubusercontent.com/u/2?v=4",
      html_url: "https://github.com/pm",
    },
  ],
  owner: "example",
  repo: "repo",
  batches: [
    // Batch 1: Simplify metered usage interface
    createMockBatch(
      9090,
      "Simplify metered usage interface",
      [
        createMockTask(9101, "create_m →widget.m subsc...", "done"),
        createMockTask(9102, "Remove debit_memo_ite...", "in-progress", [9101]),
        createMockTask(9103, "getUsageSubscr iptio...", "done"),
        createMockTask(9104, "github_owner_id →meterit...", "done"),
        createMockTask(9105, "github_subscriptio n_s...", "in-progress"),
        createMockTask(9106, "Remove InvoiceInvoicec...", "ready", [9105]),
        createMockTask(9107, "Remove metered...", "in-progress"),
        createMockTask(9108, "github_owner_id Migrate", "ready", [9107]),
        createMockTask(9109, "Extract sub-issue", "done"),
      ],
      [],
    ),

    // Batch 2: Simplify Zuora sales and self serve rate plan
    createMockBatch(
      9287,
      "Simplify Zuora sales and self serve rate plan modeling in Meuse",
      [
        createMockTask(9201, "Add salesforce_a cc...", "in-progress"),
        createMockTask(9202, "create_zuora _s...", "in-progress", [9201]),
        createMockTask(9203, "Zuora finance", "done"),
        createMockTask(9204, "Add subscription ID...", "in-progress", [9203]),
        createMockTask(9205, "Create link Cust...", "ready"),
        createMockTask(9206, "Copy old data", "ready", [9205]),
        createMockTask(9207, "Stop old data", "ready", [9206]),
      ],
      [9090],
    ),

    // Batch 3: Unit of measure catalog
    createMockBatch(
      9321,
      "Unit of measure catalog in Meuse stafftools UI",
      [
        createMockTask(9301, "Add or remove th...", "in-progress"),
        createMockTask(9302, "Unit catals et...", "in-progress", [9301]),
      ],
      [],
    ),

    // Batch 4: Embellishments and fixes
    createMockBatch(
      9400,
      "Embellishments and fixes",
      [
        createMockTask(9401, "Remove print...", "ready"),
        createMockTask(9402, "table of retired sku...", "in-progress"),
        createMockTask(9403, "Delete billing entit...", "ready", [9402]),
        createMockTask(9404, "Stores Core sku's...", "done"),
        createMockTask(9405, "To missing environment...", "done"),
        createMockTask(9406, "Impacted attributes #9...", "in-progress"),
        createMockTask(9407, "Difference environmen...", "ready", [9406]),
      ],
      [9321],
    ),

    // Batch 5: Finish meter_uuid
    createMockBatch(
      9324,
      "Finish the meter_uuid → product name + sku migration",
      [
        createMockTask(
          9501,
          "Add remove. data and product sku ...",
          "in-progress",
        ),
        createMockTask(
          9502,
          "verify all mapping sku...",
          "in-progress",
          [9501],
        ),
        createMockTask(9503, "Update meter_uuid to sk...", "in-progress"),
        createMockTask(9504, "Add metered_emit_m...", "ready", [9503]),
        createMockTask(9505, "consume metered_emi...", "done"),
        createMockTask(9506, "Remove meter_uuid in...", "ready", [9505]),
        createMockTask(9507, "emit_emi metered_emi...", "ready"),
        createMockTask(9508, "Allow_1 metered emi...", "done"),
        createMockTask(9509, "Remove metered...", "done"),
        createMockTask(9510, "meter_uuid deprecated from APIs", "done"),
      ],
      [],
    ),

    // Batch 6: Create products in Meuse stafftools UI
    createMockBatch(
      9322,
      "Create products in Meuse stafftools UI",
      [
        createMockTask(9601, "Add creation page is s...", "in-progress"),
        createMockTask(9602, "Add Tweet class_9 of Pr...", "done"),
        createMockTask(
          9603,
          "create_button at val onl...",
          "in-progress",
          [9602],
        ),
        createMockTask(9604, "Revise private_butto at...", "ready"),
      ],
      [9324],
    ),

    // Batch 7: Create Meuse → Dotcom product sync
    createMockBatch(
      9323,
      "Create Meuse → Dotcom product sync",
      [
        createMockTask(9701, "Add a consumer event is...", "in-progress"),
        createMockTask(
          9702,
          "Combine user sku exist...",
          "in-progress",
          [9701],
        ),
        createMockTask(
          9703,
          "Add MeuseProductSyncMiddle...",
          "ready",
          [9702],
        ),
        createMockTask(9704, "Add EventPublisher...", "ready"),
        createMockTask(9705, "Meuse get to data...", "ready", [9703, 9704]),
        createMockTask(9706, "Add DotcomEvent ps...", "done"),
        createMockTask(
          9707,
          "Issue a cleanup old create by...",
          "ready",
          [9706],
        ),
      ],
      [9322],
    ),
  ],
  progress: 35,
  dependencies: [],
};

// Build the dependencies array from the batches and tasks
const allDependencies: Dependency[] = [];

// Add batch-level dependencies
for (const batch of mockEpic.batches) {
  for (const depNum of batch.dependsOn) {
    allDependencies.push({
      from: batch.number,
      to: depNum,
      type: "depends-on",
    });
  }

  // Add task-level dependencies
  for (const task of batch.tasks) {
    for (const depNum of task.dependsOn) {
      allDependencies.push({
        from: task.number,
        to: depNum,
        type: "depends-on",
      });
    }
  }
}

mockEpic.dependencies = allDependencies;

// Resolve blocked statuses based on dependency chain
const resolvedMockEpic = resolveBlockedStatuses(mockEpic);

/**
 * Get the mock epic for testing
 */
export function getMockEpic(): Epic {
  return resolvedMockEpic;
}
