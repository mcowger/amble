import { describe, expect, test } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TodoItemsList, TodoBlock } from "./TodoBlock";
import type { TodoItem, TodoTimelineItem } from "../../lib/paseo/types";

describe("TodoItemsList", () => {
  const sampleItems: TodoItem[] = [
    { text: "Task 1 completed", completed: true, status: "completed" },
    { text: "Task 2 completed", completed: true, status: "completed" },
    { text: "Task 3 active", completed: false, status: "in_progress" },
    { text: "Task 4 pending", completed: false, status: "pending" },
  ];

  test("collapses completed tasks into expando by default", () => {
    const html = renderToStaticMarkup(<TodoItemsList items={sampleItems} />);
    expect(html).toContain("2 completed tasks");
    expect(html).toContain("Task 3 active");
    expect(html).toContain("Task 4 pending");
    // Completed tasks hidden when collapsed
    expect(html).not.toContain("Task 1 completed");
    expect(html).not.toContain("Task 2 completed");
  });

  test("renders completed tasks when defaultCompletedExpanded is true", () => {
    const html = renderToStaticMarkup(
      <TodoItemsList items={sampleItems} defaultCompletedExpanded={true} />
    );
    expect(html).toContain("2 completed tasks");
    expect(html).toContain("Task 1 completed");
    expect(html).toContain("Task 2 completed");
    expect(html).toContain("Task 3 active");
    expect(html).toContain("Task 4 pending");
  });

  test("does not show expando button when there are zero completed tasks", () => {
    const activeOnly: TodoItem[] = [
      { text: "Task A", completed: false, status: "in_progress" },
      { text: "Task B", completed: false, status: "pending" },
    ];
    const html = renderToStaticMarkup(<TodoItemsList items={activeOnly} />);
    expect(html).not.toContain("completed task");
    expect(html).toContain("Task A");
    expect(html).toContain("Task B");
  });

  test("handles all completed tasks with expando", () => {
    const allDone: TodoItem[] = [
      { text: "Done 1", completed: true, status: "completed" },
      { text: "Done 2", completed: true, status: "completed" },
      { text: "Done 3", completed: true, status: "completed" },
    ];
    const html = renderToStaticMarkup(<TodoItemsList items={allDone} />);
    expect(html).toContain("3 completed tasks");
    expect(html).not.toContain("Done 1");
  });

  test("renders all tasks flat when collapseCompleted is false", () => {
    const html = renderToStaticMarkup(
      <TodoItemsList items={sampleItems} collapseCompleted={false} />
    );
    expect(html).not.toContain("completed tasks");
    expect(html).toContain("Task 1 completed");
    expect(html).toContain("Task 2 completed");
    expect(html).toContain("Task 3 active");
    expect(html).toContain("Task 4 pending");
  });
});

describe("TodoBlock", () => {
  test("renders Tasks & Plan block with expando for completed tasks", () => {
    const item: TodoTimelineItem = {
      type: "todo",
      items: [
        { text: "Build feature", completed: true, status: "completed" },
        { text: "Test feature", completed: false, status: "in_progress" },
      ],
    };
    const html = renderToStaticMarkup(<TodoBlock item={item} />);
    expect(html).toContain("Tasks &amp; Plan");
    expect(html).toContain("1 completed task");
    expect(html).toContain("Test feature");
  });

  test("returns null for empty items", () => {
    const item: TodoTimelineItem = {
      type: "todo",
      items: [],
    };
    const html = renderToStaticMarkup(<TodoBlock item={item} />);
    expect(html).toBe("");
  });
});
