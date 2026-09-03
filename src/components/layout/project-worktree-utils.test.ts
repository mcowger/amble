import { describe, expect, it } from "bun:test";
import { resolveActiveProjectWorktree } from "./project-worktree-utils";
import type { AgentSnapshot, ProjectItem, WorkspaceItem } from "../../lib/paseo/types";

describe("resolveActiveProjectWorktree", () => {
  const sampleProject: ProjectItem = {
    id: "prj_amble",
    name: "amble",
    rootPath: "/home/user/workspace/amble",
  };

  const directWorkspace: WorkspaceItem = {
    id: "wks_main",
    projectId: "prj_amble",
    name: "main",
    path: "/home/user/workspace/amble",
    workspaceKind: "local_checkout",
    branch: "main",
  };

  const worktreeWorkspace: WorkspaceItem = {
    id: "wks_feat",
    projectId: "prj_amble",
    name: "Implement ProjectHeader component",
    title: "Implement ProjectHeader component",
    path: "/home/user/workspace/paseo-worktrees/2n4cmcbe/projectheader",
    workspaceKind: "worktree",
    branch: "implement-projectheader",
    worktreeSlug: "projectheader",
  };

  it("resolves project and worktree when active workspace is a worktree", () => {
    const activeAgent: Partial<AgentSnapshot> = {
      id: "agent-1",
      workspaceId: "wks_feat",
      title: "Add head entry in Top rail",
    };

    const result = resolveActiveProjectWorktree({
      activeAgent: activeAgent as AgentSnapshot,
      activeWorkspace: worktreeWorkspace,
      projects: [sampleProject],
      workspaces: [directWorkspace, worktreeWorkspace],
    });

    expect(result.project).toBeDefined();
    expect(result.projectName).toBe("amble");
    expect(result.isWorktree).toBe(true);
    expect(result.worktreeLabel).toBe("implement-projectheader");
    expect(result.worktreeTooltip).toBe(
      "Worktree: implement-projectheader (Implement ProjectHeader component)",
    );
    expect(result.directWorkspace?.id).toBe("wks_main");
    expect(result.worktreeWorkspace?.id).toBe("wks_feat");
  });

  it("resolves project without worktree when workspace is local_checkout", () => {
    const activeAgent: Partial<AgentSnapshot> = {
      id: "agent-2",
      workspaceId: "wks_main",
      title: "Fix bug in main",
    };

    const result = resolveActiveProjectWorktree({
      activeAgent: activeAgent as AgentSnapshot,
      activeWorkspace: directWorkspace,
      projects: [sampleProject],
      workspaces: [directWorkspace, worktreeWorkspace],
    });

    expect(result.projectName).toBe("amble");
    expect(result.isWorktree).toBe(false);
    expect(result.worktreeLabel).toBeNull();
    expect(result.worktreeTooltip).toBeUndefined();
    expect(result.directWorkspace?.id).toBe("wks_main");
  });

  it("detects worktree from agent isPaseoOwnedWorktree flag even if workspaceKind missing", () => {
    const agentInWorktree: Partial<AgentSnapshot> = {
      id: "agent-3",
      project: {
        projectKey: "prj_amble",
        projectName: "amble",
        checkout: {
          cwd: "/home/user/workspace/paseo-worktrees/2n4cmcbe/projectheader",
          currentBranch: "feature-branch",
          isPaseoOwnedWorktree: true,
          mainRepoRoot: "/home/user/workspace/amble",
        },
      },
    };

    const result = resolveActiveProjectWorktree({
      activeAgent: agentInWorktree as AgentSnapshot,
      activeWorkspace: null,
      projects: [sampleProject],
      workspaces: [directWorkspace],
    });

    expect(result.projectName).toBe("amble");
    expect(result.isWorktree).toBe(true);
    expect(result.worktreeLabel).toBe("feature-branch");
  });

  it("detects worktree from path pattern -worktrees/ when workspaceKind is not set", () => {
    const wsWithPath: WorkspaceItem = {
      id: "wks_wt_legacy",
      projectId: "prj_amble",
      name: "custom-worktree",
      path: "/home/user/workspace/amble-worktrees/my-slug",
    };

    const result = resolveActiveProjectWorktree({
      activeAgent: null,
      activeWorkspace: wsWithPath,
      projects: [sampleProject],
      workspaces: [wsWithPath],
    });

    expect(result.projectName).toBe("amble");
    expect(result.isWorktree).toBe(true);
    expect(result.worktreeLabel).toBe("my-slug");
  });

  it("handles null activeAgent and null activeWorkspace gracefully", () => {
    const result = resolveActiveProjectWorktree({
      activeAgent: null,
      activeWorkspace: null,
      projects: [],
      workspaces: [],
    });

    expect(result.project).toBeNull();
    expect(result.projectName).toBeNull();
    expect(result.isWorktree).toBe(false);
    expect(result.worktreeLabel).toBeNull();
    expect(result.worktreeWorkspace).toBeNull();
  });

  it("resolves project by rootPath matching when projectId is not directly set", () => {
    const customWs: WorkspaceItem = {
      id: "wks_custom",
      name: "some-session",
      path: "/home/user/workspace/amble/subdir",
    };

    const result = resolveActiveProjectWorktree({
      activeAgent: null,
      activeWorkspace: customWs,
      projects: [sampleProject],
      workspaces: [customWs],
    });

    expect(result.projectName).toBe("amble");
    expect(result.isWorktree).toBe(false);
  });
});
