import React, { useState } from "react";
import { useWorkspace } from "../../context/WorkspaceContext";
import { formatDate, formatTime } from "../../lib/utils";
import {
  MessageSquare,
  Plus,
  Layers,
  Loader2,
  FolderOpen,
  X,
} from "lucide-react";

interface SidebarProps {
  onCloseMobile?: () => void;
}

export function Sidebar({ onCloseMobile }: SidebarProps) {
  const {
    activeWorkspace,
    agents,
    activeAgentId,
    setActiveAgentId,
    createSession,
    isTurnRunning,
  } = useWorkspace();

  const [hoveredAgentId, setHoveredAgentId] = useState<string | null>(null);

  // Group agents by date
  const groupedAgents = agents.reduce((acc, agent) => {
    const groupKey = formatDate(agent.createdAt || agent.updatedAt) || "Recent";
    if (!acc[groupKey]) acc[groupKey] = [];
    acc[groupKey].push(agent);
    return acc;
  }, {} as Record<string, typeof agents>);

  const handleSelectSession = (agentId: string) => {
    setActiveAgentId(agentId);
    if (onCloseMobile) {
      onCloseMobile();
    }
  };

  const handleNewSession = async () => {
    await createSession();
    if (onCloseMobile) {
      onCloseMobile();
    }
  };

  return (
    <aside className="w-64 border-r border-border bg-sidebar/50 flex flex-col h-full shrink-0 select-none">
      {/* Workspace Header */}
      <div className="h-12 border-b border-border px-3.5 flex items-center justify-between">
        <div className="flex items-center gap-2 overflow-hidden">
          <Layers className="w-4 h-4 text-primary shrink-0" />
          <span className="text-xs font-semibold text-sidebar-foreground truncate">
            {activeWorkspace?.name || "Workspace"}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={handleNewSession}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer shadow-2xs transition-colors"
            title="New Chat Session"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New</span>
          </button>

          {onCloseMobile && (
            <button
              onClick={onCloseMobile}
              className="p-1 rounded-md text-muted-foreground hover:text-foreground md:hidden cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Session List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-4">
        {Object.keys(groupedAgents).length === 0 ? (
          <div className="text-center py-8 px-4 text-muted-foreground">
            <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-xs font-medium">No sessions yet</p>
            <p className="text-[11px] text-muted-foreground/80 mt-1">
              Start a new conversation to begin coding with Paseo.
            </p>
            <button
              onClick={handleNewSession}
              className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              New Session
            </button>
          </div>
        ) : (
          Object.entries(groupedAgents).map(([group, groupAgents]) => (
            <div key={group} className="space-y-1">
              <div className="px-2 py-1 text-[10px] font-semibold tracking-wider text-muted-foreground/70 uppercase">
                {group}
              </div>
              <div className="space-y-0.5">
                {groupAgents.map((agent) => {
                  const isActive = agent.id === activeAgentId;
                  const isAgentRunning = agent.status === "running" || (isActive && isTurnRunning);

                  return (
                    <div
                      key={agent.id}
                      onMouseEnter={() => setHoveredAgentId(agent.id)}
                      onMouseLeave={() => setHoveredAgentId(null)}
                      onClick={() => handleSelectSession(agent.id)}
                      className={`group relative flex items-center justify-between px-2.5 py-2 rounded-lg text-xs cursor-pointer transition-colors ${
                        isActive
                          ? "bg-accent text-accent-foreground font-medium shadow-2xs"
                          : "text-sidebar-foreground/80 hover:bg-accent/60 hover:text-sidebar-foreground"
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        {isAgentRunning ? (
                          <Loader2 className="w-3 h-3 animate-spin text-amber-500 shrink-0" />
                        ) : (
                          <span
                            className={`w-2 h-2 rounded-full shrink-0 ${
                              isActive ? "bg-primary" : "bg-muted-foreground/40"
                            }`}
                          />
                        )}
                        <span className="truncate text-xs">
                          {agent.title || agent.name || "Untitled Session"}
                        </span>
                      </div>

                      <div className="flex items-center gap-1 shrink-0 text-[10px] text-muted-foreground ml-1.5">
                        <span className="group-hover:hidden">
                          {formatTime(agent.updatedAt || agent.createdAt)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer / Worktree Info */}
      {activeWorkspace?.path && (
        <div className="p-2.5 border-t border-border/60 bg-muted/20 text-[11px] text-muted-foreground truncate flex items-center gap-1.5">
          <FolderOpen className="w-3.5 h-3.5 shrink-0 text-muted-foreground/70" />
          <span className="truncate font-mono">{activeWorkspace.path}</span>
        </div>
      )}
    </aside>
  );
}
