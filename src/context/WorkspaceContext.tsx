import React, { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from "react";
import { usePaseo } from "./PaseoContext";
import type {
  ProjectItem,
  WorkspaceItem,
  AgentSnapshot,
  TimelineItem,
  AgentModel,
  AgentMode,
  GitStatusSummary,
  TerminalSessionInfo,
  UserMessageTimelineItem,
  AssistantMessageTimelineItem,
  ToolCallTimelineItem,
  TodoTimelineItem,
  CompactionTimelineItem,
  PendingPermission,
  AgentPermissionResponse,
  AgentPermissionRequest,
  ImageAttachment,
  AgentSlashCommand,
  CreateWorktreeParams,
  CreateWorktreeResult,
  ActiveTurnBehavior,
  QueuedFollowup,
} from "../lib/paseo/types";
import { isModelVisionCapable } from "../lib/vision";
import { compareAgentSnapshotsByCreation } from "../lib/agent-order";
import {
  type SubagentInfo,
  type SubagentChildAction,
  extractEmbeddedActions,
  getSubagentDetails,
} from "../lib/subagent-helpers";
import {
  saveUserMessageAttachments,
  getCachedAgentAttachments,
  loadAgentAttachments,
  findMatchingAttachment,
  matchesUserMessageItem,
} from "../lib/attachmentStore";
import { chooseDefaultWorkspace, resolveWorkspaceTarget } from "../lib/workspace-target";
import { appendReasoningTimelineItem } from "../lib/paseo/timeline";

export type ActiveTabKind = "agent" | "terminal" | "changes";

export interface WorkspaceTabItem {
  id: string;
  kind: ActiveTabKind;
  targetId: string;
  slot?: number;
  title: string;
  status?: "idle" | "running" | "paused" | "completed" | "failed" | "canceled";
}

export function deriveSessionTitle(prompt: string): string {
  const firstLine =
    prompt
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => line.length > 0) || "";
  const cleaned = firstLine
    .replace(/^#+\s*/, "")
    .replace(/^[-*+]\s*/, "")
    .replace(/^\d+\.\s*/, "")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.slice(0, 60).trim();
}

interface WorkspaceContextType {
  projects: ProjectItem[];
  workspaces: WorkspaceItem[];
  activeWorkspaceId: string | null;
  activeWorkspace: WorkspaceItem | null;
  setActiveWorkspaceId: (id: string | null) => void;
  refreshWorkspaces: () => Promise<void>;
  updateWorkspaceTitle: (workspaceId: string, title: string) => Promise<void>;
  createWorktree: (params: {
    projectId: string;
    cwd?: string;
    worktreeSlug?: string;
    refName?: string;
    action?: "branch-off" | "checkout";
    nameContext?: string;
    firstAgentContext?: {
      prompt?: string;
      attachments?: any[];
    };
    title?: string;
  }) => Promise<CreateWorktreeResult>;

  allAgents: AgentSnapshot[];
  agents: AgentSnapshot[];
  activeAgentId: string | null;
  activeAgent: AgentSnapshot | null;
  setActiveAgentId: (id: string | null) => void;
  refreshAgents: () => Promise<void>;

  workspaceTabs: WorkspaceTabItem[];
  activeTab: WorkspaceTabItem | null;
  setActiveTab: (tab: WorkspaceTabItem | { kind: ActiveTabKind; targetId: string }) => void;
  closeTab: (tab: WorkspaceTabItem) => Promise<void>;
  createAgentTab: (initialPrompt?: string) => Promise<AgentSnapshot | null>;
  createTerminalTab: () => Promise<void>;
  openChangesTab: () => void;
  updateAgentTitle: (agentId: string, title: string) => Promise<void>;
  renameTab: (tab: WorkspaceTabItem, newTitle: string) => Promise<void>;
  archiveAgentSession: (agentId: string) => Promise<void>;
  killTerminalSession: (terminalId: string) => Promise<void>;

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
  isVisionCapable: boolean;
  
  modes: AgentMode[];
  selectedMode: string | null;
  setSelectedMode: (mode: string) => void;
  canChangeMode: boolean;

  thinkingEffort: string;
  setThinkingEffort: (effort: string) => void;

  isTurnRunning: boolean;
  sendMessage: (
    text: string,
    attachments?: string[],
    images?: ImageAttachment[],
    options?: { activeTurnBehavior?: ActiveTurnBehavior; agentId?: string },
  ) => Promise<void>;
  createSession: (initialPrompt?: string, targetWorkspaceId?: string, images?: ImageAttachment[]) => Promise<AgentSnapshot | null>;
  cancelTurn: () => Promise<void>;
  queuedFollowups: QueuedFollowup[];
  cancelQueuedFollowup: (id: string) => void;

  // Slash Commands
  commands: AgentSlashCommand[];
  refreshCommands: (agentId?: string) => Promise<void>;

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
  refreshTerminals: (workspaceId?: string) => Promise<void>;

  // Subagents
  providerSubagents: Record<string, SubagentInfo>;
  getSubagentInfo: (toolCallId: string, item?: ToolCallTimelineItem) => SubagentInfo | null;

  // View Mode
  summaryMode: boolean;
  setSummaryMode: React.Dispatch<React.SetStateAction<boolean>>;
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

function normalizeAgentSnapshot(entryOrAgent: any): AgentSnapshot {
  const agent = entryOrAgent.agent || entryOrAgent;
  const project = entryOrAgent.project || agent.project;
  const availableModes = Array.isArray(agent.availableModes)
    ? agent.availableModes.map(normalizeMode)
    : agent.availableModes;

  const currentModeId = agent.currentModeId ?? agent.mode ?? null;
  const lastUsage = agent.lastUsage || agent.tokenUsage;

  const normalizedUsage = lastUsage
    ? {
        inputTokens: lastUsage.inputTokens ?? 0,
        cachedInputTokens: lastUsage.cachedInputTokens ?? lastUsage.cachedTokens ?? 0,
        cachedTokens: lastUsage.cachedInputTokens ?? lastUsage.cachedTokens ?? 0,
        outputTokens: lastUsage.outputTokens ?? 0,
        reasoningTokens: lastUsage.reasoningTokens ?? 0,
        totalCost: lastUsage.totalCostUsd ?? lastUsage.totalCost ?? 0,
        totalCostUsd: lastUsage.totalCostUsd ?? lastUsage.totalCost ?? 0,
        contextWindow: lastUsage.contextWindowMaxTokens ?? lastUsage.contextWindow ?? 0,
        contextWindowMaxTokens: lastUsage.contextWindowMaxTokens ?? lastUsage.contextWindow ?? 0,
        contextWindowUsedTokens: lastUsage.contextWindowUsedTokens ?? lastUsage.contextWindowUsed ?? 0,
      }
    : agent.tokenUsage;

  return {
    ...agent,
    project,
    currentModeId,
    availableModes,
    lastUsage: lastUsage ? { ...lastUsage, ...normalizedUsage } : undefined,
    tokenUsage: normalizedUsage,
  };
}

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const { client, connectionState } = usePaseo();

  const [workspaces, setWorkspaces] = useState<WorkspaceItem[]>([]);
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceIdState] = useState<string | null>(null);
  const activeWorkspaceIdRef = useRef<string | null>(null);
  activeWorkspaceIdRef.current = activeWorkspaceId;
  const workspacesRef = useRef<WorkspaceItem[]>([]);
  const projectsRef = useRef<ProjectItem[]>([]);
  const workspaceDataLoadedRef = useRef(false);
  const workspaceRefreshPromiseRef = useRef<Promise<void> | null>(null);

  const [allAgents, setAllAgents] = useState<AgentSnapshot[]>([]);
  const [agents, setAgents] = useState<AgentSnapshot[]>([]);
  const [activeAgentId, setActiveAgentIdState] = useState<string | null>(null);
  const activeAgentIdRef = useRef<string | null>(null);
  activeAgentIdRef.current = activeAgentId;

  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [isTimelineLoading, setIsTimelineLoading] = useState<boolean>(false);

  const [models, setModels] = useState<AgentModel[]>([]);
  const [selectedModel, setSelectedModelState] = useState<string>("plexus/gemini-3.7-flash");

  const [selectedMode, setSelectedModeState] = useState<string | null>(null);

  const [thinkingEffort, setThinkingEffortState] = useState<string>("medium");

  const [isTurnRunning, setIsTurnRunning] = useState<boolean>(false);
  const [queuedFollowups, setQueuedFollowups] = useState<QueuedFollowup[]>([]);
  const queuedFollowupsRef = useRef<QueuedFollowup[]>([]);
  queuedFollowupsRef.current = queuedFollowups;
  const drainNextFollowupRef = useRef<(agentId: string) => Promise<void>>(async () => {});
  const isDrainingFollowupRef = useRef(false);

  const [pendingPermissions, setPendingPermissions] = useState<PendingPermission[]>([]);
  const [commands, setCommands] = useState<AgentSlashCommand[]>([]);

  // Drawer
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);
  const [activeDrawerTab, setActiveDrawerTab] = useState<"terminal" | "changes">("terminal");

  // Git & Terminals
  const [gitStatus, setGitStatus] = useState<GitStatusSummary | null>(null);
  const [terminals, setTerminals] = useState<TerminalSessionInfo[]>([]);
  const [activeTerminalSlot, setActiveTerminalSlot] = useState<number | null>(null);

  // Subagents
  const [providerSubagents, setProviderSubagents] = useState<Record<string, SubagentInfo>>({});

  // Summary Mode
  const [summaryMode, setSummaryMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem("amble-summary-mode") === "true";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem("amble-summary-mode", String(summaryMode));
    } catch {}
  }, [summaryMode]);

  const [activeTabTarget, setActiveTabTarget] = useState<{
    kind: ActiveTabKind;
    targetId: string;
  } | null>(null);
  const [isChangesTabOpen, setIsChangesTabOpen] = useState<boolean>(false);

  const activeAgent =
    allAgents.find((a) => a.id === activeAgentId) ||
    agents.find((a) => a.id === activeAgentId) ||
    null;

  // Resolve active workspace strictly: from active agent if present, or activeWorkspaceId
  const resolvedWorkspaceId = activeAgent?.workspaceId || activeWorkspaceId;
  const activeWorkspace = workspaces.find((w) => w.id === resolvedWorkspaceId) || null;

  // Keep activeWorkspaceId in sync whenever activeAgent belongs to a specific workspace
  useEffect(() => {
    if (activeAgent?.workspaceId && activeAgent.workspaceId !== activeWorkspaceId) {
      activeWorkspaceIdRef.current = activeAgent.workspaceId;
      setActiveWorkspaceIdState(activeAgent.workspaceId);
    }
  }, [activeAgent?.workspaceId, activeWorkspaceId]);

  const workspaceTabs = useMemo<WorkspaceTabItem[]>(() => {
    if (!resolvedWorkspaceId) return [];

    const tabs: WorkspaceTabItem[] = [];

    // ONLY agents that belong to resolvedWorkspaceId, stably ordered by creation time
    const workspaceAgents = allAgents
      .filter((a) => a.workspaceId === resolvedWorkspaceId)
      .slice()
      .sort(compareAgentSnapshotsByCreation);

    for (const a of workspaceAgents) {
      tabs.push({
        id: `agent:${a.id}`,
        kind: "agent",
        targetId: a.id,
        title: a.title || a.name || "Untitled Session",
        status: a.status,
      });
    }

    // ONLY terminals that belong to resolvedWorkspaceId, ordered by slot
    const workspaceTerminals = terminals
      .filter((t) => {
        if (t.workspaceId) return t.workspaceId === resolvedWorkspaceId;
        if (activeWorkspace?.path && t.cwd) return t.cwd === activeWorkspace.path;
        return false;
      })
      .slice()
      .sort((a, b) => (a.slot ?? 0) - (b.slot ?? 0));

    for (const t of workspaceTerminals) {
      tabs.push({
        id: `terminal:${t.id}`,
        kind: "terminal",
        targetId: t.id,
        slot: t.slot,
        title: t.title || `Terminal ${t.slot + 1}`,
      });
    }

    // Changes tab if open
    if (isChangesTabOpen || activeTabTarget?.kind === "changes") {
      const changedCount =
        (gitStatus?.stagedFiles?.length || 0) + (gitStatus?.unstagedFiles?.length || 0);
      tabs.push({
        id: "changes",
        kind: "changes",
        targetId: "changes",
        title: changedCount > 0 ? `Changes (${changedCount})` : "Changes",
      });
    }

    return tabs;
  }, [resolvedWorkspaceId, allAgents, terminals, activeWorkspace, isChangesTabOpen, activeTabTarget, gitStatus]);

  const activeTab = useMemo<WorkspaceTabItem | null>(() => {
    if (activeTabTarget) {
      const match = workspaceTabs.find(
        (t) => t.kind === activeTabTarget.kind && t.targetId === activeTabTarget.targetId,
      );
      if (match) return match;
    }

    // Default to active agent tab if available
    if (activeAgentId) {
      const agentTab = workspaceTabs.find(
        (t) => t.kind === "agent" && t.targetId === activeAgentId,
      );
      if (agentTab) return agentTab;
    }

    return workspaceTabs[0] || null;
  }, [activeTabTarget, workspaceTabs, activeAgentId]);

  const selectedModelDefinition =
    models.find((model) => model.id === selectedModel) ||
    models.find((model) => model.id === resolveCanonicalModelId(selectedModel, models));

  const isVisionCapable = useMemo(() => {
    return isModelVisionCapable(selectedModelDefinition || selectedModel, models);
  }, [selectedModelDefinition, selectedModel, models]);
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

  // In-memory cache for loaded agent timelines to eliminate switching flicker
  const timelineCacheRef = useRef<Map<string, TimelineItem[]>>(new Map());

  // Track in-flight timeline requests to avoid race conditions
  const activeTimelineFetchRef = useRef<string | null>(null);
  const timelineRevisionRef = useRef(0);

  // Sync current timeline into cache whenever it updates
  useEffect(() => {
    if (activeAgentId) {
      activeAgentIdRef.current = activeAgentId;
      if (timeline.length > 0) {
        timelineCacheRef.current.set(activeAgentId, timeline);
      }
    }
  }, [activeAgentId, timeline]);

  // Refresh workspaces
  const refreshWorkspaces = useCallback(() => {
    if (client.getState() !== "connected") return Promise.resolve();
    if (workspaceRefreshPromiseRef.current) return workspaceRefreshPromiseRef.current;

    const refreshPromise = (async () => {
      try {
      const [res, prjRes] = await Promise.all([
        client.fetchWorkspaces().catch(() => null),
        client.listProjects().catch(() => null),
      ]);
      const list: WorkspaceItem[] = [];
      const projectMap = new Map<string, ProjectItem>();

      for (const p of prjRes?.projects || []) {
        const id = p.projectId || p.id;
        if (id) {
          projectMap.set(id, {
            id,
            projectKey: p.projectKey,
            name: p.projectDisplayName || p.projectCustomName || p.name || id,
            rootPath: p.projectRootPath || "",
            projectKind: p.projectKind,
          });
        }
      }

      if (res && Array.isArray(res.entries)) {
        for (const entry of res.entries) {
          const prjId = entry.projectId;
          if (prjId && !projectMap.has(prjId)) {
            projectMap.set(prjId, {
              id: prjId,
              projectKey: entry.projectKey,
              name: entry.projectDisplayName || entry.name || prjId,
              rootPath: entry.projectRootPath || entry.workspaceDirectory || "",
              projectKind: entry.projectKind,
            });
          }

          list.push({
            id: entry.id,
            name: entry.title || entry.name || entry.projectDisplayName || entry.id,
            title: entry.title || undefined,
            path: entry.workspaceDirectory || entry.projectRootPath || "",
            isFavorite: !!entry.pinnedAt,
            projectId: entry.projectId,
            projectKey: entry.projectKey,
            workspaceKind: entry.workspaceKind,
            worktreeSlug:
              entry.worktreeSlug ||
              entry.gitRuntime?.currentBranch ||
              entry.project?.checkout?.currentBranch,
            branch:
              entry.gitRuntime?.currentBranch ||
              entry.project?.checkout?.currentBranch ||
              entry.worktreeSlug,
          });
        }
      }

      if (res && Array.isArray(res.emptyProjects)) {
        for (const p of res.emptyProjects) {
          const id = p.projectId || p.id;
          if (id && !projectMap.has(id)) {
            projectMap.set(id, {
              id,
              projectKey: p.projectKey,
              name: p.projectDisplayName || p.projectCustomName || p.name || id,
              rootPath: p.projectRootPath || "",
              projectKind: p.projectKind,
            });
          }
        }
      }

      const nextProjects = Array.from(projectMap.values());
      projectsRef.current = nextProjects;
      setProjects(nextProjects);

      if (list.length > 0) {
        workspacesRef.current = list;
        setWorkspaces(list);
        if (!activeWorkspaceIdRef.current) {
          const chosen = chooseDefaultWorkspace(list)?.id;
          if (chosen) {
            activeWorkspaceIdRef.current = chosen;
            setActiveWorkspaceIdState(chosen);
          }
        }
      } else {
        workspacesRef.current = [];
        setWorkspaces([]);
      }
      workspaceDataLoadedRef.current = true;
    } catch (err) {
      console.warn("[WorkspaceProvider] fetchWorkspaces error:", err);
    } finally {
      workspaceRefreshPromiseRef.current = null;
    }
    })();

    workspaceRefreshPromiseRef.current = refreshPromise;
    return refreshPromise;
  }, [client]);

  // Refresh agents for active workspace
  const refreshAgents = useCallback(async (preferredAgentId?: string) => {
    if (client.getState() !== "connected") return;
    try {
      const res = await client.fetchAgents({ scope: "active" });
      const list: AgentSnapshot[] = [];

      if (res && Array.isArray(res.entries)) {
        for (const entry of res.entries) {
          list.push(normalizeAgentSnapshot(entry));
        }
      } else if (res && Array.isArray(res.agents)) {
        list.push(...res.agents.map(normalizeAgentSnapshot));
      }

      list.sort(compareAgentSnapshotsByCreation);

      setAllAgents(list);

      const curWsId = activeWorkspaceIdRef.current;
      const filtered = curWsId
        ? list.filter((a) => a.workspaceId === curWsId)
        : list;
      setAgents(filtered);

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

      const currentActiveId = preferredAgentId || activeAgentIdRef.current;
      const activeCandidates = curWsId ? filtered : list;
      if (activeCandidates.length > 0) {
        if (!currentActiveId || !list.some((a) => a.id === currentActiveId)) {
          const fallbackId = activeCandidates[0]!.id;
          setActiveAgentIdState(fallbackId);
          activeAgentIdRef.current = fallbackId;
        } else if (preferredAgentId) {
          setActiveAgentIdState(preferredAgentId);
          activeAgentIdRef.current = preferredAgentId;
        }
      } else {
        setActiveAgentIdState(null);
        activeAgentIdRef.current = null;
        setTimeline([]);
        setIsTimelineLoading(false);
      }
    } catch (err) {
      console.warn("[WorkspaceProvider] fetchAgents error:", err);
    }
  }, [client]);

  // Refresh timeline for active agent
  const refreshTimeline = useCallback(
    async (targetAgentId?: string) => {
      const id = targetAgentId || activeAgentIdRef.current;
      if (!id || client.getState() !== "connected") {
        setTimeline([]);
        return;
      }
      activeTimelineFetchRef.current = id;
      const requestRevision = timelineRevisionRef.current;

      // Show cached timeline immediately if available (0ms delay, zero flicker)
      const cached = timelineCacheRef.current.get(id);
      if (cached !== undefined) {
        setTimeline(cached);
        setIsTimelineLoading(false);
      } else {
        setIsTimelineLoading(true);
        setTimeline([]);
      }

      try {
        const res = await client.fetchAgentTimeline(id);
        if (
          activeTimelineFetchRef.current !== id ||
          timelineRevisionRef.current !== requestRevision
        ) {
          return;
        }
        if (res && Array.isArray(res.entries)) {
          // Pre-load saved attachments for this agent from memory or trigger async load
          const savedAttachments = getCachedAgentAttachments(id);
          const currentTimeline = timelineCacheRef.current.get(id) || [];

          const items: TimelineItem[] = [];
          for (const e of res.entries) {
            const rawItem = e.item || (e.type ? e : null);
            if (!rawItem) continue;
            let item = rawItem as TimelineItem;

            if (item.type === "user_message") {
              const uItem = item as UserMessageTimelineItem;
              const inCurrent = currentTimeline.find(
                (p) => p.type === "user_message" && matchesUserMessageItem(p as UserMessageTimelineItem, uItem),
              ) as UserMessageTimelineItem | undefined;
              const inStore = findMatchingAttachment(savedAttachments, uItem);
              const resolvedImages = uItem.images || inCurrent?.images || inStore?.images;
              const resolvedBehavior = uItem.activeTurnBehavior || inCurrent?.activeTurnBehavior;
              item = {
                ...uItem,
                ...(resolvedImages && resolvedImages.length > 0 ? { images: resolvedImages } : {}),
                ...(resolvedBehavior ? { activeTurnBehavior: resolvedBehavior } : {}),
              };
            }

            if (item.type === "compaction" && item.status === "completed") {
              const loadingIdx = items.findLastIndex(
                (p) => p.type === "compaction" && (p as CompactionTimelineItem).status === "loading",
              );
              if (loadingIdx >= 0) {
                items[loadingIdx] = {
                  ...(items[loadingIdx] as CompactionTimelineItem),
                  ...item,
                };
                continue;
              }
            }
            if (item.type === "reasoning" && typeof e.turnId === "string") {
              item = { ...item, turnId: e.turnId };
            }
            items.push(item);
          }
          timelineCacheRef.current.set(id, items);
          setTimeline(items);

          // Asynchronously ensure IndexedDB attachments are loaded and reconciled
          loadAgentAttachments(id).then((persisted) => {
            if (activeTimelineFetchRef.current !== id || !persisted || persisted.length === 0) return;
            setTimeline((prev) => {
              let changed = false;
              const next = prev.map((item) => {
                if (item.type === "user_message" && !(item as UserMessageTimelineItem).images?.length) {
                  const match = findMatchingAttachment(persisted, item as UserMessageTimelineItem);
                  if (match?.images && match.images.length > 0) {
                    changed = true;
                    return { ...item, images: match.images };
                  }
                }
                return item;
              });
              if (changed) {
                timelineCacheRef.current.set(id, next);
                return next;
              }
              return prev;
            });
          }).catch(() => {});

          // Query provider subagents for this agent to populate historical child actions
          client.listProviderSubagents(id).then(async (subRes) => {
            if (activeTimelineFetchRef.current !== id) return;
            if (subRes?.subagents && Array.isArray(subRes.subagents) && subRes.subagents.length > 0) {
              for (const sub of subRes.subagents) {
                try {
                  const tl = await client.fetchProviderSubagentTimeline(id, sub.id);
                  if (activeTimelineFetchRef.current !== id) return;
                  const childActions: SubagentChildAction[] = [];
                  if (tl?.rows && Array.isArray(tl.rows)) {
                    for (const row of tl.rows) {
                      if (row.item?.type === "tool_call") {
                        const it = row.item;
                        childActions.push({
                          id: it.callId,
                          tool: it.name || it.tool || "tool",
                          status: it.status || "completed",
                          title: it.title,
                          filePath:
                            it.filePath ||
                            (it.input as any)?.filePath ||
                            (it.detail as any)?.filePath ||
                            (it.input as any)?.path,
                          query:
                            (it.input as any)?.query ||
                            (it.input as any)?.pattern ||
                            (it.detail as any)?.query ||
                            (it.detail as any)?.pattern,
                          command:
                            (it.input as any)?.command ||
                            (it.input as any)?.cmd ||
                            (it.detail as any)?.command,
                          summary: it.title || (it.detail as any)?.summary,
                          input: it.input,
                          output: it.output,
                          exitCode: (it.detail as any)?.exitCode,
                        });
                      }
                    }
                  }

                  setProviderSubagents((prev) => {
                    const next = { ...prev };
                    const subInfo: SubagentInfo = {
                      id: sub.id,
                      parentAgentId: id,
                      toolCallId: sub.toolCallId || undefined,
                      status: sub.status,
                      title: sub.title || undefined,
                      description: sub.description || undefined,
                      subtitle: sub.subtitle || undefined,
                      actions: childActions,
                    };
                    next[sub.id] = subInfo;
                    if (sub.toolCallId) {
                      next[sub.toolCallId] = subInfo;
                    }
                    return next;
                  });
                } catch (e) {
                  console.warn("[WorkspaceProvider] fetchProviderSubagentTimeline error for subagent:", sub.id, e);
                }
              }
            }
          }).catch((err) => {
            console.warn("[WorkspaceProvider] listProviderSubagents error:", err);
          });
        } else {
          timelineCacheRef.current.set(id, []);
          setTimeline([]);
        }
      } catch (err) {
        if (activeTimelineFetchRef.current !== id) return;
        console.warn("[WorkspaceProvider] fetchAgentTimeline error:", err);
        setTimeline([
          {
            type: "error",
            message: `Could not load session: ${err instanceof Error ? err.message : String(err)}`,
          } as TimelineItem,
        ]);
      } finally {
        if (activeTimelineFetchRef.current === id) {
          setIsTimelineLoading(false);
        }
      }
    },
    [client],
  );

  // Refresh slash commands for active agent
  const refreshCommands = useCallback(
    async (targetAgentId?: string) => {
      const id = targetAgentId || activeAgentIdRef.current;
      if (!id || client.getState() !== "connected") {
        setCommands([]);
        return;
      }
      try {
        const list = await client.listCommands(id);
        setCommands(list);
      } catch (err) {
        console.warn("[WorkspaceProvider] listCommands error:", err);
      }
    },
    [client],
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

            const supportsVision = isModelVisionCapable({
              id: m.id,
              name: m.label || m.name || m.id,
              displayName: m.label || m.name,
              provider: m.metadata?.providerId || p.provider || "custom",
              metadata: m.metadata,
            });

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
              supportsVision,
              metadata: m.metadata,
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
  const refreshTerminals = useCallback(
    async (targetWorkspaceId?: string) => {
      if (client.getState() !== "connected") return;
      const wsId = targetWorkspaceId || resolvedWorkspaceId;
      try {
        const res = await client.listTerminals(wsId || undefined);
        if (res && Array.isArray(res.terminals)) {
          setTerminals(res.terminals);
          if (res.terminals.length > 0 && activeTerminalSlot === null) {
            setActiveTerminalSlot(res.terminals[0]!.slot);
          }
        } else {
          setTerminals([]);
        }
      } catch (err) {
        console.warn("[WorkspaceProvider] listTerminals error:", err);
      }
    },
    [client, resolvedWorkspaceId, activeTerminalSlot],
  );

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
    if (resolvedWorkspaceId && connectionState === "connected") {
      refreshAgents();
      refreshGitStatus();
      refreshTerminals(resolvedWorkspaceId);
    }
  }, [resolvedWorkspaceId, connectionState, refreshAgents, refreshGitStatus, refreshTerminals]);

  // When active agent changes
  useEffect(() => {
    if (activeAgentId && connectionState === "connected") {
      refreshTimeline(activeAgentId);
      refreshCommands(activeAgentId);
      client.setAgentTimelineSubscription([activeAgentId]).catch(console.warn);
    } else if (!activeAgentId) {
      setTimeline([]);
      setIsTimelineLoading(false);
      setIsTurnRunning(false);
      setCommands([]);
      if (connectionState === "connected") {
        client.setAgentTimelineSubscription([]).catch(console.warn);
      }
    }
  }, [activeAgentId, connectionState, refreshTimeline, refreshCommands, client]);

  useEffect(() => {
    if (activeAgent) {
      setIsTurnRunning(activeAgent.status === "running");
    }
  }, [activeAgent?.id, activeAgent?.status]);

  // Poll agents while a turn is actively running to catch intermediate step token updates
  useEffect(() => {
    if (!isTurnRunning || connectionState !== "connected") return;

    const interval = setInterval(() => {
      refreshAgents();
    }, 1500);

    return () => clearInterval(interval);
  }, [isTurnRunning, connectionState, refreshAgents]);

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
    const unsubStream = client.on("agent_stream", (rawPayload: any) => {
      if (!rawPayload) return;
      const payload = rawPayload.payload || rawPayload;
      const streamAgentId = payload.agentId || rawPayload.agentId;
      const event = payload.event || rawPayload.event || payload;
      const targetAgentId = streamAgentId || activeAgentId;
      
      // Only process events for current active session
      if (streamAgentId && activeAgentId && streamAgentId !== activeAgentId) {
        return;
      }

      if (event.type === "usage_updated" || ((event.type === "turn_completed" || event.type === "turn_failed") && event.usage)) {
        const usage = event.usage;
        if (targetAgentId && usage) {
          const updateUsage = (list: AgentSnapshot[]) =>
            list.map((a) => {
              if (a.id !== targetAgentId) return a;
              const mergedUsage = {
                ...a.lastUsage,
                ...usage,
                inputTokens: usage.inputTokens ?? a.lastUsage?.inputTokens ?? 0,
                cachedInputTokens: usage.cachedInputTokens ?? a.lastUsage?.cachedInputTokens ?? 0,
                outputTokens: usage.outputTokens ?? a.lastUsage?.outputTokens ?? 0,
                totalCostUsd: usage.totalCostUsd ?? a.lastUsage?.totalCostUsd ?? 0,
                contextWindowMaxTokens: usage.contextWindowMaxTokens ?? a.lastUsage?.contextWindowMaxTokens,
                contextWindowUsedTokens: usage.contextWindowUsedTokens ?? a.lastUsage?.contextWindowUsedTokens,
              };
              return {
                ...a,
                lastUsage: mergedUsage,
                tokenUsage: {
                  ...a.tokenUsage,
                  ...mergedUsage,
                  totalCost: mergedUsage.totalCostUsd,
                  contextWindow: mergedUsage.contextWindowMaxTokens,
                  cachedTokens: mergedUsage.cachedInputTokens,
                },
              };
            });
          setAgents(updateUsage);
          setAllAgents(updateUsage);
        }
      }

      if (event.type === "turn_started") {
        timelineRevisionRef.current += 1;
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
        timelineRevisionRef.current += 1;
        setIsTurnRunning(false);
        // Mark all reasoning blocks as non-streaming and capture duration, and resolve loading compaction
        setTimeline((prev) =>
          prev.map((item) => {
            if (item.type === "reasoning" && (item as any).isStreaming) {
              const dur = (item as any).startedAt ? Date.now() - (item as any).startedAt : item.durationMs;
              return { ...item, isStreaming: false, durationMs: dur };
            }
            if (item.type === "compaction" && (item as any).status === "loading") {
              return { ...item, status: "completed" };
            }
            return item;
          }),
        );
        // Refresh agent list and timeline state when turn completes
        refreshAgents();
        if (targetAgentId) {
          refreshTimeline(targetAgentId);
          setTimeout(() => {
            void drainNextFollowupRef.current(targetAgentId);
          }, 100);
        }
      } else if (event.type === "timeline" && event.item) {
        timelineRevisionRef.current += 1;
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
            const turnId = typeof event.turnId === "string" ? event.turnId : undefined;
            return appendReasoningTimelineItem(next, item, turnId);
          }

          // 4. User Messages (correlate optimistic sends and restore attachments)
          if (item.type === "user_message") {
            const uItem = item as UserMessageTimelineItem;
            const savedAttachments = getCachedAgentAttachments(targetAgentId);
            const inStore = findMatchingAttachment(savedAttachments, uItem);

            const idx = next.findIndex(
              (p) =>
                p.type === "user_message" &&
                matchesUserMessageItem(p as UserMessageTimelineItem, uItem),
            );
            if (idx >= 0) {
              const existing = next[idx] as UserMessageTimelineItem;
              next[idx] = {
                ...item,
                activeTurnBehavior: uItem.activeTurnBehavior || existing.activeTurnBehavior,
                images: uItem.images || existing.images || inStore?.images,
              };
              return next;
            }
            const resolvedImages = uItem.images || inStore?.images;
            return [...next, resolvedImages ? { ...item, images: resolvedImages } : item];
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

          // 6. Compaction
          if (item.type === "compaction") {
            endPriorReasoningStreaming();
            if (item.status === "completed") {
              const loadingIdx = next.findLastIndex(
                (p) => p.type === "compaction" && (p as CompactionTimelineItem).status === "loading",
              );
              if (loadingIdx >= 0) {
                const existing = next[loadingIdx] as CompactionTimelineItem;
                next[loadingIdx] = {
                  ...existing,
                  ...item,
                  status: "completed",
                  trigger: item.trigger ?? existing.trigger,
                  preTokens: item.preTokens ?? existing.preTokens,
                };
                return next;
              }
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
        const updateList = (prev: AgentSnapshot[]) => {
          const idx = prev.findIndex((a) => a.id === agent.id);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = { ...next[idx], ...agent };
            return next;
          }
          const next = [...prev, agent];
          return next.sort(compareAgentSnapshotsByCreation);
        };
        setAgents(updateList);
        setAllAgents(updateList);
        if (agent.id === activeAgentId) {
          setIsTurnRunning(agent.status === "running");
        }
        if (agent.status !== "running") {
          setTimeout(() => {
            void drainNextFollowupRef.current(agent.id);
          }, 100);
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

    const unsubSubagents = client.on("agent.provider_subagents.update", (rawPayload: any) => {
      if (!rawPayload) return;
      const payload = rawPayload.payload || rawPayload;
      if (!payload || !payload.kind) return;

      if (payload.kind === "upsert" && payload.subagent) {
        const sub = payload.subagent;
        setProviderSubagents((prev) => {
          const next = { ...prev };
          const existing = next[sub.id] || (sub.toolCallId ? next[sub.toolCallId] : undefined);
          const isFinished = sub.status !== "running";
          const updatedActions = (existing?.actions || []).map((a) =>
            isFinished && a.status === "running"
              ? { ...a, status: sub.status === "failed" ? ("failed" as const) : ("completed" as const) }
              : a,
          );
          const updated: SubagentInfo = {
            id: sub.id,
            parentAgentId: sub.parentAgentId,
            toolCallId: sub.toolCallId || existing?.toolCallId,
            status: sub.status,
            title: sub.title ?? existing?.title,
            description: sub.description ?? existing?.description,
            subtitle: sub.subtitle ?? existing?.subtitle,
            subAgentType: existing?.subAgentType,
            actions: updatedActions,
            output: existing?.output,
          };
          next[sub.id] = updated;
          if (sub.toolCallId) {
            next[sub.toolCallId] = updated;
          }
          return next;
        });
      } else if (payload.kind === "timeline" && payload.item) {
        const subId = payload.subagentId;
        const item = payload.item;
        if (item.type === "tool_call") {
          const actionId =
            item.callId || item.id || (item as any)?.toolCallId || (item as any)?.tool_call_id;
          const childAction: SubagentChildAction = {
            id: actionId,
            tool: item.name || item.tool || "tool",
            status: item.status || "completed",
            title: item.title,
            filePath:
              item.filePath ||
              (item.input as any)?.filePath ||
              (item.detail as any)?.filePath ||
              (item.input as any)?.path,
            query:
              (item.input as any)?.query ||
              (item.input as any)?.pattern ||
              (item.detail as any)?.query ||
              (item.detail as any)?.pattern,
            command:
              (item.input as any)?.command ||
              (item.input as any)?.cmd ||
              (item.detail as any)?.command,
            summary: item.title || (item.detail as any)?.summary,
            input: item.input,
            output: item.output,
            exitCode: (item.detail as any)?.exitCode,
          };

          setProviderSubagents((prev) => {
            const next = { ...prev };
            const existing = next[subId];
            if (!existing) {
              const newSub: SubagentInfo = {
                id: subId,
                parentAgentId: payload.parentAgentId,
                status: "running",
                actions: [childAction],
              };
              next[subId] = newSub;
              return next;
            }

            const currentActions = [...existing.actions];
            let existingIndex = -1;
            if (childAction.id) {
              existingIndex = currentActions.findIndex((a) => a.id === childAction.id);
            }
            if (existingIndex === -1 && currentActions.length > 0) {
              const lastIdx = currentActions.length - 1;
              const last = currentActions[lastIdx]!;
              const sameTool =
                (last.tool || "").toLowerCase() === (childAction.tool || "").toLowerCase();
              if (
                sameTool &&
                (last.status === "running" ||
                  (!last.query && !last.filePath && !last.command) ||
                  last.query === childAction.query ||
                  last.filePath === childAction.filePath)
              ) {
                existingIndex = lastIdx;
              }
            }

            if (existingIndex >= 0) {
              const prevAction = currentActions[existingIndex]!;
              currentActions[existingIndex] = {
                ...prevAction,
                ...childAction,
                id: childAction.id || prevAction.id,
                query: childAction.query || prevAction.query,
                filePath: childAction.filePath || prevAction.filePath,
                command: childAction.command || prevAction.command,
                summary: childAction.summary || prevAction.summary,
              };
            } else {
              currentActions.push(childAction);
            }

            const updated: SubagentInfo = {
              ...existing,
              actions: currentActions,
            };
            next[subId] = updated;
            if (existing.toolCallId) {
              next[existing.toolCallId] = updated;
            }
            return next;
          });
        }
      } else if (payload.kind === "remove") {
        const subId = payload.subagentId;
        setProviderSubagents((prev) => {
          const next = { ...prev };
          const existing = next[subId];
          delete next[subId];
          if (existing?.toolCallId) {
            delete next[existing.toolCallId];
          }
          return next;
        });
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
      unsubSubagents();
      unsubWorkspaceUpdate();
    };
  }, [client, activeAgentId, refreshAgents, refreshWorkspaces]);

  const setActiveWorkspaceId = useCallback((id: string | null) => {
    activeWorkspaceIdRef.current = id;
    setActiveWorkspaceIdState(id);
    if (id) {
      setAgents(allAgents.filter((a) => a.workspaceId === id));
    } else {
      setAgents(allAgents);
    }
  }, [allAgents]);

  const setActiveTab = useCallback(
    (tab: WorkspaceTabItem | { kind: ActiveTabKind; targetId: string }) => {
      setActiveTabTarget({ kind: tab.kind, targetId: tab.targetId });
      if (tab.kind === "agent") {
        if (activeAgentIdRef.current && activeAgentIdRef.current !== tab.targetId) {
          timelineCacheRef.current.set(activeAgentIdRef.current, timeline);
        }
        activeAgentIdRef.current = tab.targetId;
        setActiveAgentIdState(tab.targetId);

        const cached = timelineCacheRef.current.get(tab.targetId);
        if (cached !== undefined) {
          setTimeline(cached);
          setIsTimelineLoading(false);
        } else {
          setTimeline([]);
          setIsTimelineLoading(true);
        }
      } else if (tab.kind === "terminal") {
        const term = terminals.find((t) => t.id === tab.targetId);
        if (term) {
          setActiveTerminalSlot(term.slot);
        }
      } else if (tab.kind === "changes") {
        setIsChangesTabOpen(true);
      }
    },
    [terminals, timeline],
  );

  const setActiveAgentId = useCallback((id: string | null) => {
    if (id && activeAgentIdRef.current && activeAgentIdRef.current !== id) {
      timelineCacheRef.current.set(activeAgentIdRef.current, timeline);
    }
    activeAgentIdRef.current = id;
    setActiveAgentIdState(id);
    if (id) {
      setActiveTabTarget({ kind: "agent", targetId: id });
      const cached = timelineCacheRef.current.get(id);
      if (cached !== undefined) {
        setTimeline(cached);
        setIsTimelineLoading(false);
      } else {
        setTimeline([]);
        setIsTimelineLoading(true);
      }
    } else {
      setActiveTabTarget(null);
      setTimeline([]);
      setIsTimelineLoading(false);
      setIsTurnRunning(false);
      setCommands([]);
    }
  }, [timeline]);

  const closeTab = useCallback(
    async (tab: WorkspaceTabItem): Promise<void> => {
      try {
        if (tab.kind === "changes") {
          setIsChangesTabOpen(false);
          if (activeTab?.targetId === "changes") {
            const remaining = workspaceTabs.filter((t) => t.kind !== "changes");
            if (remaining.length > 0) {
              setActiveTab(remaining[0]!);
            } else {
              setActiveTabTarget(null);
              setActiveAgentId(null);
            }
          }
          return;
        }

        if (tab.kind === "agent") {
          timelineCacheRef.current.delete(tab.targetId);
          setPendingPermissions((prev) => prev.filter((p) => p.agentId !== tab.targetId));
          setAllAgents((prev) => prev.filter((a) => a.id !== tab.targetId));
          setAgents((prev) => prev.filter((a) => a.id !== tab.targetId));

          const wasActive =
            activeTab?.targetId === tab.targetId ||
            activeAgentIdRef.current === tab.targetId;
          const closedIdx = workspaceTabs.findIndex((t) => t.id === tab.id);
          const remaining = workspaceTabs.filter((t) => t.targetId !== tab.targetId);

          if (wasActive) {
            if (remaining.length > 0) {
              const nextTab =
                remaining[closedIdx] || remaining[closedIdx - 1] || remaining[0]!;
              setActiveTab(nextTab);
              if (nextTab.kind !== "agent") {
                const remainingAgent = remaining.find((t) => t.kind === "agent");
                if (remainingAgent) {
                  setActiveAgentId(remainingAgent.targetId);
                } else {
                  setActiveAgentId(null);
                }
              }
            } else {
              setActiveTabTarget(null);
              setActiveAgentId(null);
            }
          }

          await client.archiveAgent(tab.targetId);
          const remainingAgent = remaining.find((t) => t.kind === "agent");
          const preferredAgent = wasActive
            ? remainingAgent?.targetId
            : activeAgentIdRef.current || undefined;
          await refreshAgents(preferredAgent);
        } else if (tab.kind === "terminal") {
          const wasActive = activeTab?.targetId === tab.targetId;
          const closedIdx = workspaceTabs.findIndex((t) => t.id === tab.id);
          const remaining = workspaceTabs.filter((t) => t.targetId !== tab.targetId);

          if (wasActive) {
            if (remaining.length > 0) {
              const nextTab =
                remaining[closedIdx] || remaining[closedIdx - 1] || remaining[0]!;
              setActiveTab(nextTab);
            } else {
              setActiveTabTarget(null);
              setActiveAgentId(null);
            }
          }

          await client.killTerminal(tab.targetId);
          await refreshTerminals();
        }
      } catch (err) {
        console.warn("[WorkspaceProvider] closeTab error:", err);
      }
    },
    [client, refreshAgents, refreshTerminals, activeTab, workspaceTabs, setActiveTab, setActiveAgentId],
  );

  const openChangesTab = useCallback(() => {
    setIsChangesTabOpen(true);
    setActiveTabTarget({ kind: "changes", targetId: "changes" });
    // Always fetch fresh status when the tab is opened — the polled state
    // may be stale (e.g. external edits since last workspace switch).
    void refreshGitStatus();
  }, [refreshGitStatus]);

  const updateAgentTitle = useCallback(
    async (agentId: string, title: string): Promise<void> => {
      const trimmed = title.trim();
      if (!agentId || !trimmed) return;
      try {
        setAllAgents((prev) =>
          prev.map((a) => (a.id === agentId ? { ...a, title: trimmed, name: trimmed } : a)),
        );
        setAgents((prev) =>
          prev.map((a) => (a.id === agentId ? { ...a, title: trimmed, name: trimmed } : a)),
        );
        await client.updateAgent(agentId, { name: trimmed });
        await refreshAgents();
      } catch (err) {
        console.warn("[WorkspaceProvider] updateAgentTitle error:", err);
      }
    },
    [client, refreshAgents],
  );

  const updateWorkspaceTitle = useCallback(
    async (workspaceId: string, title: string): Promise<void> => {
      const trimmed = title.trim();
      if (!workspaceId) return;
      try {
        setWorkspaces((prev) =>
          prev.map((w) =>
            w.id === workspaceId
              ? { ...w, title: trimmed || undefined, name: trimmed || w.name }
              : w,
          ),
        );
        await client.setWorkspaceTitle(workspaceId, trimmed || null);
        await refreshWorkspaces();
      } catch (err) {
        console.warn("[WorkspaceProvider] updateWorkspaceTitle error:", err);
      }
    },
    [client, refreshWorkspaces],
  );

  const renameTerminalSession = useCallback(
    async (terminalId: string, title: string): Promise<void> => {
      const trimmed = title.trim();
      if (!terminalId || !trimmed) return;
      try {
        setTerminals((prev) =>
          prev.map((t) => (t.id === terminalId ? { ...t, title: trimmed } : t)),
        );
        await client.renameTerminal({ terminalId, title: trimmed });
        await refreshTerminals();
      } catch (err) {
        console.warn("[WorkspaceProvider] renameTerminalSession error:", err);
      }
    },
    [client, refreshTerminals],
  );

  const renameTab = useCallback(
    async (tab: WorkspaceTabItem, newTitle: string): Promise<void> => {
      if (tab.kind === "agent") {
        await updateAgentTitle(tab.targetId, newTitle);
      } else if (tab.kind === "terminal") {
        await renameTerminalSession(tab.targetId, newTitle);
      }
    },
    [updateAgentTitle, renameTerminalSession],
  );

  const createTerminalTab = useCallback(async (): Promise<void> => {
    const cwd = activeWorkspace?.path;
    try {
      const created = await client.createTerminal({
        workspaceId: activeWorkspaceId || undefined,
        cwd,
      });
      await refreshTerminals();
      setActiveTerminalSlot(created.slot);
      setActiveTabTarget({ kind: "terminal", targetId: created.terminalId });
    } catch (err) {
      console.warn("[WorkspaceProvider] createTerminalTab error:", err);
    }
  }, [client, activeWorkspace, activeWorkspaceId, refreshTerminals]);

  const archiveAgentSession = useCallback(
    async (agentId: string): Promise<void> => {
      const tab = workspaceTabs.find((t) => t.kind === "agent" && t.targetId === agentId);
      if (tab) {
        await closeTab(tab);
      } else {
        timelineCacheRef.current.delete(agentId);
        setPendingPermissions((prev) => prev.filter((p) => p.agentId !== agentId));
        setAllAgents((prev) => prev.filter((a) => a.id !== agentId));
        setAgents((prev) => prev.filter((a) => a.id !== agentId));
        if (activeAgentIdRef.current === agentId) {
          setActiveTabTarget(null);
          setActiveAgentId(null);
        }
        await client.archiveAgent(agentId);
        await refreshAgents();
      }
    },
    [client, refreshAgents, workspaceTabs, closeTab, setActiveAgentId],
  );

  const killTerminalSession = useCallback(
    async (terminalId: string): Promise<void> => {
      await client.killTerminal(terminalId);
      await refreshTerminals();
    },
    [client, refreshTerminals],
  );

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

  const sendMessage = async (
    text: string,
    attachments?: string[],
    images?: ImageAttachment[],
    options?: { activeTurnBehavior?: ActiveTurnBehavior; agentId?: string },
  ) => {
    let targetAgentId = options?.agentId || activeAgentId;

    if (!targetAgentId) {
      const created = await createSession(text, undefined, images);
      if (created) return;
      throw new Error("No active session to send message to");
    }

    const isDebugRunning =
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).has("debugRunning");

    const isTargetRunning =
      targetAgentId === activeAgentId
        ? (isTurnRunning || isDebugRunning)
        : allAgents.find((a) => a.id === targetAgentId)?.status === "running";

    if (options?.activeTurnBehavior === "followup" && isTargetRunning) {
      const queuedItem: QueuedFollowup = {
        id: `queued_${crypto.randomUUID()}`,
        agentId: targetAgentId,
        text,
        attachments,
        images,
        timestamp: new Date().toISOString(),
      };
      setQueuedFollowups((prev) => [...prev, queuedItem]);
      return;
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

    const messageId = `msg_${crypto.randomUUID()}`;

    // Optimistically add user message to timeline
    const userItem: UserMessageTimelineItem = {
      type: "user_message",
      text,
      timestamp: new Date().toISOString(),
      messageId,
      clientMessageId: messageId,
      attachments,
      images,
      activeTurnBehavior: options?.activeTurnBehavior,
    };
    if (targetAgentId === activeAgentId) {
      timelineRevisionRef.current += 1;
      setTimeline((prev) => [...prev, userItem]);
      setIsTurnRunning(true);
    } else {
      const cached = timelineCacheRef.current.get(targetAgentId) || [];
      timelineCacheRef.current.set(targetAgentId, [...cached, userItem]);
    }

    if (images && images.length > 0) {
      saveUserMessageAttachments(targetAgentId, messageId, text, images, messageId);
    }

    // Auto-generate / derive initial session title on first message if currently untitled
    const isAutoTitleEnabled =
      typeof window === "undefined" ||
      localStorage.getItem("amble-auto-session-titles") !== "false";

    const currentAgent = allAgents.find((a) => a.id === targetAgentId) || activeAgent;
    if (
      isAutoTitleEnabled &&
      targetAgentId &&
      currentAgent &&
      (!currentAgent.title ||
        currentAgent.title === "Untitled Session" ||
        currentAgent.name === "Untitled Session")
    ) {
      const derived = deriveSessionTitle(text);
      if (derived) {
        void updateAgentTitle(targetAgentId, derived);
      }
    }

    try {
      await client.sendAgentMessage({
        agentId: targetAgentId,
        text,
        attachments,
        images,
        messageId,
        activeTurnBehavior: options?.activeTurnBehavior,
      });
    } catch (err) {
      if (targetAgentId === activeAgentId) {
        setIsTurnRunning(false);
        setTimeline((prev) => [
          ...prev,
          {
            type: "error",
            message: `Failed to send message: ${err instanceof Error ? err.message : String(err)}`,
          },
        ]);
      }
      throw err;
    }
  };

  const drainNextFollowup = useCallback(async (agentId: string) => {
    if (isDrainingFollowupRef.current) return;
    const nextItem = queuedFollowupsRef.current.find((q) => q.agentId === agentId);
    if (!nextItem) return;

    isDrainingFollowupRef.current = true;
    setQueuedFollowups((prev) => prev.filter((q) => q.id !== nextItem.id));

    try {
      await sendMessage(
        nextItem.text,
        nextItem.attachments,
        nextItem.images,
        { activeTurnBehavior: "followup", agentId: nextItem.agentId },
      );
    } catch (err) {
      console.error("[WorkspaceProvider] Failed to send queued followup:", err);
    } finally {
      isDrainingFollowupRef.current = false;
    }
  }, [activeAgentId, allAgents, isTurnRunning, selectedModel, models, activeAgent, client]);

  drainNextFollowupRef.current = drainNextFollowup;

  const cancelQueuedFollowup = useCallback((id: string) => {
    setQueuedFollowups((prev) => prev.filter((item) => item.id !== id));
  }, []);

  useEffect(() => {
    if (!isTurnRunning && activeAgentId) {
      const timer = setTimeout(() => {
        void drainNextFollowup(activeAgentId);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isTurnRunning, activeAgentId, drainNextFollowup]);

  const createSession = useCallback(async (
    initialPrompt?: string,
    targetWorkspaceId?: string,
    images?: ImageAttachment[],
  ): Promise<AgentSnapshot | null> => {
    // If this is a new blank session request, clear timeline immediately and cache previous session
    if (!initialPrompt) {
      if (activeAgentIdRef.current && timeline.length > 0) {
        timelineCacheRef.current.set(activeAgentIdRef.current, timeline);
      }
      setTimeline([]);
      setIsTimelineLoading(true);
    }

    try {
      if (!workspaceDataLoadedRef.current) {
        await refreshWorkspaces();
      }

      const requestedWorkspaceId = targetWorkspaceId || activeWorkspaceIdRef.current || undefined;
      const target = resolveWorkspaceTarget({
        requestedWorkspaceId,
        activeWorkspaceId: activeWorkspaceIdRef.current,
        workspaces: workspacesRef.current,
        projects: projectsRef.current,
      });
      let resolvedWorkspaceId = target.workspaceId;
      let cwd = target.cwd;

      if (target.needsProjectOpen && cwd) {
        const opened = await client.openProject(cwd);
        if (opened?.workspace) {
          resolvedWorkspaceId = opened.workspace.id;
          cwd = opened.workspace.path || cwd;
          await refreshWorkspaces();
        }
      }

      if (!resolvedWorkspaceId || !cwd) {
        throw new Error("Could not find or open workspace");
      }

      const messageId = `msg_${crypto.randomUUID()}`;
      const canonicalModel = resolveCanonicalModelId(selectedModel, models);
      const res = await client.createAgent({
        workspaceId: resolvedWorkspaceId,
        cwd,
        provider: selectedModelDefinition?.agentProvider || "opencode",
        model: canonicalModel,
        mode: selectedMode,
        thinkingEffort,
        initialPrompt,
        clientMessageId: messageId,
        images,
      });

      if (res && res.agent) {
        const agent = normalizeAgentSnapshot(res.agent);
        setAllAgents((prev) => {
          const next = [...prev.filter((a) => a.id !== agent.id), agent];
          return next.sort(compareAgentSnapshotsByCreation);
        });
        setAgents((prev) => {
          const next = [...prev.filter((a) => a.id !== agent.id), agent];
          return next.sort(compareAgentSnapshotsByCreation);
        });
        setActiveAgentIdState(agent.id);
        activeAgentIdRef.current = agent.id;
        setActiveTabTarget({ kind: "agent", targetId: agent.id });
        const finalWsId = agent.workspaceId || resolvedWorkspaceId;
        setActiveWorkspaceIdState(finalWsId);
        activeWorkspaceIdRef.current = finalWsId;

        if (images && images.length > 0) {
          saveUserMessageAttachments(agent.id, messageId, initialPrompt || "", images, messageId);
        }

        if (initialPrompt) {
          const initialUserItem: UserMessageTimelineItem = {
            type: "user_message",
            text: initialPrompt,
            timestamp: new Date().toISOString(),
            messageId,
            clientMessageId: messageId,
            images,
          };
          timelineCacheRef.current.set(agent.id, [initialUserItem]);
          setTimeline([initialUserItem]);
          setIsTurnRunning(true);
        } else {
          timelineCacheRef.current.set(agent.id, []);
          setTimeline([]);
          setIsTimelineLoading(false);
        }
        await refreshAgents(agent.id);
        return agent;
      }
      return null;
    } catch (err) {
      console.error("[WorkspaceProvider] createAgent error:", err);
      return null;
    }
  }, [
    client,
    models,
    refreshAgents,
    refreshWorkspaces,
    selectedModel,
    selectedMode,
    selectedModelDefinition,
    thinkingEffort,
    timeline,
  ]);

  const createWorktree = useCallback(
    async (params: {
      projectId: string;
      cwd?: string;
      worktreeSlug?: string;
      refName?: string;
      action?: "branch-off" | "checkout";
      nameContext?: string;
      firstAgentContext?: {
        prompt?: string;
        attachments?: any[];
      };
      title?: string;
    }): Promise<CreateWorktreeResult> => {
      let resolvedCwd = params.cwd;
      if (!resolvedCwd) {
        const prj = projects.find((p) => p.id === params.projectId);
        resolvedCwd = prj?.rootPath;
      }
      if (!resolvedCwd) {
        const ws = workspaces.find((w) => w.projectId === params.projectId);
        resolvedCwd = ws?.path;
      }
      if (!resolvedCwd) {
        return { error: "Project root path could not be found" };
      }

      try {
        const res = await client.createWorktree({
          cwd: resolvedCwd,
          projectId: params.projectId,
          worktreeSlug: params.worktreeSlug,
          refName: params.refName,
          action: params.action,
          nameContext: params.nameContext,
          firstAgentContext: params.firstAgentContext,
          title: params.title,
        });

        if (res.error) {
          return { error: res.error, errorCode: res.errorCode };
        }

        if (params.title && res.workspace?.id) {
          await client.setWorkspaceTitle(res.workspace.id, params.title).catch(() => {});
        }

        await refreshWorkspaces();

        if (res.workspace?.id) {
          setActiveWorkspaceId(res.workspace.id);
        }

        return res;
      } catch (err: any) {
        console.error("[WorkspaceProvider] createWorktree error:", err);
        return { error: err?.message || String(err) };
      }
    },
    [client, projects, workspaces, refreshWorkspaces, setActiveWorkspaceId],
  );

  const createAgentTab = useCallback(
    async (initialPrompt?: string): Promise<AgentSnapshot | null> => {
      // Clear timeline immediately so previous session contents disappear instantly
      if (activeAgentIdRef.current && timeline.length > 0) {
        timelineCacheRef.current.set(activeAgentIdRef.current, timeline);
      }
      setTimeline([]);
      setIsTimelineLoading(true);

      const agent = await createSession(initialPrompt, activeWorkspaceIdRef.current || undefined);
      if (agent) {
        setActiveTab({ kind: "agent", targetId: agent.id });
      }
      return agent;
    },
    [createSession, setActiveTab, timeline],
  );

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
    const cwd = activeWorkspace?.path;
    if (!activeWorkspaceId || !cwd) return;
    try {
      await client.commitGitChanges({
        workspaceId: activeWorkspaceId,
        cwd,
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

  const getSubagentInfo = useCallback(
    (toolCallId: string, item?: ToolCallTimelineItem): SubagentInfo | null => {
      const childSessionId =
        (item?.detail as any)?.childSessionId || (item?.metadata as any)?.sessionId;
      const live =
        providerSubagents[toolCallId] ||
        (childSessionId ? providerSubagents[childSessionId] : undefined);

      const embeddedActions = item ? extractEmbeddedActions(item) : [];
      const details = item
        ? getSubagentDetails(item)
        : { description: "", subAgentType: undefined };

      if (!live && !item) return null;

      const isFinished =
        item?.status === "completed" ||
        item?.status === "failed" ||
        item?.status === "canceled" ||
        (live && live.status !== "running");
      const finalStatus =
        item?.status === "completed" || item?.status === "failed" || item?.status === "canceled"
          ? item.status
          : live?.status || item?.status || "running";

      if (live) {
        const rawActions = live.actions.length > 0 ? live.actions : embeddedActions;
        const normalizedActions = rawActions.map((a) =>
          isFinished && a.status === "running"
            ? { ...a, status: finalStatus === "failed" ? ("failed" as const) : ("completed" as const) }
            : a,
        );
        return {
          ...live,
          status: finalStatus,
          description: live.description || details.description,
          subAgentType: live.subAgentType || details.subAgentType,
          actions: normalizedActions,
          output:
            live.output ||
            (typeof item?.output === "string"
              ? item.output
              : (item?.detail as any)?.log),
        };
      }

      if (item) {
        const normalizedActions = embeddedActions.map((a) =>
          isFinished && a.status === "running"
            ? { ...a, status: finalStatus === "failed" ? ("failed" as const) : ("completed" as const) }
            : a,
        );
        return {
          id: toolCallId,
          parentAgentId: activeAgentId || "",
          toolCallId,
          status: finalStatus,
          description: details.description,
          subAgentType: details.subAgentType,
          actions: normalizedActions,
          output:
            typeof item.output === "string"
              ? item.output
              : (item.detail as any)?.log,
        };
      }

      return null;
    },
    [providerSubagents, activeAgentId],
  );

  return (
    <WorkspaceContext.Provider
      value={{
        projects,
        workspaces,
        activeWorkspaceId,
        activeWorkspace,
        setActiveWorkspaceId,
        refreshWorkspaces,
        updateWorkspaceTitle,
        createWorktree,

        allAgents,
        agents,
        activeAgentId,
        activeAgent,
        setActiveAgentId,
        refreshAgents,

        workspaceTabs,
        activeTab,
        setActiveTab,
        closeTab,
        createAgentTab,
        createTerminalTab,
        openChangesTab,
        updateAgentTitle,
        renameTab,
        archiveAgentSession,
        killTerminalSession,

        timeline,
        isTimelineLoading,
        refreshTimeline,

        pendingPermissions,
        respondToPermission,

        models,
        selectedModel,
        setSelectedModel,
        isVisionCapable,

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
        queuedFollowups,
        cancelQueuedFollowup,

        commands,
        refreshCommands,

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

        providerSubagents,
        getSubagentInfo,

        summaryMode,
        setSummaryMode,
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
