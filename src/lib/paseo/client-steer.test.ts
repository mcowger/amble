import { describe, expect, test, mock } from "bun:test";
import { PaseoClient } from "./client";

describe("PaseoClient activeTurnBehavior", () => {
  test("forwards activeTurnBehavior: 'steer' to daemon", async () => {
    const client = new PaseoClient({ url: "ws://127.0.0.1:9999/ws" });
    const sendAgentMessageMock = mock(async (_agentId: string, _text: string, _options?: any) => {});
    (client as any).daemon.sendAgentMessage = sendAgentMessageMock;
    (client as any).setAgentTimelineSubscription = mock(async () => {});

    await client.sendAgentMessage({
      agentId: "agent-123",
      text: "Please focus on auth module first",
      activeTurnBehavior: "steer",
    });

    expect(sendAgentMessageMock).toHaveBeenCalledTimes(1);
    const args = sendAgentMessageMock.mock.calls[0]!;
    expect(args[0]).toBe("agent-123");
    expect(args[1]).toBe("Please focus on auth module first");
    expect(args[2]).toMatchObject({
      activeTurnBehavior: "steer",
    });
  });

  test("forwards activeTurnBehavior: 'interrupt' to daemon", async () => {
    const client = new PaseoClient({ url: "ws://127.0.0.1:9999/ws" });
    const sendAgentMessageMock = mock(async (_agentId: string, _text: string, _options?: any) => {});
    (client as any).daemon.sendAgentMessage = sendAgentMessageMock;
    (client as any).setAgentTimelineSubscription = mock(async () => {});

    await client.sendAgentMessage({
      agentId: "agent-123",
      text: "Cancel that, do this instead",
      activeTurnBehavior: "interrupt",
    });

    expect(sendAgentMessageMock).toHaveBeenCalledTimes(1);
    const args = sendAgentMessageMock.mock.calls[0]!;
    expect(args[0]).toBe("agent-123");
    expect(args[1]).toBe("Cancel that, do this instead");
    expect(args[2]).toMatchObject({
      activeTurnBehavior: "interrupt",
    });
  });

  test("handles activeTurnBehavior: 'followup' by waiting for finish then sending without activeTurnBehavior", async () => {
    const client = new PaseoClient({ url: "ws://127.0.0.1:9999/ws" });
    const sendAgentMessageMock = mock(async (_agentId: string, _text: string, _options?: any) => {});
    const waitForFinishMock = mock(async (_agentId: string) => ({ status: "completed" }));
    (client as any).daemon.sendAgentMessage = sendAgentMessageMock;
    (client as any).daemon.waitForFinish = waitForFinishMock;
    (client as any).setAgentTimelineSubscription = mock(async () => {});

    await client.sendAgentMessage({
      agentId: "agent-123",
      text: "Run tests after you finish",
      activeTurnBehavior: "followup",
    });

    expect(waitForFinishMock).toHaveBeenCalledTimes(1);
    expect(waitForFinishMock.mock.calls[0]![0]).toBe("agent-123");
    expect(sendAgentMessageMock).toHaveBeenCalledTimes(1);
    const args = sendAgentMessageMock.mock.calls[0]!;
    expect(args[0]).toBe("agent-123");
    expect(args[1]).toBe("Run tests after you finish");
    expect(args[2]?.activeTurnBehavior).toBeUndefined();
  });

  test("handles undefined activeTurnBehavior", async () => {
    const client = new PaseoClient({ url: "ws://127.0.0.1:9999/ws" });
    const sendAgentMessageMock = mock(async (_agentId: string, _text: string, _options?: any) => {});
    (client as any).daemon.sendAgentMessage = sendAgentMessageMock;
    (client as any).setAgentTimelineSubscription = mock(async () => {});

    await client.sendAgentMessage({
      agentId: "agent-123",
      text: "Normal message",
    });

    expect(sendAgentMessageMock).toHaveBeenCalledTimes(1);
    const args = sendAgentMessageMock.mock.calls[0]!;
    expect(args[0]).toBe("agent-123");
    expect(args[1]).toBe("Normal message");
    expect(args[2]?.activeTurnBehavior).toBeUndefined();
  });
});
