import { describe, expect, test } from "bun:test";
import { appendReasoningTimelineItem } from "./timeline";

describe("appendReasoningTimelineItem", () => {
  test("continues a hydrated reasoning item from the same turn", () => {
    const timeline = [
      {
        type: "reasoning" as const,
        text: "Mapping project ",
        turnId: "turn-1",
        isStreaming: false,
      },
    ];

    const next = appendReasoningTimelineItem(
      timeline,
      { type: "reasoning", text: "IDs to workspaces" },
      "turn-1",
      100,
    );

    expect(next).toHaveLength(1);
    expect(next[0]).toMatchObject({
      type: "reasoning",
      text: "Mapping project IDs to workspaces",
      turnId: "turn-1",
      isStreaming: true,
    });
  });

  test("keeps reasoning from a different turn in a separate item", () => {
    const timeline = [
      {
        type: "reasoning" as const,
        text: "Previous thought",
        turnId: "turn-1",
        isStreaming: false,
      },
    ];

    const next = appendReasoningTimelineItem(
      timeline,
      { type: "reasoning", text: "New thought" },
      "turn-2",
      100,
    );

    expect(next).toHaveLength(2);
    expect(next[1]).toMatchObject({
      type: "reasoning",
      text: "New thought",
      turnId: "turn-2",
      isStreaming: true,
    });
  });

  test("does not append a different turn to an active thought", () => {
    const timeline = [
      {
        type: "reasoning" as const,
        text: "Previous thought",
        turnId: "turn-1",
        isStreaming: true,
      },
    ];

    const next = appendReasoningTimelineItem(
      timeline,
      { type: "reasoning", text: "New thought" },
      "turn-2",
      100,
    );

    expect(next).toHaveLength(2);
    expect(next[0]).toMatchObject({
      text: "Previous thought",
      turnId: "turn-1",
      isStreaming: false,
    });
  });

  test("starts a new thought when a completed item has no turn id", () => {
    const timeline = [
      {
        type: "reasoning" as const,
        text: "Mapping project ",
        isStreaming: false,
      },
    ];

    const next = appendReasoningTimelineItem(
      timeline,
      { type: "reasoning", text: "IDs to workspaces" },
      undefined,
      100,
    );

    expect(next).toHaveLength(2);
    expect(next[0]).toMatchObject({
      text: "Mapping project ",
      isStreaming: false,
    });
    expect(next[1]).toMatchObject({
      text: "IDs to workspaces",
      isStreaming: true,
    });
  });

  test("continues an already streaming item without a turn id", () => {
    const timeline = [
      {
        type: "reasoning" as const,
        text: "Planning",
        isStreaming: true,
        startedAt: 50,
      },
    ];

    const next = appendReasoningTimelineItem(
      timeline,
      { type: "reasoning", text: " the fix" },
      undefined,
      100,
    );

    expect(next).toHaveLength(1);
    expect(next[0]).toMatchObject({
      text: "Planning the fix",
      isStreaming: true,
      startedAt: 50,
    });
  });
});
