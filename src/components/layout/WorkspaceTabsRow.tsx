import React from "react";
import { useWorkspace } from "../../context/WorkspaceContext";
import { Sparkles, Terminal, Plus, X, Loader2 } from "lucide-react";

export function WorkspaceTabsRow() {
  const {
    workspaceTabs,
    activeTab,
    setActiveTab,
    closeTab,
    createAgentTab,
    createTerminalTab,
  } = useWorkspace();

  return (
    <div className="h-9 bg-sidebar/50 border-b border-border flex items-center justify-between px-2 gap-1 select-none shrink-0 z-10 overflow-hidden">
      {/* Tabs list */}
      <div className="flex items-center gap-1 min-w-0 flex-1 h-full pt-1 overflow-hidden">
        {workspaceTabs.map((tab) => {
          const isActive =
            activeTab?.kind === tab.kind && activeTab?.targetId === tab.targetId;

          return (
            <div
              key={tab.id}
              onClick={() => setActiveTab(tab)}
              className={`group flex items-center gap-1.5 px-2 sm:px-2.5 h-8 rounded-t-md text-xs cursor-pointer transition-all flex-1 min-w-[60px] max-w-[200px] border-t border-x ${
                isActive
                  ? "bg-background text-foreground font-medium border-t-2 border-t-amber-500 border-x-border/50 shadow-2xs"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/40 border-transparent"
              }`}
              title={tab.title}
            >
              {/* Tab Icon & Status */}
              {tab.kind === "agent" ? (
                tab.status === "running" ? (
                  <Loader2 className="w-3.5 h-3.5 text-amber-500 animate-spin shrink-0" />
                ) : (
                  <Sparkles
                    className={`w-3.5 h-3.5 shrink-0 ${
                      isActive ? "text-amber-500" : "text-amber-500/70"
                    }`}
                  />
                )
              ) : (
                <Terminal
                  className={`w-3.5 h-3.5 shrink-0 ${
                    isActive ? "text-amber-500" : "text-amber-500/70"
                  }`}
                />
              )}

              {/* Title */}
              <span className="truncate text-xs min-w-0 flex-1">{tab.title}</span>

              {/* Close Tab Button */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  closeTab(tab);
                }}
                className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground cursor-pointer transition-opacity shrink-0"
                title={`Close ${tab.kind === "agent" ? "session" : "terminal"}`}
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          );
        })}

        {/* New Tab Buttons: New Session (+) & New Terminal */}
        <div className="flex items-center gap-0.5 shrink-0 pl-1">
          <button
            type="button"
            onClick={() => createAgentTab()}
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/60 cursor-pointer transition-colors"
            title="New Chat Session"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => createTerminalTab()}
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/60 cursor-pointer transition-colors"
            title="New Terminal"
          >
            <Terminal className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
