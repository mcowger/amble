import { describe, it, expect } from "bun:test";
import {
  getProjectKey,
  parseStoredProjectOrder,
  sortProjectsByOrder,
  reorderProjectKeys,
  getRecentSessions,
  getSessionContextLabel,
} from "./sidebar-order-utils";
import type { AgentSnapshot, ProjectItem, WorkspaceItem } from "../../lib/paseo/types";

describe("sidebar-order-utils", () => {
  describe("getProjectKey", () => {
    it("returns project id if available", () => {
      expect(getProjectKey({ id: "proj-1", rootPath: "/path/to/proj", name: "Project 1" })).toBe(
        "proj-1",
      );
    });

    it("falls back to rootPath when id is empty", () => {
      expect(getProjectKey({ id: "", rootPath: "/path/to/proj", name: "Project 1" })).toBe(
        "/path/to/proj",
      );
    });

    it("falls back to name when id and rootPath are empty", () => {
      expect(getProjectKey({ id: "", rootPath: "", name: "Project 1" })).toBe("Project 1");
    });
  });

  describe("parseStoredProjectOrder", () => {
    it("returns empty array for null or empty string", () => {
      expect(parseStoredProjectOrder(null)).toEqual([]);
      expect(parseStoredProjectOrder("")).toEqual([]);
    });

    it("parses valid JSON array of strings", () => {
      const stored = JSON.stringify(["proj-b", "proj-a"]);
      expect(parseStoredProjectOrder(stored)).toEqual(["proj-b", "proj-a"]);
    });

    it("filters out empty or non-string items", () => {
      const stored = JSON.stringify(["proj-b", 123, null, "", "proj-a", "   "]);
      expect(parseStoredProjectOrder(stored)).toEqual(["proj-b", "proj-a"]);
    });

    it("gracefully handles invalid JSON", () => {
      expect(parseStoredProjectOrder("invalid-json{")).toEqual([]);
      expect(parseStoredProjectOrder('{"not":"an array"}')).toEqual([]);
    });
  });

  describe("sortProjectsByOrder", () => {
    const p1 = { project: { id: "p1", name: "Project 1", rootPath: "/p1" } };
    const p2 = { project: { id: "p2", name: "Project 2", rootPath: "/p2" } };
    const p3 = { project: { id: "p3", name: "Project 3", rootPath: "/p3" } };

    it("returns original items if savedOrder is empty", () => {
      expect(sortProjectsByOrder([p1, p2, p3], [])).toEqual([p1, p2, p3]);
    });

    it("sorts items matching savedOrder", () => {
      const sorted = sortProjectsByOrder([p1, p2, p3], ["p3", "p1", "p2"]);
      expect(sorted).toEqual([p3, p1, p2]);
    });

    it("appends items not in savedOrder to the end, preserving relative order", () => {
      const sorted = sortProjectsByOrder([p1, p2, p3], ["p2"]);
      expect(sorted).toEqual([p2, p1, p3]);
    });

    it("ignores extra keys in savedOrder that do not exist in items", () => {
      const sorted = sortProjectsByOrder([p1, p2], ["p-nonexistent", "p2", "p1"]);
      expect(sorted).toEqual([p2, p1]);
    });
  });

  describe("reorderProjectKeys", () => {
    const keys = ["A", "B", "C", "D"];

    it("returns unchanged list if source and target are the same", () => {
      expect(reorderProjectKeys(keys, "B", "B", "above")).toEqual(keys);
      expect(reorderProjectKeys(keys, "B", "B", "below")).toEqual(keys);
    });

    it("moves item above target", () => {
      // Move D above B -> [A, D, B, C]
      expect(reorderProjectKeys(keys, "D", "B", "above")).toEqual(["A", "D", "B", "C"]);
    });

    it("moves item below target", () => {
      // Move A below C -> [B, C, A, D]
      expect(reorderProjectKeys(keys, "A", "C", "below")).toEqual(["B", "C", "A", "D"]);
    });

    it("moves item to very top (above first item)", () => {
      // Move C above A -> [C, A, B, D]
      expect(reorderProjectKeys(keys, "C", "A", "above")).toEqual(["C", "A", "B", "D"]);
    });

    it("moves item to very bottom (below last item)", () => {
      // Move B below D -> [A, C, D, B]
      expect(reorderProjectKeys(keys, "B", "D", "below")).toEqual(["A", "C", "D", "B"]);
    });

    it("handles source not initially in keys list", () => {
      // Move new item X above B -> [A, X, B, C, D]
      expect(reorderProjectKeys(keys, "X", "B", "above")).toEqual(["A", "X", "B", "C", "D"]);
    });

    it("handles target not in keys list by appending source", () => {
      expect(reorderProjectKeys(keys, "A", "UNKNOWN", "above")).toEqual(["B", "C", "D", "A"]);
    });
  });

  describe("getRecentSessions", () => {
    it("returns empty array when agents list is empty or invalid", () => {
      expect(getRecentSessions([])).toEqual([]);
      expect(getRecentSessions(null as any)).toEqual([]);
    });

    it("sorts stably by ID when timestamps are equal", () => {
      const s1: AgentSnapshot = {
        id: "agent-a",
        status: "idle",
        createdAt: "2026-09-01T10:00:00.000Z",
      };
      const s2: AgentSnapshot = {
        id: "agent-b",
        status: "idle",
        createdAt: "2026-09-01T10:00:00.000Z",
      };
      const result = getRecentSessions([s1, s2], 2);
      expect(result[0].id).toBe("agent-b");
      expect(result[1].id).toBe("agent-a");
    });

    it("handles invalid or unparseable timestamps gracefully", () => {
      const s1: AgentSnapshot = {
        id: "s1",
        status: "idle",
        createdAt: "not-a-valid-date",
      };
      const s2: AgentSnapshot = {
        id: "s2",
        status: "idle",
        createdAt: "2026-09-01T10:00:00.000Z",
      };
      const result = getRecentSessions([s1, s2], 2);
      expect(result[0].id).toBe("s2");
      expect(result[1].id).toBe("s1");
    });

    it("returns top 3 sessions sorted by most recent activity", () => {
      const s1: AgentSnapshot = {
        id: "s1",
        status: "idle",
        createdAt: "2026-09-01T10:00:00.000Z",
        updatedAt: "2026-09-01T10:30:00.000Z",
      };
      const s2: AgentSnapshot = {
        id: "s2",
        status: "idle",
        createdAt: "2026-09-01T09:00:00.000Z",
        updatedAt: "2026-09-01T11:00:00.000Z", // Newest
      };
      const s3: AgentSnapshot = {
        id: "s3",
        status: "idle",
        createdAt: "2026-09-01T10:15:00.000Z", // No updatedAt, use createdAt
      };
      const s4: AgentSnapshot = {
        id: "s4",
        status: "idle",
        createdAt: "2026-09-01T08:00:00.000Z",
        updatedAt: "2026-09-01T08:30:00.000Z", // Oldest
      };

      const result = getRecentSessions([s1, s2, s3, s4], 3);
      expect(result.length).toBe(3);
      // Expected order: s2 (11:00), s1 (10:30), s3 (10:15)
      expect(result[0].id).toBe("s2");
      expect(result[1].id).toBe("s1");
      expect(result[2].id).toBe("s3");
    });

    it("respects custom limit", () => {
      const s1: AgentSnapshot = { id: "s1", status: "idle", createdAt: "2026-09-01T10:00:00.000Z" };
      const s2: AgentSnapshot = { id: "s2", status: "idle", createdAt: "2026-09-01T11:00:00.000Z" };

      expect(getRecentSessions([s1, s2], 1).length).toBe(1);
      expect(getRecentSessions([s1, s2], 1)[0].id).toBe("s2");
    });

    it("returns all sessions if fewer than 3 exist", () => {
      const s1: AgentSnapshot = { id: "s1", status: "idle", createdAt: "2026-09-01T10:00:00.000Z" };
      const result = getRecentSessions([s1], 3);
      expect(result.length).toBe(1);
      expect(result[0].id).toBe("s1");
    });
  });

  describe("getSessionContextLabel", () => {
    const projects: ProjectItem[] = [
      { id: "p-amble", name: "Amble", rootPath: "/repos/amble" },
      { id: "p-docs", name: "Docs", rootPath: "/repos/docs" },
    ];

    const workspaces: WorkspaceItem[] = [
      {
        id: "ws-main",
        name: "Amble Main",
        path: "/repos/amble",
        projectId: "p-amble",
        workspaceKind: "local_checkout",
      },
      {
        id: "ws-wt-feat",
        name: "amble-feat",
        path: "/repos/amble-worktrees/feat",
        projectId: "p-amble",
        workspaceKind: "worktree",
        branch: "feat/sidebar",
      },
    ];

    it("returns project name for regular workspace", () => {
      const session: AgentSnapshot = {
        id: "s1",
        workspaceId: "ws-main",
        status: "idle",
      };
      expect(getSessionContextLabel(session, workspaces, projects)).toBe("Amble");
    });

    it("returns 'Project · branch' for worktree workspace", () => {
      const session: AgentSnapshot = {
        id: "s2",
        workspaceId: "ws-wt-feat",
        status: "idle",
      };
      expect(getSessionContextLabel(session, workspaces, projects)).toBe("Amble · feat/sidebar");
    });

    it("falls back to session.project when workspace is not found", () => {
      const session: AgentSnapshot = {
        id: "s3",
        status: "idle",
        project: { id: "p-direct", name: "DirectProj", rootPath: "/direct" },
      };
      expect(getSessionContextLabel(session, workspaces, projects)).toBe("DirectProj");
    });

    it("returns empty string when no workspace or project info is available", () => {
      const session: AgentSnapshot = {
        id: "s4",
        status: "idle",
      };
      expect(getSessionContextLabel(session, workspaces, projects)).toBe("");
    });
  });
});
