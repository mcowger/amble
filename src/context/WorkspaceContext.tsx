import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { usePaseo } from "./PaseoContext";
import type {
  WorkspaceItem,
  AgentSnapshot,
  TimelineItem,
  AgentModel,
  AgentMode,
  GitStatusSummary,
  TerminalSessionInfo,
  UserMessageTimelineItem,
  AssistantMessageTimelineItem,
  ReasoningTimelineItem,
  ToolCallTimelineItem,
  TodoTimelineItem,
} from "../lib/paseo/types";

interface WorkspaceContextType {
  workspaces: WorkspaceItem[];
  activeWorkspaceId: string | null;
  activeWorkspace: WorkspaceItem | null;
  setActiveWorkspaceId: (id: string | null) => void;
  refreshWorkspaces: () => Promise<void>;

  agents: AgentSnapshot[];
  activeAgentId: string | null;
  activeAgent: AgentSnapshot | null;
  setActiveAgentId: (id: string | null) => void;
  refreshAgents: () => Promise<void>;

  timeline: TimelineItem[];
  isTimelineLoading: boolean;
  refreshTimeline: (agentId?: string) => Promise<void>;

  models: AgentModel[];
  selectedModel: string;
  setSelectedModel: (model: string) => void;
  
  modes: AgentMode[];
  selectedMode: string;
  setSelectedMode: (mode: string) => void;

  thinkingEffort: string;
  setThinkingEffort: (effort: string) => void;

  isTurnRunning: boolean;
  sendMessage: (text: string, attachments?: string[]) => Promise<void>;
  createSession: (initialPrompt?: string) => Promise<AgentSnapshot | null>;
  cancelTurn: () => Promise<void>;

  // Drawer
  drawerOpen: boolean;
  activeDrawerTab: "terminal" | "changes";
  setDrawerOpen: (open: boolean) => void;
  setActiveDrawerTab: (tab: "terminal" | "changes") => void;
  toggleDrawer: (tab?: "terminal" | "changes") => void;

  // Git Status
  gitStatus: GitStatusSummary | null;
  refreshGitStatus: () => Promise<void>;
  commitGitChanges: (message: string) => Promise<void>;

  // Terminals
  terminals: TerminalSessionInfo[];
  activeTerminalSlot: number | null;
  setActiveTerminalSlot: (slot: number | null) => void;
  createTerminal: () => Promise<number | null>;
  refreshTerminals: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const { client, connectionState } = usePaseo();

  const [workspaces, setWorkspaces] = useState<WorkspaceItem[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceIdState] = useState<string | null>(null);

  const [agents, setAgents] = useState<AgentSnapshot[]>([]);
  const [activeAgentId, setActiveAgentIdState] = useState<string | null>(null);

  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [isTimelineLoading, setIsTimelineLoading] = useState<boolean>(false);

  const [models, setModels] = useState<AgentModel[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>("plexus/gemini-3.7-flash");

  const [modes, setModes] = useState<AgentMode[]>([]);
  const [selectedMode, setSelectedMode] = useState<string>("build");

  const [thinkingEffort, setThinkingEffort] = useState<string>("medium");

  const [isTurnRunning, setIsTurnRunning] = useState<boolean>(false);

  // Drawer
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);
  const [activeDrawerTab, setActiveDrawerTab] = useState<"terminal" | "changes">("terminal");

