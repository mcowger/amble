import type { AgentSnapshot, ProjectItem, WorkspaceItem } from "../../lib/paseo/types";

export interface ActiveProjectWorktreeInfo {
  project: ProjectItem | null;
  projectName: string | null;
  isWorktree: boolean;
  worktreeLabel: string | null;
  worktreeWorkspace: WorkspaceItem | null;
  worktreeTooltip?: string;
  directWorkspace: WorkspaceItem | null;
}

function extractSlugFromWorktreePath(path?: string): string | null {
  if (!path) return null;
  // Patterns like .../paseo-worktrees/<hash>/<slug> or .../<project>-worktrees/<slug>
  const matchPaseo = path.match(/paseo-worktrees\/[^/]+\/([^/]+)/);
  if (matchPaseo?.[1]) return matchPaseo[1];

  const matchCustom = path.match(/-worktrees\/([^/]+)/);
  if (matchCustom?.[1]) return matchCustom[1];

  return null;
}

export function resolveActiveProjectWorktree({
  activeAgent,
  activeWorkspace,
  projects,
  workspaces,
}: {
  activeAgent: AgentSnapshot | null;
  activeWorkspace: WorkspaceItem | null;
  projects: ProjectItem[];
  workspaces: WorkspaceItem[];
}): ActiveProjectWorktreeInfo {
  // 1. Resolve Project
  let matchedProject: ProjectItem | null = null;

  // A. Try matching by projectId on activeWorkspace
  if (activeWorkspace?.projectId) {
    matchedProject =
      projects.find(
        (p) => p.id === activeWorkspace.projectId || p.projectKey === activeWorkspace.projectId,
      ) || null;
  }

  // B. Try matching by projectKey on activeWorkspace
  if (!matchedProject && activeWorkspace?.projectKey) {
    matchedProject =
      projects.find(
        (p) => p.projectKey === activeWorkspace.projectKey || p.id === activeWorkspace.projectKey,
      ) || null;
  }

  // C. Try matching by activeAgent projectKey
  if (!matchedProject && activeAgent?.project?.projectKey) {
    matchedProject =
      projects.find(
        (p) =>
          p.projectKey === activeAgent.project!.projectKey ||
          p.id === activeAgent.project!.projectKey,
      ) || null;
  }

  // D. Try matching by paths
  const candidatePaths = [
    activeAgent?.project?.checkout?.mainRepoRoot,
    activeWorkspace?.path,
    activeAgent?.cwd,
    activeAgent?.project?.checkout?.cwd,
  ].filter(Boolean) as string[];

  if (!matchedProject) {
    for (const p of projects) {
      if (!p.rootPath) continue;
      const rPath = p.rootPath.replace(/\/+$/, "");
      for (const cPath of candidatePaths) {
        const normCPath = cPath.replace(/\/+$/, "");
        if (normCPath === rPath || normCPath.startsWith(rPath + "/")) {
          matchedProject = p;
          break;
        }
      }
      if (matchedProject) break;
    }
  }

  // E. Fallback project name derivation if no explicit ProjectItem matched
  let derivedProjectName: string | null = matchedProject?.name || null;
  if (!derivedProjectName) {
    if (activeAgent?.project?.projectName) {
      derivedProjectName = activeAgent.project.projectName;
    } else if (activeWorkspace?.projectId) {
      // Look for a direct workspace with the same projectId to grab its name
      const siblingDirectWs = workspaces.find(
        (w) =>
          (w.workspaceKind === "local_checkout" || w.workspaceKind === "directory") &&
          (w.projectId === activeWorkspace.projectId ||
            (w.projectKey && w.projectKey === activeWorkspace.projectId)),
      );
      if (siblingDirectWs) {
        derivedProjectName = siblingDirectWs.name;
      }
    } else if (activeWorkspace?.projectKey) {
      const parts = activeWorkspace.projectKey.split("/");
      derivedProjectName = parts[parts.length - 1] || activeWorkspace.projectKey;
    } else if (activeWorkspace?.workspaceKind !== "worktree" && activeWorkspace?.name) {
      derivedProjectName = activeWorkspace.name;
    }
  }

  const project: ProjectItem | null =
    matchedProject ||
    (derivedProjectName
      ? {
          id: activeWorkspace?.projectId || activeAgent?.project?.projectKey || derivedProjectName,
          name: derivedProjectName,
          rootPath: activeAgent?.project?.checkout?.mainRepoRoot || "",
        }
      : null);

  const projectName = project?.name || null;

  // 2. Find Direct Workspace for this project (useful for navigation)
  const directWorkspace = project
    ? workspaces.find(
        (w) =>
          (w.workspaceKind === "local_checkout" ||
            w.workspaceKind === "directory" ||
            (project.rootPath && w.path === project.rootPath)) &&
          (w.projectId === project.id ||
            (project.projectKey && w.projectId === project.projectKey) ||
            (project.rootPath && w.path === project.rootPath)),
      ) || null
    : null;

  // 3. Determine if Worktree is Relevant
  const isWorktree = Boolean(
    activeWorkspace?.workspaceKind === "worktree" ||
      activeAgent?.project?.checkout?.isPaseoOwnedWorktree ||
      (activeWorkspace?.path &&
        (activeWorkspace.path.includes("-worktrees/") ||
          activeWorkspace.path.includes("/paseo-worktrees/"))) ||
      (activeAgent?.cwd &&
        (activeAgent.cwd.includes("-worktrees/") ||
          activeAgent.cwd.includes("/paseo-worktrees/"))) ||
      (activeAgent?.project?.checkout?.cwd &&
        (activeAgent.project.checkout.cwd.includes("-worktrees/") ||
          activeAgent.project.checkout.cwd.includes("/paseo-worktrees/"))),
  );

  if (!isWorktree) {
    return {
      project,
      projectName,
      isWorktree: false,
      worktreeLabel: null,
      worktreeWorkspace: null,
      worktreeTooltip: undefined,
      directWorkspace,
    };
  }

  // 4. Resolve Worktree details
  const worktreeWorkspace =
    (activeWorkspace?.workspaceKind === "worktree"
      ? activeWorkspace
      : workspaces.find(
          (w) =>
            w.id === activeAgent?.workspaceId &&
            (w.workspaceKind === "worktree" ||
              w.path.includes("-worktrees/") ||
              w.path.includes("/paseo-worktrees/")),
        )) || activeWorkspace;

  const pathSlug = extractSlugFromWorktreePath(
    worktreeWorkspace?.path || activeAgent?.cwd || activeAgent?.project?.checkout?.cwd,
  );

  const worktreeLabel =
    worktreeWorkspace?.branch ||
    worktreeWorkspace?.worktreeSlug ||
    activeAgent?.project?.checkout?.currentBranch ||
    pathSlug ||
    worktreeWorkspace?.title ||
    worktreeWorkspace?.name ||
    null;

  let worktreeTooltip: string | undefined;
  if (worktreeLabel) {
    const customTitle = worktreeWorkspace?.title?.trim();
    if (customTitle && customTitle !== worktreeLabel) {
      worktreeTooltip = `Worktree: ${worktreeLabel} (${customTitle})`;
    } else {
      worktreeTooltip = `Worktree: ${worktreeLabel}`;
    }
  }

  return {
    project,
    projectName,
    isWorktree: true,
    worktreeLabel,
    worktreeWorkspace,
    worktreeTooltip,
    directWorkspace,
  };
}
