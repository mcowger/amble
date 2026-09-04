import { describe, expect, test } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { extractLatestTasks, SummaryTurnCard } from "./SummaryTurnCard";
import type { TodoTimelineItem, ToolCallTimelineItem } from "../../lib/paseo/types";

describe("extractLatestTasks", () => {
  test("returns empty array for undefined or empty todos", () => {
    expect(extractLatestTasks(undefined)).toEqual([]);
    expect(extractLatestTasks([])).toEqual([]);
  });

  test("returns tasks from a single todo item", () => {
    const todos: TodoTimelineItem[] = [
      {
        type: "todo",
        items: [
          { text: "Task 1", completed: false, status: "pending" },
          { text: "Task 2", completed: true, status: "completed" },
        ],
      },
    ];
    const tasks = extractLatestTasks(todos);
    expect(tasks).toHaveLength(2);
    expect(tasks[0]?.text).toBe("Task 1");
    expect(tasks[1]?.text).toBe("Task 2");
  });

  test("returns tasks from the latest non-empty todo item", () => {
    const todos: TodoTimelineItem[] = [
      {
        type: "todo",
        items: [{ text: "Old Task", completed: false, status: "pending" }],
      },
      {
        type: "todo",
        items: [
          { text: "New Task 1", completed: true, status: "completed" },
          { text: "New Task 2", completed: false, status: "in_progress" },
        ],
      },
    ];
    const tasks = extractLatestTasks(todos);
    expect(tasks).toHaveLength(2);
    expect(tasks[0]?.text).toBe("New Task 1");
    expect(tasks[1]?.text).toBe("New Task 2");
  });

  test("skips trailing empty items array to find earlier non-empty tasks", () => {
    const todos: TodoTimelineItem[] = [
      {
        type: "todo",
        items: [{ text: "Active Task", completed: false, status: "in_progress" }],
      },
      {
        type: "todo",
        items: [],
      },
    ];
    const tasks = extractLatestTasks(todos);
    expect(tasks).toHaveLength(1);
    expect(tasks[0]?.text).toBe("Active Task");
  });
});

describe("SummaryTurnCard with tasks", () => {
  test("renders tasks section above tool calls in the tools card", () => {
    const toolCalls: ToolCallTimelineItem[] = [
      {
        type: "tool_call",
        callId: "1",
        tool: "read",
        status: "completed",
      },
      {
        type: "tool_call",
        callId: "2",
        tool: "bash",
        status: "completed",
      },
    ];

    const todos: TodoTimelineItem[] = [
      {
        type: "todo",
        items: [
          { text: "Inspect codebase architecture", completed: true, status: "completed" },
          { text: "Implement new task summary layout", completed: false, status: "in_progress" },
          { text: "Verify with visual inspection", completed: false, status: "pending" },
        ],
      },
    ];

    const html = renderToStaticMarkup(
      <SummaryTurnCard
        toolCalls={toolCalls}
        reasonings={[]}
        todos={todos}
      />
    );

    // Verify Tasks & Plan appears
    expect(html).toContain("Tasks &amp; Plan");
    expect(html).toContain("1/3");
    // Crossed-off task is collapsed into expando by default
    expect(html).toContain("1 completed task");
    // Active and upcoming tasks are shown directly
    expect(html).toContain("Implement new task summary layout");
    expect(html).toContain("Verify with visual inspection");

    // Verify tool calls appear
    expect(html).toContain("read:");
    expect(html).toContain("bash:");
    expect(html).toContain("2 calls");

    // Verify tasks section appears before the tool calls in the DOM markup
    const tasksIndex = html.indexOf("Implement new task summary layout");
    const readToolIndex = html.indexOf("read:");
    expect(tasksIndex).toBeGreaterThan(-1);
    expect(readToolIndex).toBeGreaterThan(-1);
    expect(tasksIndex).toBeLessThan(readToolIndex);

    // Verify layout classes for matching height
    expect(html).toContain("items-stretch");
    expect(html).toContain("md:h-0 md:min-h-full");
    expect(html).toContain("min-h-0");
  });

  test("does not render tasks section when no tasks are provided", () => {
    const toolCalls: ToolCallTimelineItem[] = [
      {
        type: "tool_call",
        callId: "1",
        tool: "read",
        status: "completed",
      },
    ];

    const html = renderToStaticMarkup(
      <SummaryTurnCard
        toolCalls={toolCalls}
        reasonings={[]}
        todos={[]}
      />
    );

    expect(html).not.toContain("Tasks &amp; Plan");
    expect(html).toContain("read:");
    expect(html).toContain("1 call");
  });
});
