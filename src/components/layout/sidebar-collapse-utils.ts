/**
 * Utilities for calculating and persisting sidebar project & worktree collapse state.
 */

export interface SessionLike {
  id: string;
}

export interface WorktreeLike {
  sessions?: SessionLike[];
}

/**
 * A project is considered empty if it has no direct sessions and no sessions in any of its worktrees.
 */
export function isProjectEmpty(
  directSessions: SessionLike[],
  worktrees: WorktreeLike[],
): boolean {
  const hasDirectSessions = directSessions.length > 0;
  const hasWorktreeSessions = worktrees.some((wt) => (wt.sessions?.length || 0) > 0);
  return !hasDirectSessions && !hasWorktreeSessions;
}

/**
 * Resolves whether a project is collapsed.
 * By default, empty projects are collapsed, while non-empty projects are expanded.
 * Explicit user overrides (persisted to localStorage) take precedence.
 */
export function resolveProjectCollapsed(
  projectId: string,
  overrides: Record<string, boolean>,
  isEmpty: boolean,
): boolean {
  if (overrides[projectId] !== undefined) {
    return overrides[projectId];
  }
  return isEmpty;
}

/**
 * Resolves whether a worktree is collapsed.
 * Worktrees without child sessions do not render collapse controls.
 * For worktrees with child sessions, worktrees are collapsed by default.
 * Explicit user overrides take precedence.
 */
export function resolveWorktreeCollapsed(
  worktreeKey: string,
  overrides: Record<string, boolean>,
  hasChildren: boolean,
): boolean {
  if (!hasChildren) {
    return false;
  }
  if (overrides[worktreeKey] !== undefined) {
    return overrides[worktreeKey];
  }
  return true;
}

/**
 * Safely parse stored collapse state from localStorage.
 * Supports backward compatibility with legacy array-of-strings format (where items in array were collapsed).
 */
export function parseStoredCollapseState(saved: string | null): Record<string, boolean> {
  if (!saved) return {};
  try {
    const parsed = JSON.parse(saved);
    if (Array.isArray(parsed)) {
      const map: Record<string, boolean> = {};
      for (const item of parsed) {
        if (typeof item === "string") {
          map[item] = true;
        }
      }
      return map;
    }
    if (parsed && typeof parsed === "object") {
      const map: Record<string, boolean> = {};
      for (const [k, v] of Object.entries(parsed)) {
        if (typeof v === "boolean") {
          map[k] = v;
        }
      }
      return map;
    }
  } catch {}
  return {};
}

/**
 * Toggles a collapse record given its current resolved state.
 */
export function toggleCollapseRecord(
  prev: Record<string, boolean>,
  key: string,
  isCurrentlyCollapsed: boolean,
): Record<string, boolean> {
  return {
    ...prev,
    [key]: !isCurrentlyCollapsed,
  };
}
