import type { AgentSnapshot, ProjectItem, WorkspaceItem } from "../../lib/paseo/types";

/**
 * Returns a stable unique key for identifying and ordering a project.
 */
export function getProjectKey(project: Pick<ProjectItem, "id" | "rootPath" | "name">): string {
  return project.id || project.rootPath || project.name || "";
}

/**
 * Safely parses stored project order array from localStorage.
 */
export function parseStoredProjectOrder(saved: string | null): string[] {
  if (!saved) return [];
  try {
    const parsed = JSON.parse(saved);
    if (Array.isArray(parsed)) {
      return parsed.filter(
        (item): item is string => typeof item === "string" && Boolean(item.trim()),
      );
    }
  } catch {}
  return [];
}

/**
 * Sorts an array of items with a `project` property based on a saved array of project keys.
 * Items present in `savedOrder` are placed first in their specified order.
 * Items not in `savedOrder` are appended afterwards, preserving their relative order.
 */
export function sortProjectsByOrder<T extends { project: ProjectItem }>(
  items: T[],
  savedOrder: string[],
): T[] {
  if (!items || items.length <= 1 || !savedOrder || savedOrder.length === 0) {
    return items;
  }

  const orderMap = new Map<string, number>();
  savedOrder.forEach((key, index) => {
    orderMap.set(key, index);
  });

  return [...items].sort((a, b) => {
    const keyA = getProjectKey(a.project);
    const keyB = getProjectKey(b.project);
    const indexA = orderMap.get(keyA);
    const indexB = orderMap.get(keyB);

    if (indexA !== undefined && indexB !== undefined) {
      return indexA - indexB;
    }
    if (indexA !== undefined) {
      return -1;
    }
    if (indexB !== undefined) {
      return 1;
    }
    return 0;
  });
}

/**
 * Reorders a list of project keys by moving sourceKey relative to targetKey.
 */
export function reorderProjectKeys(
  currentKeys: string[],
  sourceKey: string,
  targetKey: string,
  position: "above" | "below",
): string[] {
  if (!sourceKey || !targetKey || sourceKey === targetKey) {
    return currentKeys;
  }

  const listWithoutSource = currentKeys.filter((k) => k !== sourceKey);
  const targetIndex = listWithoutSource.indexOf(targetKey);

  if (targetIndex === -1) {
    return [...listWithoutSource, sourceKey];
  }

  const insertIndex = position === "above" ? targetIndex : targetIndex + 1;
  const result = [...listWithoutSource];
  result.splice(insertIndex, 0, sourceKey);
  return result;
}

/**
 * Returns the most recently active sessions up to `limit` (defaults to 3).
 * Evaluates `updatedAt` first, falling back to `createdAt`.
 */
export function getRecentSessions(agents: AgentSnapshot[], limit = 3): AgentSnapshot[] {
  if (!agents || !Array.isArray(agents)) return [];

  return [...agents]
    .sort((a, b) => {
      const timeA = a.updatedAt || a.createdAt;
      const timeB = b.updatedAt || b.createdAt;
      const msA = timeA ? Date.parse(timeA) : 0;
      const msB = timeB ? Date.parse(timeB) : 0;
      const safeA = Number.isNaN(msA) ? 0 : msA;
      const safeB = Number.isNaN(msB) ? 0 : msB;

      if (safeA !== safeB) {
        return safeB - safeA; // Descending (most recent first)
      }
      return (b.id || "").localeCompare(a.id || "");
    })
    .slice(0, limit);
}

/**
 * Derives a human-readable context badge/label (e.g. project name or project · branch)
 * for a session to disambiguate it in the 'Recent' list.
 */
export function getSessionContextLabel(
  session: AgentSnapshot,
  workspaces: WorkspaceItem[],
  projects: ProjectItem[],
): string {
  const ws = workspaces.find((w) => w.id === session.workspaceId);
  let projectName = "";
  let branchName = "";

  if (ws) {
    const proj = projects.find(
      (p) =>
        p.id === ws.projectId ||
        (p.projectKey && p.projectKey === ws.projectId) ||
        (p.rootPath && ws.path === p.rootPath),
    );
    projectName = proj?.name || ws.name || "";
    if (ws.workspaceKind === "worktree") {
      branchName = ws.branch || ws.worktreeSlug || ws.name || "";
    }
  } else if (session.project) {
    projectName = session.project.name || "";
  }

  if (projectName && branchName && projectName !== branchName) {
    return `${projectName} · ${branchName}`;
  }
  return projectName || branchName || "";
}
