import React from "react";
import { useWorkspace } from "../../context/WorkspaceContext";
import { TerminalDrawer } from "./TerminalDrawer";
import { ChangesDrawer } from "./ChangesDrawer";
import { Terminal, GitCommit, ChevronDown } from "lucide-react";

export function BottomDrawer() {
  const {
    drawerOpen,
    activeDrawerTab,
    setActiveDrawerTab,
    setDrawerOpen,
    gitStatus,
  } = useWorkspace();

  const changedCount =
    (gitStatus?.stagedFiles.length || 0) + (gitStatus?.unstagedFiles.length || 0);

  if (!drawerOpen) return null;

  return (
    <div className="flex flex-col h-full bg-card">
      {/* Drawer Tab Header */}
      <div className="h-8 border-b border-border bg-sidebar/50 px-3 flex items-center justify-between select-none">
        <div className="flex items-center gap-2">
          {/* Terminal Tab */}
          <button
            onClick={() => setActiveDrawerTab("terminal")}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer transition-colors ${
              activeDrawerTab === "terminal"
                ? "bg-primary/10 text-primary font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>Terminal</span>
          </button>

          {/* Changes Tab */}
          <button
            onClick={() => setActiveDrawerTab("changes")}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer transition-colors ${
              activeDrawerTab === "changes"
                ? "bg-primary/10 text-primary font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <GitCommit className="w-3.5 h-3.5" />
            <span>Git Changes</span>
            {changedCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-500/20 text-amber-600 dark:text-amber-400 font-mono">
                {changedCount}
              </span>
            )}
          </button>
        </div>

        {/* Close Button */}
        <button
          onClick={() => setDrawerOpen(false)}
          className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
          title="Close Drawer"
        >
          <ChevronDown className="w-4 h-4" />
        </button>
      </div>

      {/* Drawer Content */}
      <div className="flex-1 min-h-0">
        {activeDrawerTab === "terminal" ? <TerminalDrawer /> : <ChangesDrawer />}
      </div>
    </div>
  );
}
