import type { ProjectItem, WorkspaceItem } from "./paseo/types";

export interface WorkspaceTarget {
  workspaceId: string | null;
  cwd: string | null;
  needsProjectOpen: boolean;
}

export function isTemporaryWorkspace(workspace: WorkspaceItem): boolean {
  const name = workspace.name.trim().toLowerCase();
  const path = workspace.path.trim().toLowerCase().replace(/\/+$/, "");
  const id = workspace.id.toLowerCase();
  return name === "tmp" || path.endsWith("/tmp") || id.includes("tmp");
}

export function chooseDefaultWorkspace(workspaces: WorkspaceItem[]): WorkspaceItem | null {
  return workspaces.find((workspace) => !isTemporaryWorkspace(workspace)) || workspaces[0] || null;
}

function belongsToProject(workspace: WorkspaceItem, project: ProjectItem): boolean {
  return (
    workspace.projectId === project.id ||
    (!!project.projectKey && workspace.projectId === project.projectKey) ||
    (!!project.rootPath && workspace.path === project.rootPath)
  );
}

function isDirectWorkspace(workspace: WorkspaceItem, project: ProjectItem): boolean {
  return (
    belongsToProject(workspace, project) &&
    (workspace.workspaceKind === "local_checkout" ||
      workspace.workspaceKind === "directory" ||
      workspace.path === project.rootPath)
  );
}

export function resolveWorkspaceTarget({
  requestedWorkspaceId,
  activeWorkspaceId,
  workspaces,
  projects,
}: {
  requestedWorkspaceId?: string;
  activeWorkspaceId?: string | null;
  workspaces: WorkspaceItem[];
  projects: ProjectItem[];
}): WorkspaceTarget {
  const requestedId = requestedWorkspaceId || activeWorkspaceId || null;

  if (requestedId) {
    const workspace = workspaces.find((item) => item.id === requestedId);
    if (workspace) {
      return {
        workspaceId: workspace.id,
        cwd: workspace.path || null,
        needsProjectOpen: false,
      };
    }

    const project = projects.find(
      (item) => item.id === requestedId || item.projectKey === requestedId,
    );
    if (project) {
      const directWorkspace = workspaces.find((item) => isDirectWorkspace(item, project));
      if (directWorkspace) {
        return {
          workspaceId: directWorkspace.id,
          cwd: directWorkspace.path || project.rootPath || null,
          needsProjectOpen: false,
        };
      }
      return {
        workspaceId: null,
        cwd: project.rootPath || null,
        needsProjectOpen: true,
      };
    }

    return { workspaceId: null, cwd: null, needsProjectOpen: false };
  }

  const workspace = chooseDefaultWorkspace(workspaces);
  return workspace
    ? { workspaceId: workspace.id, cwd: workspace.path || null, needsProjectOpen: false }
    : { workspaceId: null, cwd: null, needsProjectOpen: false };
}
