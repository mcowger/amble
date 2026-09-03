import { describe, expect, test, mock } from "bun:test";
import { PaseoClient } from "./client";

describe("PaseoClient project registration and sources", () => {
  test("delegates addProject to daemon", async () => {
    const client = new PaseoClient({ url: "ws://127.0.0.1:9999/ws" });
    const addProjectMock = mock(async (cwd: string) => ({
      requestId: "req-1",
      project: {
        projectId: "p-1",
        projectDisplayName: "my-app",
        projectRootPath: cwd,
        projectKind: "git",
      },
      error: null,
    }));
    (client as any).daemon.addProject = addProjectMock;

    const res = await client.addProject("/path/to/project");
    expect(addProjectMock).toHaveBeenCalledTimes(1);
    expect(addProjectMock.mock.calls[0]![0]).toBe("/path/to/project");
    expect(res.project?.projectDisplayName).toBe("my-app");
  });

  test("delegates createProjectDirectory to daemon", async () => {
    const client = new PaseoClient({ url: "ws://127.0.0.1:9999/ws" });
    const createProjectDirectoryMock = mock(async (input: { parentPath: string; name: string }) => ({
      requestId: "req-2",
      directoryPath: `${input.parentPath}/${input.name}`,
      project: {
        projectId: "p-2",
        projectDisplayName: input.name,
        projectRootPath: `${input.parentPath}/${input.name}`,
        projectKind: "directory",
      },
      error: null,
      errorCode: null,
    }));
    (client as any).daemon.createProjectDirectory = createProjectDirectoryMock;

    const res = await client.createProjectDirectory({ parentPath: "/home/user", name: "new-app" });
    expect(createProjectDirectoryMock).toHaveBeenCalledTimes(1);
    expect(createProjectDirectoryMock.mock.calls[0]![0]).toEqual({ parentPath: "/home/user", name: "new-app" });
    expect(res.directoryPath).toBe("/home/user/new-app");
  });

  test("delegates searchGithubRepositories to daemon", async () => {
    const client = new PaseoClient({ url: "ws://127.0.0.1:9999/ws" });
    const searchGithubMock = mock(async (input: { query: string; limit?: number }) => ({
      status: "success" as const,
      requestId: "req-3",
      repositories: [
        {
          id: "r1",
          name: "repo1",
          nameWithOwner: "user/repo1",
          description: "A repo",
          visibility: "public" as const,
          updatedAt: "2026-09-01T00:00:00Z",
          cloneUrl: "https://github.com/user/repo1",
        },
      ],
      available: true as const,
      error: null,
    }));
    (client as any).daemon.searchGithubRepositories = searchGithubMock;

    const res = await client.searchGithubRepositories({ query: "repo1", limit: 5 });
    expect(searchGithubMock).toHaveBeenCalledTimes(1);
    expect(searchGithubMock.mock.calls[0]![0]).toEqual({ query: "repo1", limit: 5 });
    expect(res.status).toBe("success");
    if (res.status === "success") {
      expect(res.repositories).toHaveLength(1);
      expect(res.repositories[0]?.nameWithOwner).toBe("user/repo1");
    }
  });

  test("delegates cloneGithubProject to daemon", async () => {
    const client = new PaseoClient({ url: "ws://127.0.0.1:9999/ws" });
    const cloneGithubMock = mock(async (input: { repo: string; targetDirectory: string; cloneProtocol?: "https" | "ssh" }) => ({
      requestId: "req-4",
      repo: input.repo,
      checkoutPath: `${input.targetDirectory}/repo1`,
      project: {
        projectId: "p-4",
        projectDisplayName: "repo1",
        projectRootPath: `${input.targetDirectory}/repo1`,
        projectKind: "git",
      },
      error: null,
    }));
    (client as any).daemon.cloneGithubProject = cloneGithubMock;

    const res = await client.cloneGithubProject({
      repo: "user/repo1",
      targetDirectory: "/home/user/workspace",
      cloneProtocol: "https",
    });
    expect(cloneGithubMock).toHaveBeenCalledTimes(1);
    expect(res.checkoutPath).toBe("/home/user/workspace/repo1");
  });

  test("delegates getDirectorySuggestions to daemon", async () => {
    const client = new PaseoClient({ url: "ws://127.0.0.1:9999/ws" });
    const getDirSuggestionsMock = mock(async (options: any) => ({
      directories: ["/home/user/workspace", "/home/user/downloads"],
      entries: [
        { path: "/home/user/workspace", kind: "directory" as const },
        { path: "/home/user/downloads", kind: "directory" as const },
      ],
      error: null,
      requestId: "req-5",
    }));
    (client as any).daemon.getDirectorySuggestions = getDirSuggestionsMock;

    const res = await client.getDirectorySuggestions({ query: "~", limit: 10 });
    expect(getDirSuggestionsMock).toHaveBeenCalledTimes(1);
    expect(res.directories).toHaveLength(2);
  });
});
