import { describe, it, expect } from "bun:test";
import {
  isProjectEmpty,
  resolveProjectCollapsed,
  resolveWorktreeCollapsed,
  parseStoredCollapseState,
  toggleCollapseRecord,
} from "./sidebar-collapse-utils";

describe("sidebar-collapse-utils", () => {
  describe("isProjectEmpty", () => {
    it("returns true when project has no direct sessions and no worktrees", () => {
      expect(isProjectEmpty([], [])).toBe(true);
    });

    it("returns true when project has no direct sessions and worktrees with 0 sessions", () => {
      expect(
        isProjectEmpty([], [{ sessions: [] }, { sessions: [] }]),
      ).toBe(true);
    });

    it("returns false when project has direct sessions", () => {
      expect(
        isProjectEmpty([{ id: "s1" }], []),
      ).toBe(false);
    });

    it("returns false when project has worktree with sessions", () => {
      expect(
        isProjectEmpty([], [{ sessions: [{ id: "s1" }] }]),
      ).toBe(false);
    });

    it("returns false when project has both direct sessions and worktree sessions", () => {
      expect(
        isProjectEmpty([{ id: "s1" }], [{ sessions: [{ id: "s2" }] }]),
      ).toBe(false);
    });
  });

  describe("resolveProjectCollapsed", () => {
    it("defaults to collapsed (true) when project is empty and no override exists", () => {
      expect(resolveProjectCollapsed("p-empty", {}, true)).toBe(true);
    });

    it("defaults to expanded (false) when project is non-empty and no override exists", () => {
      expect(resolveProjectCollapsed("p-active", {}, false)).toBe(false);
    });

    it("respects override to expand an empty project", () => {
      const overrides = { "p-empty": false };
      expect(resolveProjectCollapsed("p-empty", overrides, true)).toBe(false);
    });

    it("respects override to collapse a non-empty project", () => {
      const overrides = { "p-active": true };
      expect(resolveProjectCollapsed("p-active", overrides, false)).toBe(true);
    });
  });

  describe("resolveWorktreeCollapsed", () => {
    it("returns false when worktree has no child sessions", () => {
      expect(resolveWorktreeCollapsed("p:main", {}, false)).toBe(false);
    });

    it("defaults to collapsed (true) when worktree has sessions and no override exists", () => {
      expect(resolveWorktreeCollapsed("p:feat", {}, true)).toBe(true);
    });

    it("respects override to expand a worktree with sessions", () => {
      const overrides = { "p:feat": false };
      expect(resolveWorktreeCollapsed("p:feat", overrides, true)).toBe(false);
    });

    it("respects override to collapse a worktree with sessions", () => {
      const overrides = { "p:feat": true };
      expect(resolveWorktreeCollapsed("p:feat", overrides, true)).toBe(true);
    });
  });

  describe("parseStoredCollapseState", () => {
    it("returns empty object for null or empty input", () => {
      expect(parseStoredCollapseState(null)).toEqual({});
      expect(parseStoredCollapseState("")).toEqual({});
    });

    it("migrates legacy string array format to boolean record", () => {
      const legacy = JSON.stringify(["p1", "p2"]);
      expect(parseStoredCollapseState(legacy)).toEqual({
        p1: true,
        p2: true,
      });
    });

    it("parses modern boolean map format", () => {
      const modern = JSON.stringify({ p1: true, p2: false });
      expect(parseStoredCollapseState(modern)).toEqual({
        p1: true,
        p2: false,
      });
    });

    it("gracefully handles invalid JSON", () => {
      expect(parseStoredCollapseState("invalid-json{")).toEqual({});
    });
  });

  describe("toggleCollapseRecord", () => {
    it("flips currently collapsed item to expanded", () => {
      const prev = {};
      const next = toggleCollapseRecord(prev, "item-1", true);
      expect(next).toEqual({ "item-1": false });
    });

    it("flips currently expanded item to collapsed", () => {
      const prev = {};
      const next = toggleCollapseRecord(prev, "item-1", false);
      expect(next).toEqual({ "item-1": true });
    });

    it("preserves other entries in the record", () => {
      const prev = { "other-1": false, "other-2": true };
      const next = toggleCollapseRecord(prev, "other-1", false);
      expect(next).toEqual({ "other-1": true, "other-2": true });
    });
  });
});
