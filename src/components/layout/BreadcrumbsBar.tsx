import React, { useState, useMemo } from "react";
import { useWorkspace } from "../../context/WorkspaceContext";
import { usePaseo } from "../../context/PaseoContext";
import { ProjectIcon } from "./ProjectIcon";
import { resolveActiveProjectWorktree } from "./project-worktree-utils";
import {
  Menu,
  Pencil,
  Check,
  GitFork,
  ChevronRight,
  Plus,
} from "lucide-react";
import { PressButton } from "../ui/button";

interface BreadcrumbsBarProps {
  onToggleSidebar?: () => void;
}

export function BreadcrumbsBar({ onToggleSidebar }: BreadcrumbsBarProps) {
  const {
    activeAgent,
    activeWorkspace,
    projects,
    workspaces,
    setActiveWorkspaceId,
    updateAgentTitle,
    createSession,
  } = useWorkspace();

  const { client } = usePaseo();

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
    <div
      style={{
        paddingTop: "var(--safe-area-top, 0px)",
        height: "calc(2rem + var(--safe-area-top, 0px))",
      }}
      className="min-h-8 border-b border-border/40 bg-sidebar/50 backdrop-blur-xs px-2.5 sm:px-3.5 flex items-center justify-between select-none z-20 shrink-0 overflow-hidden text-xs"
    >
      {/* Breadcrumbs trail: Project > Worktree > Active Session Title */}
      <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1 overflow-hidden pr-2">
        {onToggleSidebar && (
          <PressButton
            type="button"
            onPress={onToggleSidebar}
            className="h-8 w-8 -ml-1 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent cursor-pointer md:hidden shrink-0 touch-manipulation"
            title="Toggle Sessions Menu"
            aria-label="Toggle Sessions Menu"
          >
            <Menu className="w-4 h-4" />
          </PressButton>
        )}

        {/* Head entry: Project */}
        {project && (
          <PressButton
            type="button"
            onPress={handleSelectProject}
            className="flex items-center gap-1 sm:gap-1.5 px-1.5 py-0.5 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent/40 transition-colors truncate cursor-pointer shrink-0 max-w-[80px] sm:max-w-[180px]"
            title={`Project: ${projectName || project.name}`}
          >
            <ProjectIcon project={project} client={client} />
            <span className="truncate">{projectName || project.name}</span>
          </PressButton>
        )}

        {/* Head entry: Worktree (if relevant) */}
        {project && isWorktree && worktreeLabel && (
          <>
            <ChevronRight className="w-3 h-3 text-muted-foreground/40 shrink-0 select-none" />
            <PressButton
              type="button"
              onPress={handleSelectWorktree}
              className="flex items-center gap-1 sm:gap-1.5 px-1.5 py-0.5 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent/40 transition-colors truncate cursor-pointer font-mono shrink-0 max-w-[110px] sm:max-w-[240px]"
              title={worktreeTooltip || `Worktree: ${worktreeLabel}`}
            >
              <GitFork className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate">{worktreeLabel}</span>
            </PressButton>
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
            className="flex items-center gap-1.5 min-w-0 max-w-[320px] sm:max-w-[520px] w-full"
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
              className="h-6 text-xs font-semibold px-2 py-0.5 w-full rounded-md bg-background border border-primary focus:outline-none text-foreground"
              autoFocus
            />
            <button
              type="submit"
              className="p-1 rounded hover:bg-accent text-primary cursor-pointer shrink-0"
              title="Save title"
            >
              <Check className="w-3 h-3" />
            </button>
          </form>
        ) : (
          <div className="group flex items-center gap-1.5 text-xs text-muted-foreground min-w-0 flex-1">
            <PressButton
              onPress={handleStartRename}
              className="truncate font-semibold text-left text-foreground tracking-tight hover:underline cursor-pointer min-w-0"
              title="Click to rename session"
            >
              {activeAgent?.title || activeAgent?.name || "Session"}
            </PressButton>
            <PressButton
              type="button"
              onPress={handleStartRename}
              className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-opacity cursor-pointer shrink-0 hidden sm:block"
              title="Rename session"
            >
              <Pencil className="w-3 h-3" />
            </PressButton>
          </div>
        )}
      </div>

      {/* Right action: New Session button */}
      <div className="flex items-center gap-1 shrink-0">
        <PressButton
          type="button"
          onPress={async () => {
            const targetWsId =
              worktreeWorkspace?.id || directWorkspace?.id || project?.id || activeWorkspace?.id;
            await createSession(undefined, targetWsId);
          }}
          className="h-7 w-7 sm:w-auto sm:px-2 flex items-center justify-center gap-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/60 cursor-pointer transition-colors touch-manipulation text-xs shrink-0"
          title={`New session in ${worktreeLabel || projectName || "workspace"}`}
          aria-label={`New session in ${worktreeLabel || projectName || "workspace"}`}
        >
          <Plus className="w-3.5 h-3.5 pointer-events-none" />
          <span className="hidden sm:inline">New Session</span>
        </PressButton>
      </div>
    </div>
  );
}
