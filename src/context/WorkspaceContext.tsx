import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";
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
  PendingPermission,
  AgentPermissionResponse,
  AgentPermissionRequest,
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

  pendingPermissions: PendingPermission[];
  respondToPermission: (
    agentId: string,
    requestId: string,
    response: AgentPermissionResponse,
  ) => Promise<void>;

  models: AgentModel[];
  selectedModel: string;
  setSelectedModel: (model: string) => void;
  
  modes: AgentMode[];
  selectedMode: string | null;
  setSelectedMode: (mode: string) => void;
  canChangeMode: boolean;

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

export function resolveCanonicalModelId(
  modelId: string | null | undefined,
  modelsList: AgentModel[],
): string {
  if (!modelId) {
    return modelsList[0]?.id || "plexus/gemini-3.1-pro-preview";
  }

  // 1. Exact match by id (e.g. "plexus/gpt-5.6-luna")
  const exact = modelsList.find((m) => m.id === modelId);
  if (exact) return exact.id;

  // 2. Match without prefix or with different prefix (e.g. "gpt-5.6-luna" or "opencode/gpt-5.6-luna")
  const stripped = modelId.includes("/") ? modelId.split("/").pop()! : modelId;
  const suffixMatch = modelsList.find(
    (m) =>
      m.id === stripped ||
      m.id.endsWith(`/${stripped}`) ||
      m.id.replace(/^[^/]+\//, "") === stripped,
  );
  if (suffixMatch) return suffixMatch.id;

  // 3. Match by name or metadata modelId
  const nameMatch = modelsList.find(
    (m) =>
      m.name.toLowerCase() === modelId.toLowerCase() ||
      m.displayName?.toLowerCase() === modelId.toLowerCase() ||
      (m as any).metadata?.modelId === stripped,
  );
  if (nameMatch) return nameMatch.id;

  // 4. If no slash, default to plexus/ prefix if registered in snapshot
  if (!modelId.includes("/")) {
    const candidate = `plexus/${modelId}`;
    if (modelsList.some((m) => m.id === candidate)) {
      return candidate;
    }
  }

  return modelId;
}

export function derivePendingPermissionKey(
  agentId: string,
  request: AgentPermissionRequest,
): string {
  const fallbackId =
    request.id ||
    (typeof request.metadata?.id === "string" ? request.metadata.id : undefined) ||
    request.name ||
    request.title ||
    `${request.kind}:${JSON.stringify(request.input ?? request.metadata ?? {})}`;

  return `${agentId}:${fallbackId}`;
}

function normalizeMode(mode: any): AgentMode {
  return {
    id: mode.id,
    name: mode.name || mode.label || mode.id,
    description: mode.description,
    icon: mode.icon,
    colorTier: mode.colorTier,
  };
}

function normalizeAgentSnapshot(agent: any): AgentSnapshot {
  const availableModes = Array.isArray(agent.availableModes)
    ? agent.availableModes.map(normalizeMode)
    : agent.availableModes;

  const currentModeId = agent.currentModeId ?? agent.mode ?? null;

  return {
    ...agent,
    currentModeId,
    availableModes,
  };
}

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const { client, connectionState } = usePaseo();

  const [workspaces, setWorkspaces] = useState<WorkspaceItem[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceIdState] = useState<string | null>(null);

  const [agents, setAgents] = useState<AgentSnapshot[]>([]);
  const [activeAgentId, setActiveAgentIdState] = useState<string | null>(null);

  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [isTimelineLoading, setIsTimelineLoading] = useState<boolean>(false);

  const [models, setModels] = useState<AgentModel[]>([]);
  const [selectedModel, setSelectedModelState] = useState<string>("plexus/gemini-3.7-flash");

  const [selectedMode, setSelectedModeState] = useState<string | null>(null);

  const [thinkingEffort, setThinkingEffortState] = useState<string>("medium");

  const [isTurnRunning, setIsTurnRunning] = useState<boolean>(false);

  const [pendingPermissions, setPendingPermissions] = useState<PendingPermission[]>([]);

  // Drawer
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);
  const [activeDrawerTab, setActiveDrawerTab] = useState<"terminal" | "changes">("terminal");

  // Git & Terminals
  const [gitStatus, setGitStatus] = useState<GitStatusSummary | null>(null);
  const [terminals, setTerminals] = useState<TerminalSessionInfo[]>([]);
  const [activeTerminalSlot, setActiveTerminalSlot] = useState<number | null>(null);

  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId) || null;
  const activeAgent = agents.find((a) => a.id === activeAgentId) || null;
  const selectedModelDefinition =
    models.find((model) => model.id === selectedModel) ||
    models.find((model) => model.id === resolveCanonicalModelId(selectedModel, models));
  const modes = useMemo(() => {
    if (activeAgent) {
      if (activeAgent.availableModes && activeAgent.availableModes.length > 0) {
        return activeAgent.availableModes;
      }
      if (activeAgent.currentModeId) {
        return [
          {
            id: activeAgent.currentModeId,
            name: activeAgent.currentModeId,
            description: "Active mode for this session",
          },
        ];
      }
      return [];
    }
    return selectedModelDefinition?.availableModes ?? [];
  }, [activeAgent, selectedModelDefinition]);

  const canChangeMode =
    modes.length > 1 && (!activeAgent || activeAgent.capabilities?.supportsDynamicModes === true);

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
            list.push(normalizeAgentSnapshot(entry.agent));
          } else if (entry.id) {
            list.push(normalizeAgentSnapshot(entry));
          }
        }
      } else if (res && Array.isArray(res.agents)) {
        list.push(...res.agents.map(normalizeAgentSnapshot));
      }

      setAgents(list);

      // Collect pendingPermissions across active agent records
      setPendingPermissions((prev) => {
        const next = [...prev];
        for (const agent of list) {
          if (Array.isArray(agent.pendingPermissions)) {
            for (const req of agent.pendingPermissions) {
              const key = derivePendingPermissionKey(agent.id, req);
              if (!next.some((p) => p.key === key)) {
                next.push({ key, agentId: agent.id, request: req });
              }
            }
          }
        }
        return next;
      });

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
              agentProvider: p.provider || "opencode",
              providerName: m.metadata?.providerName || p.label || p.provider,
              description: m.description,
              contextWindow: m.metadata?.contextWindowMaxTokens || m.contextWindow,
              outputLimit: m.metadata?.limit?.output,
              reasoningSupported: thinkingSetIdx >= 0,
              thinkingSetIndex: thinkingSetIdx,
              thinkingOptions: tSet,
              availableModes: Array.isArray(p.modes) ? p.modes.map(normalizeMode) : [],
              defaultModeId: p.defaultModeId ?? null,
              cost: m.metadata?.cost,
            });
          }
        }
      }

      if (parsedModels.length > 0) {
        setModels(parsedModels);
        setSelectedModelState((prev) => {
          const exists = parsedModels.some((m) => m.id === prev);
          return exists ? prev : (parsedModels[0]?.id ?? prev);
        });
      }

    } catch (err) {
      console.warn("[WorkspaceProvider] refreshProviders error:", err);
    }
  }, [client]);

  // Refresh Git status
  const refreshGitStatus = useCallback(async () => {
    const cwd = activeWorkspace?.path;
    if (!cwd || client.getState() !== "connected") return;
    try {
      const res = await client.getGitStatus(cwd);
      if (res) {
        setGitStatus(res);
      }
    } catch (err) {
      console.warn("[WorkspaceProvider] getGitStatus error:", err);
    }
  }, [client, activeWorkspace]);

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

  useEffect(() => {
    if (!activeAgent) return;

    if (activeAgent.model) {
      const canonical = resolveCanonicalModelId(activeAgent.model, models);
      setSelectedModelState(canonical);

      if (
        activeAgent.provider === "opencode" &&
        !activeAgent.model.includes("/") &&
        canonical !== activeAgent.model
      ) {
        client.setAgentModel(activeAgent.id, canonical).catch((err) => {
          console.warn("[WorkspaceProvider] Failed to auto-canonicalize agent model:", err);
        });
      }
    }
    if ("currentModeId" in activeAgent || "mode" in (activeAgent as any)) {
      setSelectedModeState(activeAgent.currentModeId ?? (activeAgent as any).mode ?? null);
    }
    if ("effectiveThinkingOptionId" in activeAgent || "thinkingOptionId" in activeAgent) {
      setThinkingEffortState(activeAgent.effectiveThinkingOptionId ?? activeAgent.thinkingOptionId ?? "off");
    }
  }, [activeAgent, models, client]);

  useEffect(() => {
    if (activeAgent) return;

    const availableModes = selectedModelDefinition?.availableModes ?? [];
    setSelectedModeState((previousMode) => {
      if (previousMode && availableModes.some((mode) => mode.id === previousMode)) {
        return previousMode;
      }

      const defaultMode = selectedModelDefinition?.defaultModeId;
      return defaultMode && availableModes.some((mode) => mode.id === defaultMode)
        ? defaultMode
        : (availableModes[0]?.id ?? null);
    });
  }, [activeAgent, selectedModelDefinition]);

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
      } else if (event.type === "permission_requested") {
        const req = event.request || (event as any).payload?.request;
        const targetAgentId = streamAgentId || activeAgentId;
        if (targetAgentId && req) {
          setPendingPermissions((prev) => {
            const key = derivePendingPermissionKey(targetAgentId, req);
            const existingIdx = prev.findIndex((p) => p.key === key);
            const item: PendingPermission = { key, agentId: targetAgentId, request: req };
            if (existingIdx >= 0) {
              const next = [...prev];
              next[existingIdx] = item;
              return next;
            }
            return [...prev, item];
          });
        }
      } else if (event.type === "permission_resolved") {
        const reqId = event.requestId || (event as any).payload?.requestId;
        const targetAgentId = streamAgentId || activeAgentId;
        if (reqId) {
          setPendingPermissions((prev) =>
            prev.filter(
              (p) =>
                !(
                  (!targetAgentId || p.agentId === targetAgentId) &&
                  (p.request.id === reqId || p.key === `${targetAgentId}:${reqId}` || p.key.endsWith(`:${reqId}`))
                ),
            ),
          );
        }
      } else if (event.type === "mode_changed" && streamAgentId) {
        setAgents((previousAgents) =>
          previousAgents.map((agent) =>
            agent.id === streamAgentId
              ? {
                  ...agent,
                  currentModeId: event.currentModeId ?? null,
                  availableModes: Array.isArray(event.availableModes)
                    ? event.availableModes.map(normalizeMode)
                    : agent.availableModes,
                }
              : agent,
          ),
        );
      } else if (
        event.type === "turn_completed" ||
        event.type === "turn_failed" ||
        event.type === "turn_canceled"
      ) {
        setIsTurnRunning(false);
        // Mark all reasoning blocks as non-streaming and capture duration
        setTimeline((prev) =>
          prev.map((item) => {
            if (item.type === "reasoning" && (item as any).isStreaming) {
              const dur = (item as any).startedAt ? Date.now() - (item as any).startedAt : item.durationMs;
              return { ...item, isStreaming: false, durationMs: dur };
            }
            return item;
          }),
        );
        // Refresh agent list and timeline state when turn completes
        refreshAgents();
      } else if (event.type === "timeline" && event.item) {
        const item: TimelineItem = event.item;

        setTimeline((prev) => {
          const next = [...prev];

          // Helper to stop streaming on prior reasoning items
          const endPriorReasoningStreaming = () => {
            for (let i = 0; i < next.length; i++) {
              const prevItem = next[i];
              if (prevItem && prevItem.type === "reasoning" && (prevItem as any).isStreaming) {
                const dur = (prevItem as any).startedAt ? Date.now() - (prevItem as any).startedAt : (prevItem as any).durationMs;
                next[i] = { ...prevItem, isStreaming: false, durationMs: dur };
              }
            }
          };

          // 1. Tool Calls
          if (item.type === "tool_call" && item.callId) {
            const idx = next.findIndex(
              (p) => p.type === "tool_call" && p.callId === item.callId,
            );
            if (idx >= 0) {
              next[idx] = { ...next[idx], ...item };
              return next;
            }
            endPriorReasoningStreaming();
            return [...next, item];
          }

          // 2. Assistant Messages (smart cumulative vs delta streaming)
          if (item.type === "assistant_message") {
            endPriorReasoningStreaming();
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
                ...last,
                ...item,
                text: nextText,
                isStreaming: true,
                startedAt: (last as any).startedAt || Date.now(),
              };
              return next;
            }

            // A brand new thought section has begun! Mark prior reasoning blocks as finished
            endPriorReasoningStreaming();
            return [...next, { ...item, isStreaming: true, startedAt: Date.now() }];
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

    const unsubPermissionRequest = client.on("agent_permission_request", (payload: any) => {
      const agentId = payload?.agentId || payload?.payload?.agentId;
      const request: AgentPermissionRequest = payload?.request || payload?.payload?.request;
      if (!agentId || !request) return;

      setPendingPermissions((prev) => {
        const key = derivePendingPermissionKey(agentId, request);
        const existingIdx = prev.findIndex((p) => p.key === key);
        const item: PendingPermission = { key, agentId, request };
        if (existingIdx >= 0) {
          const next = [...prev];
          next[existingIdx] = item;
          return next;
        }
        return [...prev, item];
      });
    });

    const unsubPermissionResolved = client.on("agent_permission_resolved", (payload: any) => {
      const agentId = payload?.agentId || payload?.payload?.agentId;
      const requestId = payload?.requestId || payload?.payload?.requestId;
      if (!agentId || !requestId) return;

      setPendingPermissions((prev) =>
        prev.filter(
          (p) =>
            !(
              p.agentId === agentId &&
              (p.request.id === requestId || p.key === `${agentId}:${requestId}` || p.key.endsWith(`:${requestId}`))
            ),
        ),
      );
    });

    const unsubAgentUpdate = client.on("agent_update", (payload: any) => {
      const agent = normalizeAgentSnapshot(payload.agent || payload);
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

        if (Array.isArray(agent.pendingPermissions)) {
          setPendingPermissions((prev) => {
            const activeKeys = new Set(
              agent.pendingPermissions!.map((r: any) => derivePendingPermissionKey(agent.id, r)),
            );
            const filtered = prev.filter((p) => p.agentId !== agent.id || activeKeys.has(p.key));
            for (const req of agent.pendingPermissions!) {
              const key = derivePendingPermissionKey(agent.id, req);
              if (!filtered.some((p) => p.key === key)) {
                filtered.push({ key, agentId: agent.id, request: req });
              }
            }
            return filtered;
          });
        }
      }
    });

    const unsubWorkspaceUpdate = client.on("workspace_update", () => {
      refreshWorkspaces();
    });

    return () => {
      unsubStream();
      unsubPermissionRequest();
      unsubPermissionResolved();
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

  const setSelectedModel = useCallback(
    (model: string) => {
      const canonical = resolveCanonicalModelId(model, models);
      const previousModel = selectedModel;
      setSelectedModelState(canonical);
      if (!activeAgentId) return;

      void client
        .setAgentModel(activeAgentId, canonical)
        .then((response) => {
          if (!response.accepted) {
            throw new Error(response.error || "Paseo rejected the model change");
          }
          return refreshAgents();
        })
        .catch((error) => {
          console.warn("[WorkspaceProvider] setAgentModel error:", error);
          setSelectedModelState((current) => (current === canonical ? previousModel : current));
        });
    },
    [activeAgentId, client, models, refreshAgents, selectedModel],
  );

  const setSelectedMode = useCallback(
    (mode: string) => {
      if (!modes.some((availableMode) => availableMode.id === mode)) return;
      if (activeAgent && !activeAgent.capabilities?.supportsDynamicModes) return;

      const previousMode = selectedMode;
      setSelectedModeState(mode);
      if (!activeAgentId) return;

      void client
        .setAgentMode(activeAgentId, mode)
        .then((response) => {
          if (!response.accepted) {
            throw new Error(response.error || "Paseo rejected the mode change");
          }
          return refreshAgents();
        })
        .catch((error) => {
          console.warn("[WorkspaceProvider] setAgentMode error:", error);
          setSelectedModeState((current) => (current === mode ? previousMode : current));
        });
    },
    [activeAgent, activeAgentId, client, modes, refreshAgents, selectedMode],
  );

  const setThinkingEffort = useCallback(
    (effort: string) => {
      const previousEffort = thinkingEffort;
      setThinkingEffortState(effort);
      if (!activeAgentId) return;

      void client
        .setAgentThinking(activeAgentId, effort === "off" ? null : effort)
        .then((response) => {
          if (!response.accepted) {
            throw new Error(response.error || "Paseo rejected the thinking change");
          }
          return refreshAgents();
        })
        .catch((error) => {
          console.warn("[WorkspaceProvider] setAgentThinking error:", error);
          setThinkingEffortState((current) => (current === effort ? previousEffort : current));
        });
    },
    [activeAgentId, client, refreshAgents, thinkingEffort],
  );

  const respondToPermission = useCallback(
    async (
      agentId: string,
      requestId: string,
      response: AgentPermissionResponse,
    ) => {
      await client.respondToPermission(agentId, requestId, response);
      setPendingPermissions((prev) =>
        prev.filter(
          (p) =>
            !(
              p.agentId === agentId &&
              (p.request.id === requestId ||
                p.key === `${agentId}:${requestId}` ||
                p.key.endsWith(`:${requestId}`))
            ),
        ),
      );
      setTimeout(() => {
        refreshAgents();
        refreshTimeline(agentId);
      }, 300);
    },
    [client, refreshAgents, refreshTimeline],
  );

  const sendMessage = async (text: string, attachments?: string[]) => {
    let targetAgentId = activeAgentId;

    if (!targetAgentId) {
      const created = await createSession(text);
      if (created) return;
      throw new Error("No active session to send message to");
    }

    const canonical = resolveCanonicalModelId(selectedModel, models);
    if (activeAgent && activeAgent.id === targetAgentId && canonical) {
      const agentModel = activeAgent.model;
      if (!agentModel || agentModel !== canonical) {
        await client.setAgentModel(targetAgentId, canonical).catch((err) => {
          console.warn("[WorkspaceProvider] Failed to sync model before send:", err);
        });
      }
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

      const canonicalModel = resolveCanonicalModelId(selectedModel, models);
      const res = await client.createAgent({
        workspaceId: resolvedWorkspaceId,
        cwd,
        provider: selectedModelDefinition?.agentProvider || "opencode",
        model: canonicalModel,
        mode: selectedMode,
        thinkingEffort,
        initialPrompt,
      });

      if (res && res.agent) {
        const agent = normalizeAgentSnapshot(res.agent);
        setAgents((prev) => [agent, ...prev]);
        setActiveAgentIdState(agent.id);
        if (initialPrompt) {
          setIsTurnRunning(true);
        }
        return agent;
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

        pendingPermissions,
        respondToPermission,

        models,
        selectedModel,
        setSelectedModel,

        modes,
        selectedMode,
        setSelectedMode,
        canChangeMode,

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
