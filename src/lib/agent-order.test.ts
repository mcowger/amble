import { describe, expect, test } from "bun:test";
import { compareAgentSnapshotsByCreation } from "./agent-order";

describe("compareAgentSnapshotsByCreation", () => {
  test("sorts agents by creation time ascending (oldest first)", () => {
    const agent1 = { id: "agent-1", createdAt: "2026-09-01T10:00:00.000Z" };
    const agent2 = { id: "agent-2", createdAt: "2026-09-01T10:05:00.000Z" };
    const agent3 = { id: "agent-3", createdAt: "2026-09-01T10:10:00.000Z" };

    const list = [agent3, agent1, agent2];
    list.sort(compareAgentSnapshotsByCreation);

    expect(list.map((a) => a.id)).toEqual(["agent-1", "agent-2", "agent-3"]);
  });

  test("does not change tab order when an agent has recent activity (different updatedAt)", () => {
    const agent1 = {
      id: "agent-1",
      createdAt: "2026-09-01T10:00:00.000Z",
      updatedAt: "2026-09-01T10:30:00.000Z",
    };
    const agent2 = {
      id: "agent-2",
      createdAt: "2026-09-01T10:05:00.000Z",
      updatedAt: "2026-09-01T10:05:00.000Z",
    };

    const daemonOrder = [agent1, agent2];
    daemonOrder.sort(compareAgentSnapshotsByCreation);

    expect(daemonOrder.map((a) => a.id)).toEqual(["agent-1", "agent-2"]);

    const otherOrder = [agent2, agent1];
    otherOrder.sort(compareAgentSnapshotsByCreation);

    expect(otherOrder.map((a) => a.id)).toEqual(["agent-1", "agent-2"]);
  });

  test("places newly created agents at the end of the tabs list", () => {
    const agent1 = { id: "agent-1", createdAt: "2026-09-01T10:00:00.000Z" };
    const agent2 = { id: "agent-2", createdAt: "2026-09-01T10:05:00.000Z" };
    const agentNew = { id: "agent-new", createdAt: "2026-09-01T10:15:00.000Z" };

    const currentTabs = [agent1, agent2];
    const updatedTabs = [...currentTabs, agentNew];
    updatedTabs.sort(compareAgentSnapshotsByCreation);

    expect(updatedTabs.map((a) => a.id)).toEqual(["agent-1", "agent-2", "agent-new"]);
  });

  test("uses deterministic ID comparison when createdAt timestamps are identical", () => {
    const agentA = { id: "agent-alpha", createdAt: "2026-09-01T10:00:00.000Z" };
    const agentB = { id: "agent-beta", createdAt: "2026-09-01T10:00:00.000Z" };

    const list = [agentB, agentA];
    list.sort(compareAgentSnapshotsByCreation);

    expect(list.map((a) => a.id)).toEqual(["agent-alpha", "agent-beta"]);
  });

  test("handles missing or invalid createdAt gracefully", () => {
    const agentNoDate = { id: "agent-nodate" };
    const agentValid = { id: "agent-valid", createdAt: "2026-09-01T10:00:00.000Z" };

    const list = [agentValid, agentNoDate];
    list.sort(compareAgentSnapshotsByCreation);

    expect(list.map((a) => a.id)).toEqual(["agent-nodate", "agent-valid"]);
  });
});
