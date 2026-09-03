import React, { useState } from "react";
import { useWorkspace, type WorkspaceTabItem } from "../../context/WorkspaceContext";
import { Sparkles, Terminal, GitCommit, X, Loader2, Pencil } from "lucide-react";

export function WorkspaceTabsRow() {
  const {
    workspaceTabs,
    activeTab,
    setActiveTab,
    closeTab,
    createAgentTab,
    createTerminalTab,
    openChangesTab,
    renameTab,
    gitStatus,
  } = useWorkspace();

  const [renamingTabId, setRenamingTabId] = useState<string | null>(null);
  const [renamingTitle, setRenamingTitle] = useState("");

  const changedFilesCount =
    (gitStatus?.stagedFiles?.length || 0) + (gitStatus?.unstagedFiles?.length || 0);

  const startRename = (tab: WorkspaceTabItem) => {
    if (tab.kind === "changes") return;
    setRenamingTabId(tab.id);
    setRenamingTitle(tab.title);
  };

  const handleSaveRename = (tab: WorkspaceTabItem) => {
    if (renamingTabId !== tab.id) return;
    const trimmed = renamingTitle.trim();
    if (trimmed && trimmed !== tab.title) {
      renameTab(tab, trimmed);
    }
    setRenamingTabId(null);
  };

  return (
    <div className="h-9 bg-sidebar/50 border-b border-border flex items-center justify-between px-2 gap-1 select-none shrink-0 z-10 overflow-hidden">
      {/* Tabs list */}
      <div className="flex items-center gap-1 min-w-0 flex-1 h-full pt-1 overflow-hidden">
        {workspaceTabs.map((tab) => {
          const isActive =
            activeTab?.kind === tab.kind && activeTab?.targetId === tab.targetId;
          const isEditing = renamingTabId === tab.id;

          return (
            <div
              key={tab.id}
              onClick={() => setActiveTab(tab)}
              onDoubleClick={(e) => {
                e.stopPropagation();
                startRename(tab);
              }}
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
              ) : tab.kind === "terminal" ? (
                <Terminal
                  className={`w-3.5 h-3.5 shrink-0 ${
                    isActive ? "text-amber-500" : "text-amber-500/70"
                  }`}
                />
              ) : (
                <GitCommit
                  className={`w-3.5 h-3.5 shrink-0 ${
                    isActive ? "text-amber-500" : "text-amber-500/70"
                  }`}
                />
              )}

              {/* Title or Inline Edit Form */}
              {isEditing ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSaveRename(tab);
                  }}
                  className="min-w-0 flex-1"
                >
                  <input
                    type="text"
                    value={renamingTitle}
                    onChange={(e) => setRenamingTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") setRenamingTabId(null);
                    }}
                    onBlur={() => handleSaveRename(tab)}
                    className="w-full h-5 text-xs bg-background border border-primary rounded px-1 outline-none text-foreground font-medium"
                    autoFocus
                  />
                </form>
              ) : (
                <span className="truncate text-xs min-w-0 flex-1">{tab.title}</span>
              )}

              {/* Actions on hover */}
              {!isEditing && (
                <div className="flex items-center gap-0.5 shrink-0">
                  {tab.kind !== "changes" && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        startRename(tab);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground cursor-pointer transition-opacity"
                      title="Rename tab"
                    >
                      <Pencil className="w-2.5 h-2.5" />
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      closeTab(tab);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground cursor-pointer transition-opacity"
                    title={`Close ${tab.kind === "agent" ? "session" : tab.kind === "terminal" ? "terminal" : "changes"}`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {/* 3 New Tab Action Buttons: Agent, Terminal, Changes */}
        <div className="flex items-center gap-0.5 shrink-0 pl-1 border-l border-border/40 ml-1">
          <button
            type="button"
            onClick={() => createAgentTab()}
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent cursor-pointer transition-colors"
            title="New Agent Session"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          </button>

          <button
            type="button"
            onClick={() => createTerminalTab()}
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent cursor-pointer transition-colors"
            title="New Terminal"
          >
            <Terminal className="w-3.5 h-3.5 text-amber-500" />
          </button>

          <button
            type="button"
            onClick={() => openChangesTab()}
            className={`p-1 rounded-md cursor-pointer transition-colors relative ${
              activeTab?.kind === "changes"
                ? "bg-accent text-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-accent"
            }`}
            title="Git Changes"
          >
            <GitCommit className="w-3.5 h-3.5 text-amber-500" />
            {changedFilesCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-amber-500" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
