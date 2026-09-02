import React, { useMemo, useState, useEffect } from "react";
import { useWorkspace } from "../../context/WorkspaceContext";
import { usePaseo } from "../../context/PaseoContext";
import type { ProjectItem, WorkspaceItem, AgentSnapshot } from "../../lib/paseo/types";
import type { PaseoClient } from "../../lib/paseo/client";
import {
  Folder,
  GitFork,
  Plus,
  X,
  ChevronRight,
} from "lucide-react";

interface SidebarProps {
  onCloseMobile?: () => void;
}

function formatElapsed(timestamp?: string | number): string {
  if (!timestamp) return "";
  const timeMs = typeof timestamp === "string" ? new Date(timestamp).getTime() : timestamp;
  if (isNaN(timeMs)) return "";
  const diffSec = Math.max(0, Math.floor((Date.now() - timeMs) / 1000));
  if (diffSec < 60) return `${diffSec}s`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d`;
}

function ProjectIcon({ project, client }: { project: ProjectItem; client: PaseoClient }) {
  const [iconUri, setIconUri] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadIcon = async () => {
      try {
        let res: { icon: { mimeType: string; data: string } | null } | null = null;
        if (project.rootPath) {
          res = await client.requestProjectIcon(project.rootPath).catch(() => null);
        }
        if (!res?.icon && project.id) {
          res = await client.getProjectIcon(project.id).catch(() => null);
        }
        if (!cancelled && res?.icon) {
          setIconUri(`data:${res.icon.mimeType};base64,${res.icon.data}`);
        }
      } catch {}
    };

    loadIcon();

    return () => {
      cancelled = true;
    };
  }, [project.id, project.rootPath, client]);

  if (iconUri) {
    return (
      <img
        src={iconUri}
        alt=""
        className="w-3.5 h-3.5 object-contain shrink-0 rounded-xs"
      />
    );
  }

  return <Folder className="w-3.5 h-3.5 text-muted-foreground shrink-0" />;
}

export function Sidebar({ onCloseMobile }: SidebarProps) {
  const { client } = usePaseo();
  const {
    projects,
    workspaces,
    allAgents,
    activeAgentId,
    setActiveAgentId,
    setActiveWorkspaceId,
    createSession,
  } = useWorkspace();

  const [collapsedProjects, setCollapsedProjects] = useState<Set<string>>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("amble-collapsed-projects");
        if (saved) return new Set(JSON.parse(saved));
      } catch {}
    }
    return new Set();
  });

  const [collapsedWorktrees, setCollapsedWorktrees] = useState<Set<string>>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("amble-collapsed-worktrees");
        if (saved) return new Set(JSON.parse(saved));
      } catch {}
    }
    return new Set();
  });

  const toggleProjectCollapse = (projectId: string) => {
    setCollapsedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) {
        next.delete(projectId);
      } else {
        next.add(projectId);
      }
      if (typeof window !== "undefined") {
        localStorage.setItem("amble-collapsed-projects", JSON.stringify(Array.from(next)));
      }
      return next;
    });
  };

  const toggleWorktreeCollapse = (worktreeKey: string) => {
    setCollapsedWorktrees((prev) => {
      const next = new Set(prev);
      if (next.has(worktreeKey)) {
        next.delete(worktreeKey);
      } else {
        next.add(worktreeKey);
      }
      if (typeof window !== "undefined") {
        localStorage.setItem("amble-collapsed-worktrees", JSON.stringify(Array.from(next)));
      }
      return next;
    });
  };

  const projectTree = useMemo(() => {
    // 1. Unique projects by id or rootPath
    const pMap = new Map<string, ProjectItem>();
    for (const p of projects) {
      const key = p.id || p.rootPath;
      if (key && !pMap.has(key)) pMap.set(key, p);
    }

    // 2. Ensure workspaces without an explicit project entry are included
    for (const w of workspaces) {
      const root = w.path;
      const key = w.projectId || root;
      if (root && key && !pMap.has(key) && !root.includes("-worktrees/")) {
        pMap.set(key, {
          id: key,
          name: w.name,
          rootPath: root,
        });
      }
    }

    return Array.from(pMap.values()).map((p) => {
      // Find registered workspaces belonging to this project
      const projectWorkspaces = workspaces.filter(
        (w) =>
          w.projectId === p.id ||
          (p.projectKey && w.projectId === p.projectKey) ||
          (p.rootPath && w.path === p.rootPath),
      );

      const directWorkspace = projectWorkspaces.find(
        (w) => w.workspaceKind === "local_checkout" || w.workspaceKind === "directory",
      );
      const worktreeWorkspaces = projectWorkspaces.filter(
        (w) => w.workspaceKind === "worktree",
      );

      const directSessions = directWorkspace
        ? allAgents.filter((a) => a.workspaceId === directWorkspace.id)
        : [];

      const worktrees = worktreeWorkspaces.map((wt) => ({
        branch: wt.branch || wt.worktreeSlug || wt.name,
        workspaceId: wt.id,
        sessions: allAgents.filter((a) => a.workspaceId === wt.id),
      }));

      return {
        project: p,
        directWorkspace,
        directSessions,
        worktrees,
      };
    });
  }, [projects, workspaces, allAgents]);

  // Automatically uncollapse project/worktree containing the active session
  useEffect(() => {
    if (!activeAgentId) return;
    for (const item of projectTree) {
      if (item.directSessions.some((s) => s.id === activeAgentId)) {
        if (collapsedProjects.has(item.project.id)) {
          setCollapsedProjects((prev) => {
            const next = new Set(prev);
            next.delete(item.project.id);
            return next;
          });
        }
        break;
      }
      for (const wt of item.worktrees) {
        if (wt.sessions.some((s) => s.id === activeAgentId)) {
          const wtKey = `${item.project.id}:${wt.branch}`;
          setCollapsedProjects((prev) => {
            const next = new Set(prev);
            next.delete(item.project.id);
            return next;
          });
          setCollapsedWorktrees((prev) => {
            const next = new Set(prev);
            next.delete(wtKey);
            return next;
          });
          break;
        }
      }
    }
  }, [activeAgentId, projectTree]);

  const handleSelectSession = (sessionId: string, workspaceId?: string) => {
    setActiveAgentId(sessionId);
    if (workspaceId) {
      setActiveWorkspaceId(workspaceId);
    }
    if (onCloseMobile) {
      onCloseMobile();
    }
  };

  const handleSelectProject = (project: ProjectItem, directWorkspace?: WorkspaceItem) => {
    if (directWorkspace) {
      setActiveWorkspaceId(directWorkspace.id);
    } else {
      setActiveWorkspaceId(project.id);
    }
    if (onCloseMobile) {
      onCloseMobile();
    }
  };

  const handleNewSession = async (workspaceId?: string) => {
    await createSession(undefined, workspaceId);
    if (onCloseMobile) {
      onCloseMobile();
    }
  };

  return (
    <aside className="w-64 border-r border-border bg-sidebar flex flex-col h-full shrink-0 select-none">
      {onCloseMobile && (
        <div className="p-2.5 flex items-center justify-between md:hidden border-b border-border/40">
          <span className="text-xs font-semibold">Workspaces</span>
          <button
            onClick={onCloseMobile}
            className="p-1 rounded-md text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Tree list */}
      <div className="flex-1 overflow-y-auto py-3 px-2 space-y-2.5">
        {projectTree.map(({ project, directWorkspace, directSessions, worktrees }) => {
          const hasChildren =
            directSessions.length > 0 || worktrees.length > 0;
          const isProjectCollapsed = collapsedProjects.has(project.id);

          return (
            <div key={project.id || project.name} className="space-y-0.5">
              {/* Project Header */}
              <div
                onClick={() => {
                  toggleProjectCollapse(project.id);
                  handleSelectProject(project, directWorkspace);
                }}
                className="group flex items-center justify-between py-1 px-1.5 rounded-md hover:bg-accent/40 text-foreground cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleProjectCollapse(project.id);
                    }}
                    className="p-0.5 rounded text-muted-foreground/60 hover:text-foreground cursor-pointer shrink-0"
                    title={isProjectCollapsed ? "Expand project" : "Collapse project"}
                  >
                    <ChevronRight
                      className={`w-3 h-3 transition-transform duration-150 ${
                        !isProjectCollapsed ? "rotate-90" : ""
                      }`}
                    />
                  </button>

                  <ProjectIcon project={project} client={client} />
                  <span className="font-semibold text-xs tracking-tight lowercase truncate">
                    {project.name}
                  </span>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleNewSession(directWorkspace?.id || project.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-muted-foreground hover:text-foreground hover:bg-accent cursor-pointer transition-opacity"
                  title={`New session in ${project.name}`}
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>

              {/* Project Body (Direct Sessions + Worktrees + Empty state) */}
              {!isProjectCollapsed && (
                <div className="space-y-0.5">
                  {/* Direct Sessions */}
                  {directSessions.map((session) => {
                    const isActive = session.id === activeAgentId;
                    const elapsed = formatElapsed(session.updatedAt || session.createdAt);

                    return (
                      <div key={session.id} className="pl-6 pr-1">
                        <div
                          onClick={() =>
                            handleSelectSession(
                              session.id,
                              session.workspaceId || directWorkspace?.id || project.id,
                            )
                          }
                          className={`flex items-center justify-between gap-1.5 px-2 py-1 rounded-md text-xs cursor-pointer transition-all ${
                            isActive
                              ? "bg-amber-500/15 border border-amber-500/30 text-amber-700 dark:text-amber-200 shadow-2xs font-medium"
                              : "text-muted-foreground hover:text-foreground hover:bg-accent/30"
                          }`}
                        >
                          <div className="flex items-center gap-1.5 min-w-0 truncate">
                            {isActive && (
                              <div className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                            )}
                            <span className="truncate">
                              {session.title || "Untitled Session"}
                            </span>
                          </div>
                          {elapsed && (
                            <span
                              className={`text-[10px] font-mono shrink-0 ml-1 ${
                                isActive
                                  ? "text-amber-600 dark:text-amber-400"
                                  : "text-muted-foreground/70"
                              }`}
                            >
                              {elapsed}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {/* Per-Worktree Sections */}
                  {worktrees.map((wt) => {
                    const wtKey = `${project.id}:${wt.branch}`;
                    const hasWorktreeChildren = wt.sessions.length > 0;
                    const isWorktreeCollapsed = hasWorktreeChildren && collapsedWorktrees.has(wtKey);

                    return (
                      <div key={wtKey} className="space-y-0.5">
                        {/* Worktree Header */}
                        <div
                          onClick={() => {
                            if (hasWorktreeChildren) {
                              toggleWorktreeCollapse(wtKey);
                            }
                          }}
                          className={`group pl-5 pr-1 py-0.5 flex items-center justify-between text-muted-foreground hover:text-foreground rounded hover:bg-accent/30 transition-colors ${
                            hasWorktreeChildren ? "cursor-pointer" : "cursor-default"
                          }`}
                        >
                          <div className="flex items-center gap-1.5 min-w-0">
                            {hasWorktreeChildren ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleWorktreeCollapse(wtKey);
                                }}
                                className="p-0.5 rounded text-muted-foreground/60 hover:text-foreground cursor-pointer shrink-0"
                                title={isWorktreeCollapsed ? "Expand worktree" : "Collapse worktree"}
                              >
                                <ChevronRight
                                  className={`w-3 h-3 transition-transform duration-150 ${
                                    !isWorktreeCollapsed ? "rotate-90" : ""
                                  }`}
                                />
                              </button>
                            ) : (
                              <span className="w-4 shrink-0" />
                            )}
                            <GitFork className="w-3.5 h-3.5 shrink-0 opacity-70" />
                            <span className="text-xs font-medium truncate">{wt.branch}</span>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleNewSession(wt.workspaceId || directWorkspace?.id || project.id);
                            }}
                            className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:text-foreground hover:bg-accent cursor-pointer transition-opacity"
                            title={`New session in ${wt.branch}`}
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>

                        {/* Worktree Sessions */}
                        {!isWorktreeCollapsed &&
                          wt.sessions.map((session) => {
                            const isActive = session.id === activeAgentId;
                            const elapsed = formatElapsed(session.updatedAt || session.createdAt);

                            return (
                              <div key={session.id} className="pl-9 pr-1">
                                <div
                                  onClick={() =>
                                    handleSelectSession(
                                      session.id,
                                      session.workspaceId || wt.workspaceId || project.id,
                                    )
                                  }
                                  className={`flex items-center justify-between gap-1.5 px-2 py-1 rounded-md text-xs cursor-pointer transition-all ${
                                    isActive
                                      ? "bg-amber-500/15 border border-amber-500/30 text-amber-700 dark:text-amber-200 shadow-2xs font-medium"
                                      : "text-muted-foreground hover:text-foreground hover:bg-accent/30"
                                  }`}
                                >
                                  <div className="flex items-center gap-1.5 min-w-0 truncate">
                                    <div
                                      className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                        isActive ? "bg-amber-500" : "bg-blue-500"
                                      }`}
                                    />
                                    <span className="truncate">
                                      {session.title || "Untitled Session"}
                                    </span>
                                  </div>
                                  {elapsed && (
                                    <span
                                      className={`text-[10px] font-mono shrink-0 ml-1 ${
                                        isActive
                                          ? "text-amber-600 dark:text-amber-400"
                                          : "text-muted-foreground/70"
                                      }`}
                                    >
                                      {elapsed}
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    );
                  })}

                  {/* Empty Project / No Sessions */}
                  {!hasChildren && (
                    <div className="pl-7 pr-2 py-0.5">
                      <span className="text-[11px] text-muted-foreground/60 select-none">
                        No sessions in this workspace yet.
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
}
