import React, { useState, useMemo } from "react";
import { useWorkspace } from "../../context/WorkspaceContext";
import { usePaseo } from "../../context/PaseoContext";
import { useTheme } from "../../context/ThemeContext";
import { cn } from "../../lib/utils";
import { StatusBadge } from "./StatusBadge";
import { ContextUsagePill } from "./ContextUsagePill";
import { SessionTokenDetailPill } from "./SessionTokenDetailPill";
import { ProjectIcon } from "./ProjectIcon";
import { resolveActiveProjectWorktree } from "./project-worktree-utils";
import {
  Settings,
  Sun,
  Moon,
  Plus,
  Sparkles,
  Menu,
  Pencil,
  Check,
  LayoutList,
  ListCollapse,
  GitFork,
  ChevronRight,
} from "lucide-react";

interface TopRailProps {
  onOpenSettings: () => void;
  onToggleSidebar: () => void;
}

export function TopRail({ onOpenSettings, onToggleSidebar }: TopRailProps) {
  const {
    activeAgent,
    activeWorkspace,
    projects,
    workspaces,
    setActiveWorkspaceId,
    models,
    selectedModel,
    selectedMode,
    thinkingEffort,
    createAgentTab,
    updateAgentTitle,
    summaryMode,
    setSummaryMode,
  } = useWorkspace();

  const { client } = usePaseo();
  const { isDark, setTheme } = useTheme();

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState("");

  const {
    project,
    projectName,
    isWorktree,
    worktreeLabel,
    worktreeTooltip,
    directWorkspace,
    worktreeWorkspace,
  } = useMemo(
    () =>
      resolveActiveProjectWorktree({
        activeAgent,
        activeWorkspace,
        projects,
        workspaces,
      }),
    [activeAgent, activeWorkspace, projects, workspaces],
  );

  const handleSelectProject = () => {
    if (directWorkspace) {
      setActiveWorkspaceId(directWorkspace.id);
    } else if (project?.id) {
      setActiveWorkspaceId(project.id);
    }
  };

  const handleSelectWorktree = () => {
    if (worktreeWorkspace?.id) {
      setActiveWorkspaceId(worktreeWorkspace.id);
    }
  };

  const handleStartRename = () => {
    if (!activeAgent) return;
    setEditedTitle(activeAgent.title || activeAgent.name || "");
    setIsEditingTitle(true);
  };

  const handleSaveTitle = () => {
    if (!activeAgent || !isEditingTitle) return;
    const trimmed = editedTitle.trim();
    if (trimmed && trimmed !== activeAgent.title) {
      updateAgentTitle(activeAgent.id, trimmed);
    }
    setIsEditingTitle(false);
  };

  return (
    <header className="h-12 border-b border-border bg-sidebar/70 backdrop-blur-md px-2.5 sm:px-3.5 flex items-center justify-between select-none z-20 shrink-0 overflow-hidden">
      {/* Left: Mobile Menu, Head Entry (Project & Worktree), & Active Session Title */}
      <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1 overflow-hidden pr-2">
        <button
          onClick={onToggleSidebar}
          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent cursor-pointer md:hidden shrink-0"
          title="Toggle Sessions Menu"
        >
          <Menu className="w-4 h-4" />
        </button>

        {/* Head entry: Project */}
        {project && (
          <button
            type="button"
            onClick={handleSelectProject}
            className="flex items-center gap-1 sm:gap-1.5 px-1.5 py-0.5 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent/40 transition-colors truncate cursor-pointer shrink-0 max-w-[90px] sm:max-w-[130px]"
            title={`Project: ${projectName || project.name}`}
          >
            <ProjectIcon project={project} client={client} />
            <span className="truncate">{projectName || project.name}</span>
          </button>
        )}

        {/* Head entry: Worktree (if relevant) */}
        {project && isWorktree && worktreeLabel && (
          <>
            <ChevronRight className="w-3 h-3 text-muted-foreground/40 shrink-0 select-none" />
            <button
              type="button"
              onClick={handleSelectWorktree}
              className="flex items-center gap-1 sm:gap-1.5 px-1.5 py-0.5 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent/40 transition-colors truncate cursor-pointer font-mono shrink-0 max-w-[120px] sm:max-w-[160px]"
              title={worktreeTooltip || `Worktree: ${worktreeLabel}`}
            >
              <GitFork className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate">{worktreeLabel}</span>
            </button>
          </>
        )}

        {/* Breadcrumb Separator before Session Title */}
        {project && (
          <ChevronRight className="w-3 h-3 text-muted-foreground/40 shrink-0 select-none" />
        )}

        {/* Active Session Title (Editable) */}
        {isEditingTitle ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSaveTitle();
            }}
            className="flex items-center gap-1.5 min-w-0 max-w-[320px] sm:max-w-[480px] w-full"
          >
            <input
              type="text"
              value={editedTitle}
              onChange={(e) => setEditedTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") setIsEditingTitle(false);
              }}
              onBlur={handleSaveTitle}
              placeholder="Session title..."
              className="h-7 text-xs font-semibold px-2 py-0.5 w-full rounded-md bg-background border border-primary focus:outline-none text-foreground"
              autoFocus
            />
            <button
              type="submit"
              className="p-1 rounded hover:bg-accent text-primary cursor-pointer shrink-0"
              title="Save title"
            >
              <Check className="w-3.5 h-3.5" />
            </button>
          </form>
        ) : (
          <div className="group flex items-center gap-1.5 text-xs text-muted-foreground min-w-0 flex-1">
            <span
              onClick={handleStartRename}
              className="truncate font-semibold text-foreground tracking-tight hover:underline cursor-pointer min-w-0"
              title="Click to rename session"
            >
              {activeAgent?.title || activeAgent?.name || "Session"}
            </span>
            <button
              onClick={handleStartRename}
              className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-opacity cursor-pointer shrink-0 hidden sm:block"
              title="Rename session"
            >
              <Pencil className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>

      {/* Right: Controls & Badges */}
      <div className="flex items-center gap-1 sm:gap-1.5 md:gap-2 shrink-0">
        {/* Context Window Meter Pill */}
        <ContextUsagePill />

        {/* Session Token Detail Pill (Uploaded, Downloaded, Cache Hit Rate) */}
        <SessionTokenDetailPill />

        {/* Model & Mode Indicators for Large Desktop */}
        <div className="hidden 2xl:flex items-center gap-1.5 text-[11px] text-muted-foreground bg-muted/60 border border-border/30 px-2.5 py-1 rounded-full">
          <Sparkles className="w-3 h-3 text-amber-500" />
          <span className="font-medium text-foreground">
            {models.find((m) => m.id === selectedModel)?.displayName ||
              models.find((m) => m.id.endsWith(`/${selectedModel}`))?.displayName ||
              models.find((m) => m.id === selectedModel)?.name ||
              models.find((m) => m.id.endsWith(`/${selectedModel}`))?.name ||
              selectedModel.replace(/^plexus\//, "")}
          </span>
          {selectedMode && (
            <>
              <span className="text-muted-foreground/40">•</span>
              <span className="capitalize">{selectedMode}</span>
            </>
          )}
          {thinkingEffort && (
            <>
              <span className="text-muted-foreground/40">•</span>
              <span className="text-blue-500 font-mono text-[10px] uppercase">{thinkingEffort}</span>
            </>
          )}
        </div>

        {/* Status Badge */}
        <StatusBadge onClick={onOpenSettings} />

        {/* Action icons */}
        <div className="flex items-center gap-0.5 border-l border-border/60 pl-1 sm:pl-2">
          <button
            onClick={() => setSummaryMode((prev) => !prev)}
            className={cn(
              "p-1 sm:p-1.5 rounded-md cursor-pointer transition-colors",
              summaryMode
                ? "bg-primary/10 text-primary hover:bg-primary/15"
                : "text-muted-foreground hover:text-foreground hover:bg-accent",
            )}
            title={summaryMode ? "Switch to Detailed View" : "Switch to Summary Mode"}
            aria-label={summaryMode ? "Switch to Detailed View" : "Switch to Summary Mode"}
          >
            {summaryMode ? (
              <ListCollapse className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            ) : (
              <LayoutList className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            )}
          </button>

          <button
            onClick={() => createAgentTab()}
            className="p-1 sm:p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent cursor-pointer"
            title="Create New Session"
          >
            <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>

          <button
            onClick={() => setTheme(isDark ? "light" : "dark")}
            className="p-1 sm:p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent cursor-pointer"
            title="Toggle Theme"
          >
            {isDark ? (
              <Sun className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            ) : (
              <Moon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            )}
          </button>

          <button
            onClick={onOpenSettings}
            className="p-1 sm:p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent cursor-pointer"
            title="Open Settings"
          >
            <Settings className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
