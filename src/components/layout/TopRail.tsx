import React, { useState } from "react";
import { useWorkspace } from "../../context/WorkspaceContext";
import { useTheme } from "../../context/ThemeContext";
import { StatusBadge } from "./StatusBadge";
import {
  Folder,
  ChevronDown,
  Terminal,
  GitCommit,
  Settings,
  Sun,
  Moon,
  Plus,
  Sparkles,
  Menu,
} from "lucide-react";

interface TopRailProps {
  onOpenSettings: () => void;
  onToggleSidebar: () => void;
}

export function TopRail({ onOpenSettings, onToggleSidebar }: TopRailProps) {
  const {
    workspaces,
    activeWorkspaceId,
    activeWorkspace,
    setActiveWorkspaceId,
    activeAgent,
    selectedModel,
    selectedMode,
    thinkingEffort,
    drawerOpen,
    activeDrawerTab,
    toggleDrawer,
    gitStatus,
    createSession,
  } = useWorkspace();

  const { isDark, setTheme } = useTheme();
  const [projectDropdownOpen, setProjectDropdownOpen] = useState(false);

  const changedFilesCount =
    (gitStatus?.stagedFiles.length || 0) + (gitStatus?.unstagedFiles.length || 0);

  return (
    <header className="h-12 border-b border-border bg-sidebar/70 backdrop-blur-md px-2.5 sm:px-3.5 flex items-center justify-between select-none z-20 shrink-0">
      {/* Left: Mobile Menu & Project Selector */}
      <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
        <button
          onClick={onToggleSidebar}
          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent cursor-pointer md:hidden shrink-0"
          title="Toggle Sessions Menu"
        >
          <Menu className="w-4 h-4" />
        </button>

        <div className="relative">
          <button
            onClick={() => setProjectDropdownOpen(!projectDropdownOpen)}
            className="flex items-center gap-1.5 sm:gap-2 px-2 py-1 rounded-md text-xs font-medium text-foreground hover:bg-accent cursor-pointer transition-colors border border-border/40 max-w-[140px] sm:max-w-[200px]"
          >
            <Folder className="w-3.5 h-3.5 text-primary shrink-0" />
            <span className="font-semibold truncate">
              {activeWorkspace?.name || "Select Project"}
            </span>
            <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0" />
          </button>

          {projectDropdownOpen && (
            <>
              <div
                className="fixed inset-0 z-30"
                onClick={() => setProjectDropdownOpen(false)}
              />
              <div className="absolute left-0 top-full mt-1.5 w-64 rounded-xl bg-card border border-border shadow-xl p-1 z-40">
                <div className="px-2 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Projects / Workspaces
                </div>
                <div className="max-h-60 overflow-y-auto space-y-0.5">
                  {workspaces.map((w) => (
                    <button
                      key={w.id}
                      onClick={() => {
                        setActiveWorkspaceId(w.id);
                        setProjectDropdownOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs text-left cursor-pointer ${
                        w.id === activeWorkspaceId
                          ? "bg-primary/10 text-primary font-medium"
                          : "text-foreground hover:bg-accent"
                      }`}
                    >
                      <div className="truncate">
                        <div className="font-medium truncate">{w.name}</div>
                        <div className="text-[10px] text-muted-foreground font-mono truncate">
                          {w.path}
                        </div>
                      </div>
                      {w.id === activeWorkspaceId && (
                        <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0 ml-2" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        <span className="text-muted-foreground/40 hidden sm:inline">/</span>

        {/* Active Session Title */}
        <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground max-w-[200px] truncate">
          <span className="truncate font-medium text-foreground">
            {activeAgent?.title || activeAgent?.name || "Session"}
          </span>
        </div>
      </div>

      {/* Right: Controls & Badges */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        {/* Model & Mode Indicators for Desktop */}
        <div className="hidden lg:flex items-center gap-1.5 text-[11px] text-muted-foreground bg-muted/60 border border-border/30 px-2.5 py-1 rounded-full">
          <Sparkles className="w-3 h-3 text-amber-500" />
          <span className="font-medium text-foreground">{selectedModel}</span>
          <span className="text-muted-foreground/40">•</span>
          <span className="capitalize">{selectedMode}</span>
          {thinkingEffort && (
            <>
              <span className="text-muted-foreground/40">•</span>
              <span className="text-blue-500 font-mono text-[10px] uppercase">{thinkingEffort}</span>
            </>
          )}
        </div>

        {/* Status Badge */}
        <StatusBadge onClick={onOpenSettings} />

        {/* Drawer Toggles */}
        <div className="flex items-center gap-1 border-l border-border/60 pl-1.5 sm:pl-2">
          <button
            onClick={() => toggleDrawer("terminal")}
            className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer transition-colors ${
              drawerOpen && activeDrawerTab === "terminal"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground hover:bg-accent"
            }`}
            title="Toggle Integrated Terminal"
          >
            <Terminal className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Terminal</span>
          </button>

          <button
            onClick={() => toggleDrawer("changes")}
            className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer transition-colors ${
              drawerOpen && activeDrawerTab === "changes"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground hover:bg-accent"
            }`}
            title="Toggle Git Changes & Diffs"
          >
            <GitCommit className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Changes</span>
            {changedFilesCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-500/20 text-amber-600 dark:text-amber-400 font-mono">
                {changedFilesCount}
              </span>
            )}
          </button>
        </div>

        {/* Action icons */}
        <div className="flex items-center gap-0.5 border-l border-border/60 pl-1.5 sm:pl-2">
          <button
            onClick={() => createSession()}
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
