import React, { useState } from "react";
import { useWorkspace } from "../../context/WorkspaceContext";
import { useTheme } from "../../context/ThemeContext";
import { StatusBadge } from "./StatusBadge";
import {
  Settings,
  Sun,
  Moon,
  Plus,
  Sparkles,
  Menu,
  Pencil,
  Check,
} from "lucide-react";

interface TopRailProps {
  onOpenSettings: () => void;
  onToggleSidebar: () => void;
}

export function TopRail({ onOpenSettings, onToggleSidebar }: TopRailProps) {
  const {
    activeAgent,
    models,
    selectedModel,
    selectedMode,
    thinkingEffort,
    createAgentTab,
    updateAgentTitle,
  } = useWorkspace();

  const { isDark, setTheme } = useTheme();

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState("");

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
      {/* Left: Mobile Menu & Active Session Title */}
      <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden pr-2">
        <button
          onClick={onToggleSidebar}
          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent cursor-pointer md:hidden shrink-0"
          title="Toggle Sessions Menu"
        >
          <Menu className="w-4 h-4" />
        </button>

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
          <div className="group flex items-center gap-1.5 text-xs text-muted-foreground min-w-0 truncate">
            <span
              onClick={handleStartRename}
              className="truncate font-semibold text-foreground tracking-tight hover:underline cursor-pointer"
              title="Click to rename session"
            >
              {activeAgent?.title || activeAgent?.name || "Session"}
            </span>
            <button
              onClick={handleStartRename}
              className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-opacity cursor-pointer shrink-0"
              title="Rename session"
            >
              <Pencil className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>

      {/* Right: Controls & Badges */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        {/* Model & Mode Indicators for Desktop */}
        <div className="hidden lg:flex items-center gap-1.5 text-[11px] text-muted-foreground bg-muted/60 border border-border/30 px-2.5 py-1 rounded-full">
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
        <div className="flex items-center gap-0.5 border-l border-border/60 pl-1.5 sm:pl-2">
          <button
            onClick={() => createAgentTab()}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent cursor-pointer"
            title="Create New Session"
          >
            <Plus className="w-4 h-4" />
          </button>

          <button
            onClick={() => setTheme(isDark ? "light" : "dark")}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent cursor-pointer"
            title="Toggle Theme"
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          <button
            onClick={onOpenSettings}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent cursor-pointer"
            title="Open Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
