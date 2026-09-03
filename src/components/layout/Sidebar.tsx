import React, { useMemo, useState, useEffect } from "react";
import { useWorkspace } from "../../context/WorkspaceContext";
import { usePaseo } from "../../context/PaseoContext";
import { ScrollArea } from "../ui/scroll-area";
import type { ProjectItem, WorkspaceItem, AgentSnapshot } from "../../lib/paseo/types";
import type { PaseoClient } from "../../lib/paseo/client";
import {
  Folder,
  GitFork,
  GitBranch,
  Plus,
  X,
  ChevronRight,
  Loader2,
  AlertCircle,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../ui/tabs";

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

export function CreateWorktreeModal({
  isOpen,
  onClose,
  initialProject,
  projects,
  onCreated,
}: {
  isOpen: boolean;
  onClose: () => void;
  initialProject: ProjectItem | null;
  projects: ProjectItem[];
  onCreated?: (project: ProjectItem) => void;
}) {
  const { client } = usePaseo();
  const { workspaces, createWorktree } = useWorkspace();
  const [currentProject, setCurrentProject] = useState<ProjectItem | null>(initialProject);
  const [tab, setTab] = useState<"new" | "existing">("new");
  const [branchName, setBranchName] = useState("");
  const [baseBranch, setBaseBranch] = useState("main");
  const [existingBranch, setExistingBranch] = useState("");
  const [branchSuggestions, setBranchSuggestions] = useState<string[]>([]);
  const [isLoadingBranches, setIsLoadingBranches] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialProject) {
      setCurrentProject(initialProject);
    } else if (projects.length > 0 && !currentProject) {
      setCurrentProject(projects[0] || null);
    }
  }, [initialProject, projects]);

  const resolvedRootPath = useMemo(() => {
    if (!currentProject) return "";
    if (currentProject.rootPath) return currentProject.rootPath;
    const ws = workspaces.find((w) => w.projectId === currentProject.id);
    return ws?.path || "";
  }, [currentProject, workspaces]);

  useEffect(() => {
    if (!isOpen) {
      setBranchName("");
      setExistingBranch("");
      setError(null);
      return;
    }

    let cancelled = false;
    const fetchBranches = async () => {
      if (!resolvedRootPath) return;
      setIsLoadingBranches(true);
      try {
        const branches = await client.getBranchSuggestions({ cwd: resolvedRootPath });
        if (!cancelled && Array.isArray(branches) && branches.length > 0) {
          setBranchSuggestions(branches);
          if (branches.includes("main")) {
            setBaseBranch("main");
          } else if (branches.includes("master")) {
            setBaseBranch("master");
          } else {
            setBaseBranch(branches[0] || "main");
          }
          setExistingBranch(branches[0] || "");
        }
      } catch {
        // Fallback gracefully
      } finally {
        if (!cancelled) {
          setIsLoadingBranches(false);
        }
      }
    };

    fetchBranches();
    return () => {
      cancelled = true;
    };
  }, [isOpen, currentProject?.id, resolvedRootPath, client]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentProject || !resolvedRootPath) {
      setError("Project directory could not be located");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      if (tab === "new") {
        const trimmedSlug = branchName.trim().replace(/\s+/g, "-");
        if (!trimmedSlug) {
          setError("Branch name is required");
          setIsSubmitting(false);
          return;
        }

        const res = await createWorktree({
          projectId: currentProject.id,
          cwd: resolvedRootPath,
          worktreeSlug: trimmedSlug,
          refName: baseBranch.trim() || undefined,
          action: "branch-off",
        });

        if (res.error) {
          setError(res.error);
          setIsSubmitting(false);
          return;
        }
      } else {
        const trimmedRef = existingBranch.trim();
        if (!trimmedRef) {
          setError("Existing branch is required");
          setIsSubmitting(false);
          return;
        }

        const res = await createWorktree({
          projectId: currentProject.id,
          cwd: resolvedRootPath,
          refName: trimmedRef,
          action: "checkout",
        });

        if (res.error) {
          setError(res.error);
          setIsSubmitting(false);
          return;
        }
      }

      if (currentProject) {
        onCreated?.(currentProject);
      }
      onClose();
    } catch (err: any) {
      setError(err?.message || "Failed to create worktree");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !isSubmitting && onClose()}>
      <DialogContent className="sm:max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <GitFork className="w-4 h-4 text-primary shrink-0" />
            <span>New Worktree</span>
          </DialogTitle>
          <DialogDescription>
            Create a git worktree for{" "}
            <span className="font-semibold text-foreground">
              {currentProject?.name || "project"}
            </span>
            .
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          {projects.length > 1 && (
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <Folder className="w-3.5 h-3.5" />
                Target Project
              </Label>
              <select
                value={currentProject?.id || ""}
                onChange={(e) => {
                  const found = projects.find((p) => p.id === e.target.value);
                  if (found) setCurrentProject(found);
                }}
                className="w-full text-xs font-medium rounded-md border border-input bg-background px-3 py-1.5 shadow-2xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring text-foreground"
                disabled={isSubmitting}
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <Tabs
            value={tab}
            onValueChange={(val) => setTab(val as "new" | "existing")}
            className="w-full"
          >
            <TabsList className="grid w-full grid-cols-2 h-8">
              <TabsTrigger value="new" className="text-xs py-1">
                New Branch
              </TabsTrigger>
              <TabsTrigger value="existing" className="text-xs py-1">
                Existing Branch
              </TabsTrigger>
            </TabsList>

            <TabsContent value="new" className="space-y-3 pt-3">
              {/* Branch / Worktree Slug */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <GitBranch className="w-3.5 h-3.5" />
                  Branch / Worktree Name
                </Label>
                <Input
                  type="text"
                  value={branchName}
                  onChange={(e) => {
                    setBranchName(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="e.g. feat/dashboard or bugfix-auth"
                  className="text-xs font-mono"
                  autoFocus
                  disabled={isSubmitting}
                />
                <p className="text-[11px] text-muted-foreground">
                  A new git branch and dedicated worktree directory will be created.
                </p>
              </div>

              {/* Base Branch */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <GitFork className="w-3.5 h-3.5" />
                  Base Branch (Branch off from)
                </Label>
                <div className="relative">
                  <Input
                    type="text"
                    list="base-branch-options"
                    value={baseBranch}
                    onChange={(e) => setBaseBranch(e.target.value)}
                    placeholder="main"
                    className="text-xs font-mono"
                    disabled={isSubmitting}
                  />
                  {isLoadingBranches && (
                    <Loader2 className="w-3 h-3 animate-spin absolute right-2.5 top-2.5 text-muted-foreground" />
                  )}
                </div>
                {branchSuggestions.length > 0 && (
                  <datalist id="base-branch-options">
                    {branchSuggestions.map((b) => (
                      <option key={b} value={b} />
                    ))}
                  </datalist>
                )}
                <p className="text-[11px] text-muted-foreground">
                  The starting commit / branch to branch off from (defaults to main).
                </p>
              </div>
            </TabsContent>

            <TabsContent value="existing" className="space-y-3 pt-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <GitBranch className="w-3.5 h-3.5" />
                  Existing Branch to Checkout
                </Label>
                {branchSuggestions.length > 0 ? (
                  <select
                    value={existingBranch}
                    onChange={(e) => {
                      setExistingBranch(e.target.value);
                      if (error) setError(null);
                    }}
                    className="w-full text-xs font-mono rounded-md border border-input bg-background px-3 py-1.5 shadow-2xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring text-foreground"
                    disabled={isSubmitting}
                  >
                    {branchSuggestions.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="relative">
                    <Input
                      type="text"
                      value={existingBranch}
                      onChange={(e) => {
                        setExistingBranch(e.target.value);
                        if (error) setError(null);
                      }}
                      placeholder="e.g. origin/feature-login"
                      className="text-xs font-mono"
                      disabled={isSubmitting}
                    />
                    {isLoadingBranches && (
                      <Loader2 className="w-3 h-3 animate-spin absolute right-2.5 top-2.5 text-muted-foreground" />
                    )}
                  </div>
                )}
                <p className="text-[11px] text-muted-foreground">
                  Checks out an existing local or remote branch into a new worktree.
                </p>
              </div>
            </TabsContent>
          </Tabs>

          {/* Error Message */}
          {error && (
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span className="truncate">{error}</span>
            </div>
          )}

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-xs"
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={
                isSubmitting ||
                (tab === "new" ? !branchName.trim() : !existingBranch.trim())
              }
              className="gap-1.5 text-xs font-medium"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <GitFork className="w-3.5 h-3.5" />
                  Create Worktree
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
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

  const [targetWorktreeProject, setTargetWorktreeProject] = useState<ProjectItem | null>(null);

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
    const wsId = directWorkspace?.id || project.id;
    setActiveWorkspaceId(wsId);

    // Find if this project has any active sessions in its workspaces
    const projectWorkspaces = workspaces.filter(
      (w) =>
        w.projectId === project.id ||
        (project.projectKey && w.projectId === project.projectKey) ||
        (project.rootPath && w.path === project.rootPath),
    );
    const firstAgent = allAgents.find((a) =>
      projectWorkspaces.some((w) => w.id === a.workspaceId),
    );
    setActiveAgentId(firstAgent ? firstAgent.id : null);

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

      {/* Tree list with Shadcn ScrollArea */}
      <ScrollArea className="flex-1 h-full min-h-0" viewportClassName="py-3 px-2">
        <div className="space-y-2.5">
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

                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setTargetWorktreeProject(project);
                      }}
                      className="p-0.5 rounded text-muted-foreground hover:text-foreground hover:bg-accent cursor-pointer"
                      title={`New worktree in ${project.name}`}
                    >
                      <GitFork className="w-3 h-3" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleNewSession(directWorkspace?.id || project.id);
                      }}
                      className="p-0.5 rounded text-muted-foreground hover:text-foreground hover:bg-accent cursor-pointer"
                      title={`New session in ${project.name}`}
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
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

                    {/* New Worktree Action Item */}
                    <div className="pl-6 pr-1 pt-0.5">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setTargetWorktreeProject(project);
                        }}
                        className="flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] text-muted-foreground/60 hover:text-foreground hover:bg-accent/30 transition-colors cursor-pointer w-full text-left"
                        title={`New worktree in ${project.name}`}
                      >
                        <GitFork className="w-3 h-3 opacity-60 shrink-0" />
                        <span className="truncate">New worktree...</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </ScrollArea>

      {/* Create Worktree Modal */}
      <CreateWorktreeModal
        isOpen={!!targetWorktreeProject}
        onClose={() => setTargetWorktreeProject(null)}
        initialProject={targetWorktreeProject}
        projects={projects}
        onCreated={(proj) => {
          setCollapsedProjects((prev) => {
            const next = new Set(prev);
            next.delete(proj.id);
            return next;
          });
        }}
      />
    </aside>
  );
}
