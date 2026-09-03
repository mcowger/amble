import { describe, expect, test } from "bun:test";
import type { ProjectItem, WorkspaceItem } from "./paseo/types";
import {
  chooseDefaultWorkspace,
  resolveWorkspaceTarget,
} from "./workspace-target";

const workspace = (overrides: Partial<WorkspaceItem>): WorkspaceItem => ({
  id: "workspace-main",
  name: "Main",
  path: "/workspace/main",
  ...overrides,
});

const project: ProjectItem = {
  id: "prj_amble",
  projectKey: "amble",
  name: "Amble",
  rootPath: "/workspace/amble",
};

describe("chooseDefaultWorkspace", () => {
  test("does not prefer the tmp workspace", () => {
    const tmp = workspace({ id: "workspace-tmp", name: "tmp", path: "/workspace/tmp" });
    const main = workspace({ id: "workspace-main", name: "Amble", path: "/workspace/amble" });

    expect(chooseDefaultWorkspace([tmp, main])).toBe(main);
  });
});

describe("resolveWorkspaceTarget", () => {
  test("resolves a selected workspace directly", () => {
    const selected = workspace({ id: "workspace-selected", path: "/workspace/selected" });

    expect(
      resolveWorkspaceTarget({
        requestedWorkspaceId: selected.id,
        workspaces: [selected],
        projects: [],
      }),
    ).toEqual({
      workspaceId: selected.id,
      cwd: selected.path,
      needsProjectOpen: false,
    });
  });

  test("uses a selected project's root instead of tmp when it has no workspace", () => {
    expect(
      resolveWorkspaceTarget({
        requestedWorkspaceId: project.id,
        workspaces: [],
        projects: [project],
      }),
    ).toEqual({
      workspaceId: null,
      cwd: project.rootPath,
      needsProjectOpen: true,
    });
  });

  test("maps a selected project to its direct workspace", () => {
    const direct = workspace({
      id: "workspace-ambo-direct",
      path: project.rootPath,
      projectId: project.id,
      workspaceKind: "local_checkout",
    });

    expect(
      resolveWorkspaceTarget({
        requestedWorkspaceId: project.id,
        workspaces: [direct],
        projects: [project],
      }).workspaceId,
    ).toBe(direct.id);
  });
});
