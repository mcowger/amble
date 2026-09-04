import React, { useMemo, useState, useEffect } from "react";
import { useWorkspace } from "../../context/WorkspaceContext";
import { usePaseo } from "../../context/PaseoContext";
import { ScrollArea } from "../ui/scroll-area";
import type { ProjectItem, WorkspaceItem, AgentSnapshot } from "../../lib/paseo/types";
import type { PaseoClient } from "../../lib/paseo/client";
import { cn } from "../../lib/utils";
import {
  isProjectEmpty,
  resolveProjectCollapsed,
  resolveWorktreeCollapsed,
  parseStoredCollapseState,
  toggleCollapseRecord,
} from "./sidebar-collapse-utils";
import { ProjectIcon } from "./ProjectIcon";
import {
  Folder,
  GitFork,
  GitBranch,
  Plus,
  X,
  ChevronRight,
  ChevronDown,
  Loader2,
  AlertCircle,
  Check,
  Search,
  Sparkles,
  Pencil,
} from "lucide-react";
import { slugify } from "@getpaseo/protocol/branch-slug";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../ui/dialog";
import { Popover, PopoverTrigger, PopoverContent } from "../ui/popover";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../ui/tabs";
import { RegisterProjectModal } from "./RegisterProjectModal";

interface SidebarProps {
  onCloseMobile?: () => void;
  isMobile?: boolean;
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

function BranchCombobox({
  value,
  onChange,
  branches,
  placeholder,
  disabled,
  isLoading,
}: {
  value: string;
  onChange: (val: string) => void;
  branches: string[];
  placeholder?: string;
  disabled?: boolean;
  isLoading?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");

  const filteredBranches = useMemo(() => {
    if (!filter.trim()) return branches;
    const q = filter.trim().toLowerCase();
    return branches.filter((b) => b.toLowerCase().includes(q));
  }, [branches, filter]);

  const hasExactMatch = useMemo(() => {
    return branches.some((b) => b.toLowerCase() === filter.trim().toLowerCase());
  }, [branches, filter]);

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setFilter("");
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-xs font-mono shadow-2xs transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 text-foreground cursor-pointer"
        >
          <div className="flex items-center gap-2 min-w-0 truncate">
            <GitBranch className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <span className={cn("truncate", !value && "text-muted-foreground")}>
              {value || placeholder || "Select branch..."}
            </span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0 ml-2">
            {isLoading && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
          </div>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={4}
        className="w-[var(--radix-popover-trigger-width)] min-w-[320px] p-1.5 bg-popover border-border shadow-lg"
      >
        <div className="p-1 pb-1.5">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter branches..."
              className="pl-8 h-8 text-xs font-mono"
              autoFocus
            />
          </div>
        </div>
        <ScrollArea className="max-h-52" viewportClassName="max-h-52">
          <div className="space-y-0.5 p-0.5">
            {filteredBranches.map((branch) => {
              const isSelected = branch === value;
              return (
                <button
                  key={branch}
                  type="button"
                  onClick={() => {
                    onChange(branch);
                    setOpen(false);
                    setFilter("");
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs font-mono text-left cursor-pointer transition-colors ${
                    isSelected
                      ? "bg-accent text-accent-foreground font-semibold"
                      : "hover:bg-accent/50 text-foreground"
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0 truncate">
                    <GitBranch className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <span className="truncate">{branch}</span>
                  </div>
                  {isSelected && <Check className="w-3.5 h-3.5 text-primary shrink-0 ml-2" />}
                </button>
              );
            })}

            {filter.trim() && !hasExactMatch && (
              <button
                type="button"
                onClick={() => {
                  onChange(filter.trim());
                  setOpen(false);
                  setFilter("");
                }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-mono text-left cursor-pointer hover:bg-accent/50 text-muted-foreground hover:text-foreground border-t border-border/40 mt-1 pt-1.5"
              >
                <Plus className="w-3.5 h-3.5 text-primary shrink-0" />
                <span className="truncate">Use &quot;{filter.trim()}&quot;</span>
              </button>
            )}

            {filteredBranches.length === 0 && !filter.trim() && (
              <div className="p-3 text-center text-xs text-muted-foreground">
                No branches found
              </div>
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

export function CreateWorktreeModal({
  isOpen,
  onClose,
  project,
  onCreated,
}: {
  isOpen: boolean;
  onClose: () => void;
  project: ProjectItem | null;
  onCreated?: (project: ProjectItem) => void;
}) {
  const { client } = usePaseo();
  const { workspaces, createWorktree } = useWorkspace();
  const [tab, setTab] = useState<"new" | "existing">("new");
  const [featureDescription, setFeatureDescription] = useState("");
  const [featureTitle, setFeatureTitle] = useState("");
  const [branchName, setBranchName] = useState("");
  const [baseBranch, setBaseBranch] = useState("main");
  const [existingBranch, setExistingBranch] = useState("");
  const [branchSuggestions, setBranchSuggestions] = useState<string[]>([]);
  const [isLoadingBranches, setIsLoadingBranches] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resolvedRootPath = useMemo(() => {
    if (!project) return "";
    if (project.rootPath) return project.rootPath;
    const ws = workspaces.find((w) => w.projectId === project.id);
    return ws?.path || "";
  }, [project, workspaces]);

  useEffect(() => {
    if (!isOpen || !project) {
      setFeatureDescription("");
      setFeatureTitle("");
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
  }, [isOpen, project?.id, resolvedRootPath, client]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project || !resolvedRootPath) {
      setError("Project directory could not be located");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      if (tab === "new") {
        let trimmedSlug = branchName.trim().replace(/\s+/g, "-");
        const trimmedDesc = featureDescription.trim();
        const trimmedTitle = featureTitle.trim();

        if (!trimmedSlug && !trimmedDesc) {
          setError("Please provide a branch name or feature description");
          setIsSubmitting(false);
          return;
        }

        if (!trimmedSlug && trimmedDesc) {
          trimmedSlug = slugify(trimmedDesc).slice(0, 45);
        }

        const res = await createWorktree({
          projectId: project.id,
          cwd: resolvedRootPath,
          worktreeSlug: trimmedSlug || undefined,
          refName: baseBranch.trim() || undefined,
          action: "branch-off",
          nameContext: trimmedDesc || undefined,
          firstAgentContext: trimmedDesc ? { prompt: trimmedDesc } : undefined,
          title: trimmedTitle || (trimmedDesc ? trimmedDesc.slice(0, 60) : undefined),
        });

        if (res.error) {
          setError(res.error);
          setIsSubmitting(false);
          return;
        }
      } else {
        const trimmedRef = existingBranch.trim();
        const trimmedTitle = featureTitle.trim();
        if (!trimmedRef) {
          setError("Existing branch is required");
          setIsSubmitting(false);
          return;
        }

        const res = await createWorktree({
          projectId: project.id,
          cwd: resolvedRootPath,
          refName: trimmedRef,
          action: "checkout",
          title: trimmedTitle || undefined,
        });

        if (res.error) {
          setError(res.error);
          setIsSubmitting(false);
          return;
        }
      }

      if (project) {
        onCreated?.(project);
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
              {project?.name || "project"}
            </span>
            .
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
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
              {/* Feature Description (AI metadata generation) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    Feature Description / Prompt
                  </Label>
                  <span className="text-[10px] text-muted-foreground/70">AI metadata</span>
                </div>
                <Input
                  type="text"
                  value={featureDescription}
                  onChange={(e) => {
                    setFeatureDescription(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="e.g. Add metadata generation for feature and session titles"
                  className="text-xs"
                  autoFocus
                  disabled={isSubmitting}
                />
                <p className="text-[11px] text-muted-foreground">
                  Paseo generates the feature title and branch name from this context.
                </p>
              </div>

              {/* Branch / Worktree Slug */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                    <GitBranch className="w-3.5 h-3.5" />
                    Branch / Worktree Name
                  </Label>
                  {featureDescription && (
                    <button
                      type="button"
                      onClick={() => setBranchName(slugify(featureDescription).slice(0, 40))}
                      className="text-[11px] text-primary hover:underline cursor-pointer"
                    >
                      Use suggested slug
                    </button>
                  )}
                </div>
                <Input
                  type="text"
                  value={branchName}
                  onChange={(e) => {
                    setBranchName(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder={
                    featureDescription
                      ? slugify(featureDescription).slice(0, 40)
                      : "e.g. feat/dashboard (leave blank to auto-generate)"
                  }
                  className="text-xs font-mono"
                  disabled={isSubmitting}
                />
                <p className="text-[11px] text-muted-foreground">
                  Leave blank to auto-generate branch name from the feature description.
                </p>
              </div>

              {/* Feature Title (Optional) */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <Pencil className="w-3.5 h-3.5" />
                  Feature Title (Optional)
                </Label>
                <Input
                  type="text"
                  value={featureTitle}
                  onChange={(e) => setFeatureTitle(e.target.value)}
                  placeholder="e.g. Metadata Generation Support"
                  className="text-xs"
                  disabled={isSubmitting}
                />
              </div>

              {/* Base Branch */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <GitFork className="w-3.5 h-3.5" />
                  Base Branch (Branch off from)
                </Label>
                <BranchCombobox
                  value={baseBranch}
                  onChange={(val) => setBaseBranch(val)}
                  branches={branchSuggestions}
                  placeholder="Select base branch..."
                  disabled={isSubmitting}
                  isLoading={isLoadingBranches}
                />
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
                <BranchCombobox
                  value={existingBranch}
                  onChange={(val) => {
                    setExistingBranch(val);
                    if (error) setError(null);
                  }}
                  branches={branchSuggestions}
                  placeholder="Select branch to checkout..."
                  disabled={isSubmitting}
                  isLoading={isLoadingBranches}
                />
                <p className="text-[11px] text-muted-foreground">
                  Checks out an existing local or remote branch into a new worktree.
                </p>
              </div>

              {/* Feature Title (Optional) */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <Pencil className="w-3.5 h-3.5" />
                  Feature Title (Optional)
                </Label>
                <Input
                  type="text"
                  value={featureTitle}
                  onChange={(e) => setFeatureTitle(e.target.value)}
                  placeholder="e.g. Navigation Refactor"
                  className="text-xs"
                  disabled={isSubmitting}
                />
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
                (tab === "new"
                  ? !branchName.trim() && !featureDescription.trim()
                  : !existingBranch.trim())
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

export function Sidebar({ onCloseMobile, isMobile }: SidebarProps) {
  const { client } = usePaseo();
  const {
    projects,
    workspaces,
    allAgents,
    activeAgentId,
    setActiveAgentId,
    setActiveWorkspaceId,
    createSession,
    updateWorkspaceTitle,
  } = useWorkspace();

  const [editingWorkspaceId, setEditingWorkspaceId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");

  const [projectCollapseOverrides, setProjectCollapseOverrides] = useState<Record<string, boolean>>(() => {
    if (typeof window !== "undefined") {
      return parseStoredCollapseState(localStorage.getItem("amble-collapsed-projects"));
    }
    return {};
  });

  const [worktreeCollapseOverrides, setWorktreeCollapseOverrides] = useState<Record<string, boolean>>(() => {
    if (typeof window !== "undefined") {
      return parseStoredCollapseState(localStorage.getItem("amble-collapsed-worktrees"));
    }
    return {};
  });

  const [targetWorktreeProject, setTargetWorktreeProject] = useState<ProjectItem | null>(null);
  const [isRegisterProjectOpen, setIsRegisterProjectOpen] = useState(false);

  const toggleProjectCollapse = (projectId: string, isCurrentlyCollapsed: boolean) => {
    setProjectCollapseOverrides((prev) => {
      const next = toggleCollapseRecord(prev, projectId, isCurrentlyCollapsed);
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem("amble-collapsed-projects", JSON.stringify(next));
        } catch {}
      }
      return next;
    });
  };

  const toggleWorktreeCollapse = (worktreeKey: string, isCurrentlyCollapsed: boolean) => {
    setWorktreeCollapseOverrides((prev) => {
      const next = toggleCollapseRecord(prev, worktreeKey, isCurrentlyCollapsed);
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem("amble-collapsed-worktrees", JSON.stringify(next));
        } catch {}
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
        title: wt.title,
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
        const isEmpty = isProjectEmpty(item.directSessions, item.worktrees);
        setProjectCollapseOverrides((prev) => {
          const isCollapsed = resolveProjectCollapsed(item.project.id, prev, isEmpty);
          if (!isCollapsed) return prev;
          const next = { ...prev, [item.project.id]: false };
          if (typeof window !== "undefined") {
            try {
              localStorage.setItem("amble-collapsed-projects", JSON.stringify(next));
            } catch {}
          }
          return next;
        });
        break;
      }
      for (const wt of item.worktrees) {
        if (wt.sessions.some((s) => s.id === activeAgentId)) {
          const wtKey = `${item.project.id}:${wt.branch}`;
          const isEmpty = isProjectEmpty(item.directSessions, item.worktrees);
          setProjectCollapseOverrides((prev) => {
            const isProjCollapsed = resolveProjectCollapsed(item.project.id, prev, isEmpty);
            if (!isProjCollapsed) return prev;
            const next = { ...prev, [item.project.id]: false };
            if (typeof window !== "undefined") {
              try {
                localStorage.setItem("amble-collapsed-projects", JSON.stringify(next));
              } catch {}
            }
            return next;
          });
          setWorktreeCollapseOverrides((prev) => {
            const hasChildren = wt.sessions.length > 0;
            const isWtCollapsed = resolveWorktreeCollapsed(wtKey, prev, hasChildren);
            if (!isWtCollapsed) return prev;
            const next = { ...prev, [wtKey]: false };
            if (typeof window !== "undefined") {
              try {
                localStorage.setItem("amble-collapsed-worktrees", JSON.stringify(next));
              } catch {}
            }
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
      {/* Fixed top header with '+' button and hairline separator */}
      <div className="h-10 px-3 flex items-center justify-between border-b border-border/40 shrink-0">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Projects
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setIsRegisterProjectOpen(true)}
            className="h-8 w-8 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/60 cursor-pointer transition-colors touch-manipulation"
            title="Register new project"
            aria-label="Register new project"
          >
            <Plus className="w-4 h-4" />
          </button>
          {isMobile && onCloseMobile && (
            <button
              type="button"
              onClick={onCloseMobile}
              className="h-8 w-8 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/60 cursor-pointer md:hidden transition-colors touch-manipulation"
              title="Close sidebar"
              aria-label="Close sidebar"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Tree list with Shadcn ScrollArea */}
      <ScrollArea className="flex-1 h-full min-h-0" viewportClassName="py-3 px-2">
        <div className="space-y-2.5">
          {projectTree.map(({ project, directWorkspace, directSessions, worktrees }) => {
            const hasChildren =
              directSessions.length > 0 || worktrees.length > 0;
            const isEmpty = isProjectEmpty(directSessions, worktrees);
            const isProjectCollapsed = resolveProjectCollapsed(
              project.id,
              projectCollapseOverrides,
              isEmpty,
            );

            return (
              <div key={project.id || project.name} className="space-y-0.5">
                {/* Project Header */}
                <div
                  onClick={() => {
                    toggleProjectCollapse(project.id, isProjectCollapsed);
                    handleSelectProject(project, directWorkspace);
                  }}
                  className="group flex items-center justify-between py-1 px-1.5 rounded-md hover:bg-accent/40 text-foreground cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleProjectCollapse(project.id, isProjectCollapsed);
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
                      const isWorktreeCollapsed = resolveWorktreeCollapsed(
                        wtKey,
                        worktreeCollapseOverrides,
                        hasWorktreeChildren,
                      );
                      const isEditingThisTitle = editingWorkspaceId === wt.workspaceId;
                      const displayTitle = wt.title?.trim();
                      const hasDistinctTitle = Boolean(displayTitle && displayTitle !== wt.branch);

                      return (
                        <div key={wtKey} className="space-y-0.5">
                          {/* Worktree Header */}
                          {isEditingThisTitle ? (
                            <div
                              className="pl-5 pr-2 py-1 flex items-center gap-1.5 rounded bg-accent/40"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <GitFork className="w-3.5 h-3.5 shrink-0 text-primary" />
                              <input
                                type="text"
                                value={editingTitle}
                                onChange={(e) => setEditingTitle(e.target.value)}
                                onKeyDown={async (e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    if (editingTitle.trim() && wt.workspaceId) {
                                      await updateWorkspaceTitle(wt.workspaceId, editingTitle.trim());
                                    }
                                    setEditingWorkspaceId(null);
                                  } else if (e.key === "Escape") {
                                    setEditingWorkspaceId(null);
                                  }
                                }}
                                className="flex-1 bg-background border border-border rounded px-1.5 py-0.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                                autoFocus
                              />
                              <button
                                type="button"
                                onClick={async () => {
                                  if (editingTitle.trim() && wt.workspaceId) {
                                    await updateWorkspaceTitle(wt.workspaceId, editingTitle.trim());
                                  }
                                  setEditingWorkspaceId(null);
                                }}
                                className="p-0.5 rounded hover:bg-accent text-primary cursor-pointer"
                                title="Save title"
                              >
                                <Check className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingWorkspaceId(null)}
                                className="p-0.5 rounded hover:bg-accent text-muted-foreground cursor-pointer"
                                title="Cancel"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ) : (
                            <div
                              onClick={() => {
                                if (hasWorktreeChildren) {
                                  toggleWorktreeCollapse(wtKey, isWorktreeCollapsed);
                                }
                              }}
                              className={`group pl-5 pr-1 py-1 flex items-center justify-between text-muted-foreground hover:text-foreground rounded hover:bg-accent/30 transition-colors ${
                                hasWorktreeChildren ? "cursor-pointer" : "cursor-default"
                              }`}
                            >
                              <div className="flex items-center gap-1.5 min-w-0 flex-1 mr-1">
                                {hasWorktreeChildren ? (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleWorktreeCollapse(wtKey, isWorktreeCollapsed);
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
                                {hasDistinctTitle ? (
                                  <div className="flex flex-col min-w-0 leading-tight">
                                    <span className="text-xs font-medium truncate text-foreground">
                                      {displayTitle}
                                    </span>
                                    <span className="text-[10px] font-mono text-muted-foreground/80 truncate">
                                      {wt.branch}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-xs font-medium truncate">{wt.branch}</span>
                                )}
                              </div>
                              <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                {wt.workspaceId && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setEditingWorkspaceId(wt.workspaceId);
                                      setEditingTitle(wt.title || wt.branch);
                                    }}
                                    className="p-0.5 rounded hover:text-foreground hover:bg-accent cursor-pointer"
                                    title="Rename feature title"
                                  >
                                    <Pencil className="w-3 h-3" />
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleNewSession(wt.workspaceId || directWorkspace?.id || project.id);
                                  }}
                                  className="p-0.5 rounded hover:text-foreground hover:bg-accent cursor-pointer"
                                  title={`New session in ${wt.branch}`}
                                >
                                  <Plus className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          )}

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
        project={targetWorktreeProject}
        onCreated={(proj) => {
          setProjectCollapseOverrides((prev) => {
            const next = { ...prev, [proj.id]: false };
            if (typeof window !== "undefined") {
              try {
                localStorage.setItem("amble-collapsed-projects", JSON.stringify(next));
              } catch {}
            }
            return next;
          });
        }}
      />

      {/* Register Project Modal */}
      <RegisterProjectModal
        isOpen={isRegisterProjectOpen}
        onClose={() => setIsRegisterProjectOpen(false)}
        onProjectRegistered={(proj) => {
          if (proj?.id || proj?.projectId) {
            const id = proj.projectId || proj.id;
            setProjectCollapseOverrides((prev) => {
              const next = { ...prev, [id]: false };
              if (typeof window !== "undefined") {
                try {
                  localStorage.setItem("amble-collapsed-projects", JSON.stringify(next));
                } catch {}
              }
              return next;
            });
          }
        }}
      />
    </aside>
  );
}