  // Git & Terminals
  const [gitStatus, setGitStatus] = useState<GitStatusSummary | null>(null);
  const [terminals, setTerminals] = useState<TerminalSessionInfo[]>([]);
  const [activeTerminalSlot, setActiveTerminalSlot] = useState<number | null>(null);

  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId) || null;
  const activeAgent = agents.find((a) => a.id === activeAgentId) || null;

  // Refresh workspaces
  const refreshWorkspaces = useCallback(async () => {
    if (client.getState() !== "connected") return;
    try {
      const res = await client.fetchWorkspaces();
      const list: WorkspaceItem[] = [];

      if (res && Array.isArray(res.entries)) {
        for (const entry of res.entries) {
          list.push({
            id: entry.id,
            name: entry.title || entry.name || entry.projectDisplayName || entry.id,
            path: entry.workspaceDirectory || entry.projectRootPath || "",
            isFavorite: !!entry.pinnedAt,
          });
        }
      }

      if (res && Array.isArray(res.emptyProjects)) {
        for (const p of res.emptyProjects) {
          list.push({
            id: p.projectId,
            name: p.projectDisplayName || p.projectCustomName || p.projectId,
            path: p.projectRootPath || "",
          });
        }
      }

      if (list.length > 0) {
        setWorkspaces(list);
        if (!activeWorkspaceId) {
          const tmp = list.find((w) => w.name.toLowerCase() === "tmp" || w.path.endsWith("/tmp") || w.id.includes("tmp"));
          const chosen = tmp ? tmp.id : list[0]!.id;
          setActiveWorkspaceIdState(chosen);
        }
      }
    } catch (err) {
      console.warn("[WorkspaceProvider] fetchWorkspaces error:", err);
    }
  }, [client, activeWorkspaceId]);

  // Refresh agents for active workspace
  const refreshAgents = useCallback(async () => {
    if (client.getState() !== "connected") return;
    try {
      const res = await client.fetchAgents(activeWorkspaceId || undefined);
      const list: AgentSnapshot[] = [];

      if (res && Array.isArray(res.entries)) {
        for (const entry of res.entries) {
          if (entry.agent) {
            list.push(entry.agent);
          } else if (entry.id) {
            list.push(entry);
          }
        }
      } else if (res && Array.isArray(res.agents)) {
        list.push(...res.agents);
      }

      setAgents(list);
      if (list.length > 0 && !activeAgentId) {
        setActiveAgentIdState(list[0]!.id);
      }
    } catch (err) {
      console.warn("[WorkspaceProvider] fetchAgents error:", err);
    }
  }, [client, activeWorkspaceId, activeAgentId]);

  // Refresh timeline for active agent
  const refreshTimeline = useCallback(
    async (targetAgentId?: string) => {
      const id = targetAgentId || activeAgentId;
      if (!id || client.getState() !== "connected") return;
      setIsTimelineLoading(true);
      try {
        const res = await client.fetchAgentTimeline(id);
        if (res && Array.isArray(res.entries)) {
          const items: TimelineItem[] = [];
          for (const e of res.entries) {
            if (e.item) {
              items.push(e.item);
            } else if (e.type) {
              items.push(e);
            }
          }
          setTimeline(items);
        } else {
          setTimeline([]);
        }
      } catch (err) {
        console.warn("[WorkspaceProvider] fetchAgentTimeline error:", err);
      } finally {
        setIsTimelineLoading(false);
      }
    },
    [client, activeAgentId],
  );

  // Refresh providers & models
  const refreshProviders = useCallback(async () => {
    if (client.getState() !== "connected") return;
    try {
      const res = await client.getProvidersSnapshot();
      if (!res) return;

      const compact = res.compactSnapshot || res.snapshot || res;
      const providerEntries = compact.entries || res.entries || [];
      const thinkingSets = compact.thinkingSets || [];

      const parsedModels: AgentModel[] = [];
      const parsedModes: AgentMode[] = [];

      for (const p of providerEntries) {
        if (p.enabled === false) continue;

        if (Array.isArray(p.models)) {
          for (const m of p.models) {
            const thinkingSetIdx = typeof m.thinkingSet === "number" ? m.thinkingSet : -1;
            const tSet =
              thinkingSetIdx >= 0 && thinkingSets[thinkingSetIdx]
                ? thinkingSets[thinkingSetIdx].options
                : undefined;

            parsedModels.push({
              id: m.id,
              name: m.label || m.name || m.id,
              displayName: m.label || m.name,
              provider: m.metadata?.providerId || p.provider || "custom",
              providerName: m.metadata?.providerName || p.label || p.provider,
              description: m.description,
              contextWindow: m.metadata?.contextWindowMaxTokens || m.contextWindow,
              outputLimit: m.metadata?.limit?.output,
              reasoningSupported: thinkingSetIdx >= 0,
              thinkingSetIndex: thinkingSetIdx,
              thinkingOptions: tSet,
              cost: m.metadata?.cost,
            });
          }
        }

        if (Array.isArray(p.modes)) {
          for (const mode of p.modes) {
            if (!parsedModes.some((existing) => existing.id === mode.id)) {
              parsedModes.push({
                id: mode.id,
                name: mode.label || mode.name || mode.id,
                description: mode.description,
                icon: mode.icon,
                colorTier: mode.colorTier,
              });
            }
          }
        }
      }

      if (parsedModels.length > 0) {
        setModels(parsedModels);
        setSelectedModel((prev) => {
          const exists = parsedModels.some((m) => m.id === prev);
          return exists ? prev : (parsedModels[0]?.id ?? prev);
        });
      }

      if (parsedModes.length > 0) {
        setModes(parsedModes);
        setSelectedMode((prev) => {
          const exists = parsedModes.some((m) => m.id === prev);
          return exists ? prev : (parsedModes[0]?.id ?? prev);
        });
      }
    } catch (err) {
      console.warn("[WorkspaceProvider] refreshProviders error:", err);
    }
  }, [client]);

  // Refresh Git status
  const refreshGitStatus = useCallback(async () => {
    if (!activeWorkspaceId || client.getState() !== "connected") return;
    try {
      const res = await client.getGitStatus(activeWorkspaceId);
      if (res) {
        setGitStatus(res);
      }
    } catch (err) {
      console.warn("[WorkspaceProvider] getGitStatus error:", err);
    }
  }, [client, activeWorkspaceId]);

  // Refresh terminals
  const refreshTerminals = useCallback(async () => {
    if (client.getState() !== "connected") return;
    try {
      const res = await client.listTerminals(activeWorkspaceId || undefined);
      if (res && Array.isArray(res.terminals)) {
        setTerminals(res.terminals);
        if (res.terminals.length > 0 && activeTerminalSlot === null) {
          setActiveTerminalSlot(res.terminals[0]!.slot);
        }
      }
    } catch (err) {
      console.warn("[WorkspaceProvider] listTerminals error:", err);
    }
  }, [client, activeWorkspaceId, activeTerminalSlot]);

  // On connection state change to connected
  useEffect(() => {
    if (connectionState === "connected") {
      refreshWorkspaces();
      refreshTerminals();
      refreshProviders();
    }
  }, [connectionState, refreshWorkspaces, refreshTerminals, refreshProviders]);

  // When active workspace changes
  useEffect(() => {
    if (activeWorkspaceId && connectionState === "connected") {
      refreshAgents();
      refreshGitStatus();
    }
  }, [activeWorkspaceId, connectionState, refreshAgents, refreshGitStatus]);

  // When active agent changes
  useEffect(() => {
    if (activeAgentId && connectionState === "connected") {
      refreshTimeline(activeAgentId);
      client.setAgentTimelineSubscription([activeAgentId]).catch(console.warn);
      if (activeAgent) {
        setIsTurnRunning(activeAgent.status === "running");
      }
    }
  }, [activeAgentId, connectionState, refreshTimeline, client, activeAgent]);

  // Listen to live agent stream and updates
  useEffect(() => {
    const unsubStream = client.on("agent_stream", (payload: any) => {
      if (!payload) return;
      const streamAgentId = payload.agentId;
      const event = payload.event || payload;
      
      // Only process events for current active session
      if (streamAgentId && activeAgentId && streamAgentId !== activeAgentId) {
        return;
      }

      if (event.type === "turn_started") {
        setIsTurnRunning(true);
      } else if (
        event.type === "turn_completed" ||
        event.type === "turn_failed" ||
        event.type === "turn_canceled"
      ) {
        setIsTurnRunning(false);
        // Mark all reasoning blocks as non-streaming
        setTimeline((prev) =>
          prev.map((item) =>
            item.type === "reasoning" && item.isStreaming
              ? { ...item, isStreaming: false }
              : item,
          ),
        );
        // Refresh agent list and timeline state when turn completes
        refreshAgents();
      } else if (event.type === "timeline" && event.item) {
        const item: TimelineItem = event.item;

        setTimeline((prev) => {
          const next = [...prev];

          // 1. Tool Calls
          if (item.type === "tool_call" && item.callId) {
            const idx = next.findIndex(
              (p) => p.type === "tool_call" && p.callId === item.callId,
            );
            if (idx >= 0) {
              next[idx] = { ...next[idx], ...item };
              return next;
            }
            return [...next, item];
          }

          // 2. Assistant Messages (smart cumulative vs delta streaming)
          if (item.type === "assistant_message") {
            const msgId = item.messageId;
            if (msgId) {
              const idx = next.findIndex(
                (p) =>
                  p.type === "assistant_message" &&
                  (p as AssistantMessageTimelineItem).messageId === msgId,
              );
              if (idx >= 0) {
                const existing = next[idx] as AssistantMessageTimelineItem;
                const prevText = existing.text || "";
                const chunkText = item.text || "";

                let nextText = prevText;
                if (chunkText.startsWith(prevText)) {
                  nextText = chunkText;
                } else if (prevText.endsWith(chunkText) && chunkText.length > 0) {
                  nextText = prevText;
                } else {
                  nextText = prevText + chunkText;
                }

                next[idx] = {
                  ...item,
                  text: nextText,
                };
                return next;
              }
            }
            return [...next, { ...item }];
          }

          // 3. Reasoning / Thinking Traces (smart cumulative vs delta streaming)
          if (item.type === "reasoning") {
            const lastIdx = next.length - 1;
            const last = next[lastIdx];
            if (last && last.type === "reasoning" && (last as ReasoningTimelineItem).isStreaming) {
              const prevText = (last as ReasoningTimelineItem).text || "";
              const chunkText = item.text || "";

              let nextText = prevText;
              if (chunkText.startsWith(prevText)) {
                nextText = chunkText;
              } else if (prevText.endsWith(chunkText) && chunkText.length > 0) {
                nextText = prevText;
              } else {
                nextText = prevText + chunkText;
              }

              next[lastIdx] = {
                ...item,
                text: nextText,
                isStreaming: true,
              };
              return next;
            }
            return [...next, { ...item, isStreaming: true }];
          }

          // 4. User Messages (correlate optimistic sends)
          if (item.type === "user_message") {
            const idx = next.findIndex(
              (p) =>
                p.type === "user_message" &&
                (p.text === item.text || (item.messageId && p.messageId === item.messageId)),
            );
            if (idx >= 0) {
              next[idx] = item;
              return next;
            }
            return [...next, item];
          }

          // 5. Todos
          if (item.type === "todo") {
            const idx = next.findIndex((p) => p.type === "todo");
            if (idx >= 0) {
              next[idx] = item;
              return next;
            }
            return [...next, item];
          }

          return [...next, item];
        });
      }
    });

    const unsubAgentUpdate = client.on("agent_update", (payload: any) => {
      const agent = payload.agent || payload;
      if (agent && agent.id) {
        setAgents((prev) => {
          const idx = prev.findIndex((a) => a.id === agent.id);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = { ...next[idx], ...agent };
            return next;
          }
          return [agent, ...prev];
        });
        if (agent.id === activeAgentId) {
          setIsTurnRunning(agent.status === "running");
        }
      }
    });

    const unsubWorkspaceUpdate = client.on("workspace_update", () => {
      refreshWorkspaces();
    });

    return () => {
      unsubStream();
      unsubAgentUpdate();
      unsubWorkspaceUpdate();
    };
  }, [client, activeAgentId, refreshAgents, refreshWorkspaces]);

  const setActiveWorkspaceId = (id: string | null) => {
    setActiveWorkspaceIdState(id);
    setActiveAgentIdState(null);
    setTimeline([]);
  };

  const setActiveAgentId = (id: string | null) => {
    setActiveAgentIdState(id);
  };

  const sendMessage = async (text: string, attachments?: string[]) => {
    let targetAgentId = activeAgentId;

    if (!targetAgentId) {
      const created = await createSession(text);
      if (created) return;
      throw new Error("No active session to send message to");
    }

    // Optimistically add user message to timeline
    const userItem: UserMessageTimelineItem = {
      type: "user_message",
      text,
      timestamp: new Date().toISOString(),
      attachments,
    };
    setTimeline((prev) => [...prev, userItem]);
    setIsTurnRunning(true);

    try {
      await client.sendAgentMessage({
        agentId: targetAgentId,
        text,
        attachments,
      });
    } catch (err) {
      setIsTurnRunning(false);
      setTimeline((prev) => [
        ...prev,
        {
          type: "error",
          message: `Failed to send message: ${err instanceof Error ? err.message : String(err)}`,
        },
      ]);
      throw err;
    }
  };

  const createSession = async (initialPrompt?: string): Promise<AgentSnapshot | null> => {
    try {
      let resolvedWorkspaceId = activeWorkspaceId;
      let cwd = activeWorkspace?.path || "/home/matt.cowger/workspace/tmp";

      if (resolvedWorkspaceId && resolvedWorkspaceId.startsWith("prj_")) {
        const opened = await client.openProject(cwd);
        if (opened && opened.workspace) {
          resolvedWorkspaceId = opened.workspace.id;
          await refreshWorkspaces();
        }
      }

      if (!resolvedWorkspaceId) {
        const opened = await client.openProject(cwd);
        if (opened && opened.workspace) {
          resolvedWorkspaceId = opened.workspace.id;
          await refreshWorkspaces();
        }
      }

      if (!resolvedWorkspaceId) {
        throw new Error("Could not find or open workspace");
      }

      const res = await client.createAgent({
        workspaceId: resolvedWorkspaceId,
        cwd,
        provider: "opencode",
        model: selectedModel,
        mode: selectedMode,
        thinkingEffort,
        initialPrompt,
      });

      if (res && res.agent) {
        setAgents((prev) => [res.agent, ...prev]);
        setActiveAgentIdState(res.agent.id);
        if (initialPrompt) {
          setIsTurnRunning(true);
        }
        return res.agent;
      }
      return null;
    } catch (err) {
      console.error("[WorkspaceProvider] createAgent error:", err);
      return null;
    }
  };

  const cancelTurn = async () => {
    if (!activeAgentId) return;
    try {
      await client.cancelAgent(activeAgentId);
      setIsTurnRunning(false);
    } catch (err) {
      console.warn("[WorkspaceProvider] cancelAgent error:", err);
    }
  };

  const toggleDrawer = (tab?: "terminal" | "changes") => {
    if (tab) {
      if (drawerOpen && activeDrawerTab === tab) {
        setDrawerOpen(false);
      } else {
        setActiveDrawerTab(tab);
        setDrawerOpen(true);
      }
    } else {
      setDrawerOpen((prev) => !prev);
    }
  };

  const commitGitChanges = async (message: string) => {
    if (!activeWorkspaceId) return;
    try {
      await client.commitGitChanges({
        workspaceId: activeWorkspaceId,
        message,
      });
      await refreshGitStatus();
    } catch (err) {
      console.error("[WorkspaceProvider] commitGitChanges error:", err);
      throw err;
    }
  };

  const createTerminal = async (): Promise<number | null> => {
    try {
      const res = await client.createTerminal({
        workspaceId: activeWorkspaceId || undefined,
        cols: 80,
        rows: 24,
      });
      if (res && res.slot !== undefined) {
        await refreshTerminals();
        setActiveTerminalSlot(res.slot);
        return res.slot;
      }
      return null;
    } catch (err) {
      console.error("[WorkspaceProvider] createTerminal error:", err);
      return null;
    }
  };

  return (
    <WorkspaceContext.Provider
      value={{
        workspaces,
        activeWorkspaceId,
        activeWorkspace,
        setActiveWorkspaceId,
        refreshWorkspaces,

        agents,
        activeAgentId,
        activeAgent,
        setActiveAgentId,
        refreshAgents,

        timeline,
        isTimelineLoading,
        refreshTimeline,

        models,
        selectedModel,
        setSelectedModel,

        modes,
        selectedMode,
        setSelectedMode,

        thinkingEffort,
        setThinkingEffort,

        isTurnRunning,
        sendMessage,
        createSession,
        cancelTurn,

        drawerOpen,
        activeDrawerTab,
        setDrawerOpen,
        setActiveDrawerTab,
        toggleDrawer,

        gitStatus,
        refreshGitStatus,
        commitGitChanges,

        terminals,
        activeTerminalSlot,
        setActiveTerminalSlot,
        createTerminal,
        refreshTerminals,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error("useWorkspace must be used within a WorkspaceProvider");
  }
  return context;
}
