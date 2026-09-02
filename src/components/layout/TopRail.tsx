import React from "react";
import { useWorkspace } from "../../context/WorkspaceContext";
import { useTheme } from "../../context/ThemeContext";
import { StatusBadge } from "./StatusBadge";
import {
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
    activeAgent,
    models,
    selectedModel,
    selectedMode,
    thinkingEffort,
    drawerOpen,
    activeDrawerTab,
    toggleDrawer,
    gitStatus,
    createSession,
    workspaceTabs,
    activeTab,
    setActiveTab,
    createTerminalTab,
  } = useWorkspace();

  const { isDark, setTheme } = useTheme();

  const handleTerminalClick = () => {
    const existingTerminalTab = workspaceTabs.find((t) => t.kind === "terminal");
    if (existingTerminalTab) {
      setActiveTab(existingTerminalTab);
    } else {
      createTerminalTab();
    }
  };

  const changedFilesCount =
    (gitStatus?.stagedFiles?.length || 0) + (gitStatus?.unstagedFiles?.length || 0);

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

        {/* Active Session Title */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground min-w-0 truncate">
          <span className="truncate font-semibold text-foreground tracking-tight">
            {activeAgent?.title || activeAgent?.name || "Session"}
          </span>
        </div>
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

        {/* Drawer & View Toggles */}
        <div className="flex items-center gap-1 border-l border-border/60 pl-1.5 sm:pl-2">
          <button
            onClick={handleTerminalClick}
            className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer transition-colors ${
              activeTab?.kind === "terminal"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground hover:bg-accent"
            }`}
            title="Switch to or Open Terminal Tab"
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
