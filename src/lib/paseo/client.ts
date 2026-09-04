import "../crypto-polyfill";
import { CLIENT_CAPS } from "@getpaseo/protocol/client-capabilities";
import {
  TerminalStreamOpcode,
  decodeTerminalStreamFrame,
  decodeTerminalResizePayload,
} from "@getpaseo/protocol/binary-frames/index";
import {
  DaemonClient,
  type ConnectionState as DaemonConnectionState,
} from "@getpaseo/client/internal/daemon-client";
import { defaultWebSocketFactory } from "@getpaseo/client/internal/daemon-client-websocket-transport";
import type {
  ConnectionState,
  ServerInfoPayload,
  WorkspaceItem,
  AgentSnapshot,
  TerminalSessionInfo,
  GitStatusSummary,
  GitFileChange,
  AgentPermissionResponse,
  ImageAttachment,
  AgentSlashCommand,
  CreateWorktreeParams,
  CreateWorktreeResult,
  ActiveTurnBehavior,
  ProjectAddResult,
  ProjectCreateDirectoryResult,
  GithubSearchRepositoriesResult,
  ProjectGithubCloneResult,
  DirectorySuggestionsResult,
  WorkspaceScriptItem,
  WorkspaceScriptOperationResult,
  StartWorkspaceScriptResult,
} from "./types";

export interface PaseoClientConfig {
  url?: string;
  token?: string;
  clientId?: string;
  autoReconnect?: boolean;
  pingIntervalMs?: number;
  requestTimeoutMs?: number;
}

export type EventHandler<T = any> = (data: T) => void;

const textDecoder = new TextDecoder();

export class PaseoClient {
  private daemon: DaemonClient;
  private activeWs: any = null;
  private url: string;
  private token?: string;
  private clientId: string;
  private state: ConnectionState = "disconnected";
  private eventListeners = new Map<string, Set<EventHandler>>();
  private terminalListeners = new Map<number, Set<(data: string) => void>>();
  private terminalIdListeners = new Map<string, Set<(data: string) => void>>();
  private terminalBuffers = new Map<string, string>();
  private terminalSlots = new Map<string, number>();
  private slotTerminals = new Map<number, string>();
  private cleanupBrowserListeners: (() => void) | null = null;
  private unsubscribeDaemonEvents: (() => void) | null = null;
  private unsubscribeStatus: (() => void) | null = null;
  private unsubscribeTerminalStream: (() => void) | null = null;

  constructor(config: PaseoClientConfig = {}) {
    this.url = this.normalizeUrl(config.url || this.getDefaultUrl());
    this.token = config.token;
    this.clientId = config.clientId || this.getOrCreateClientId();

    this.daemon = this.createDaemon();
    this.setupBrowserLifecycleListeners();
  }

  private createDaemon(): DaemonClient {
    const daemon = new DaemonClient({
      url: this.url,
      clientId: this.clientId,
      clientType: "browser",
      webSocketFactory: (url, opts) => {
        const protocols = this.token ? [`paseo.bearer.${this.token}`] : opts?.protocols;
        const ws = defaultWebSocketFactory(url, { ...opts, protocols });
        this.activeWs = ws;

        // If close() is called while the socket is still CONNECTING, wait for open
        // so the browser network stack does not log an unestablished socket closure error.
        if (typeof (ws as any).close === "function") {
          const originalClose = (ws as any).close.bind(ws);
          (ws as any).close = (code?: number, reason?: string) => {
            if ((ws as any).readyState === 0) { // WebSocket.CONNECTING
              const onCloseWhenReady = () => {
                try {
                  originalClose(code, reason);
                } catch {}
              };
              if (typeof (ws as any).addEventListener === "function") {
                (ws as any).addEventListener("open", onCloseWhenReady, { once: true });
                (ws as any).addEventListener("error", onCloseWhenReady, { once: true });
                return;
              }
            }
            originalClose(code, reason);
          };
        }

        return ws;
      },
      capabilities: {
        [CLIENT_CAPS.customModeIcons]: true,
        [CLIENT_CAPS.reasoningMergeEnum]: true,
        [CLIENT_CAPS.terminalReflowableSnapshot]: true,
        [CLIENT_CAPS.providerSubagents]: true,
        [CLIENT_CAPS.projectUpdates]: true,
        [CLIENT_CAPS.compactProviderSnapshots]: true,
        [CLIENT_CAPS.timelineReplacementInvalidation]: true,
        [CLIENT_CAPS.selectiveAgentTimeline]: true,
      },
      reconnect: {
        enabled: true,
        baseDelayMs: 1000,
        maxDelayMs: 10000,
      },
    });

    this.unsubscribeStatus = daemon.subscribeConnectionStatus((status) => {
      const mapped = this.mapConnectionState(status);
      if (this.state !== mapped) {
        this.state = mapped;
        this.emit("state_change", mapped);
      }
    });

    this.unsubscribeDaemonEvents = daemon.on((event: any) => {
      const payload = event?.payload !== undefined ? event.payload : event;
      this.emit(event.type, payload);
      if (event.type === "agent_stream") {
        this.emit("agent_stream", payload);
      } else if (event.type === "agent_update") {
        this.emit("agent_update", payload);
      } else if (event.type === "workspace_update") {
        this.emit("workspace_update", payload);
      } else if (event.type === "providers_snapshot_update") {
        this.emit("providers_snapshot_update", payload);
      } else if (event.type === "agent_permission_request") {
        this.emit("agent_permission_request", payload);
      } else if (event.type === "agent_permission_resolved") {
        this.emit("agent_permission_resolved", payload);
      } else if (event.type === "agent.provider_subagents.update") {
        this.emit("agent.provider_subagents.update", payload);
      } else if (event.type === "status" && (payload as any)?.status === "server_info") {
        this.emit("server_info", payload);
      }
    });

    this.unsubscribeTerminalStream = daemon.onTerminalStreamEvent((event) => {
      if (event.type === "output" || event.type === "restore") {
        const text = textDecoder.decode(event.data);
        if (event.type === "restore") {
          this.setTerminalBuffer(event.terminalId, text);
        } else {
          this.appendTerminalBuffer(event.terminalId, text);
        }

        // Notify string terminalId listeners
        const idListeners = this.terminalIdListeners.get(event.terminalId);
        if (idListeners) {
          idListeners.forEach((fn) => {
            try {
              fn(text);
            } catch (e) {
              console.error("[PaseoClient] Error in terminalId listener:", e);
            }
          });
        }

        const slot = this.terminalSlots.get(event.terminalId);
        if (slot !== undefined) {
          const listeners = this.terminalListeners.get(slot);
          if (listeners) {
            listeners.forEach((fn) => {
              try {
                fn(text);
              } catch (e) {
                console.error("[PaseoClient] Error in slot listener:", e);
              }
            });
          }
          this.emit("terminal_data", { slot, terminalId: event.terminalId, data: text, type: event.type });
        }
      }
    });

    return daemon;
  }

  private mapConnectionState(state: DaemonConnectionState): ConnectionState {
    switch (state.status) {
      case "connected":
        return "connected";
      case "connecting":
        return state.attempt > 0 ? "reconnecting" : "connecting";
      case "idle":
      case "disconnected":
      case "disposed":
      default:
        return "disconnected";
    }
  }

  private normalizeUrl(url: string): string {
    const trimmed = url.trim();
    if (typeof window !== "undefined" && trimmed.startsWith("/")) {
      const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
      const host = window.location.host || "127.0.0.1:5555";
      return `${proto}//${host}${trimmed}`;
    }
    return trimmed;
  }

  private getDefaultUrl(): string {
    if (typeof window !== "undefined") {
      const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
      const host = window.location.host || "127.0.0.1:5555";
      return `${proto}//${host}/api/paseo/ws`;
    }
    return "ws://127.0.0.1:5555/api/paseo/ws";
  }

  private getOrCreateClientId(): string {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("amble-client-id");
      if (saved) return saved;
      const generated = `amble-${Math.random().toString(36).substring(2, 9)}-${Date.now().toString(36)}`;
      try {
        localStorage.setItem("amble-client-id", generated);
      } catch {}
      return generated;
    }
    return `amble-${Math.random().toString(36).substring(2, 9)}-${Date.now().toString(36)}`;
  }

  private setupBrowserLifecycleListeners() {
    if (typeof window === "undefined") return;

    const onVisibleOrOnline = () => {
      if (document.visibilityState === "visible" || navigator.onLine) {
        this.checkConnectionLiveness();
      }
    };

    document.addEventListener("visibilitychange", onVisibleOrOnline);
    window.addEventListener("focus", onVisibleOrOnline);
    window.addEventListener("online", onVisibleOrOnline);
    window.addEventListener("pageshow", onVisibleOrOnline);

    this.cleanupBrowserListeners = () => {
      document.removeEventListener("visibilitychange", onVisibleOrOnline);
      window.removeEventListener("focus", onVisibleOrOnline);
      window.removeEventListener("online", onVisibleOrOnline);
      window.removeEventListener("pageshow", onVisibleOrOnline);
    };
  }

  private cleanupDaemonSubscriptions() {
    if (this.unsubscribeStatus) {
      this.unsubscribeStatus();
      this.unsubscribeStatus = null;
    }
    if (this.unsubscribeDaemonEvents) {
      this.unsubscribeDaemonEvents();
      this.unsubscribeDaemonEvents = null;
    }
    if (this.unsubscribeTerminalStream) {
      this.unsubscribeTerminalStream();
      this.unsubscribeTerminalStream = null;
    }
  }

  private recreateDaemon(): DaemonClient {
    this.cleanupDaemonSubscriptions();
    try {
      void this.daemon.close();
    } catch {}
    this.daemon = this.createDaemon();
    return this.daemon;
  }

  public checkConnectionLiveness() {
    this.daemon.ensureConnected();
  }

  public getState(): ConnectionState {
    return this.state;
  }

  public getServerInfo(): ServerInfoPayload | null {
    return this.daemon.getLastServerInfoMessage() || null;
  }

  public setToken(token?: string) {
    if (this.token !== token) {
      this.token = token;
      this.recreateDaemon();
    }
  }

  public getUrl(): string {
    return this.url;
  }

  public setUrl(url: string) {
    const resolved = this.normalizeUrl(url);
    if (this.url !== resolved) {
      this.url = resolved;
      this.recreateDaemon();
    }
  }

  public async connect(forceFresh = false): Promise<ServerInfoPayload> {
    if (!this.cleanupBrowserListeners) {
      this.setupBrowserLifecycleListeners();
    }
    const daemonState = this.daemon.getConnectionState().status;
    if (forceFresh || daemonState === "disposed" || daemonState === "disconnected") {
      this.recreateDaemon();
    }
    await this.daemon.connect();
    const info = this.daemon.getLastServerInfoMessage();
    if (info) {
      this.emit("server_info", info);
      return info;
    }
    return {} as ServerInfoPayload;
  }

  public disconnect() {
    this.cleanupBrowserListeners?.();
    this.cleanupBrowserListeners = null;
    this.cleanupDaemonSubscriptions();
    this.state = "disconnected";
    this.emit("state_change", "disconnected");
    try {
      void this.daemon.close();
    } catch {}
  }

  public sendBinary(data: Uint8Array | ArrayBuffer) {
    const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
    const frame = decodeTerminalStreamFrame(bytes);
    if (frame) {
      const terminalId = this.slotTerminals.get(frame.slot);
      if (terminalId) {
        if (frame.opcode === TerminalStreamOpcode.Input) {
          const text = textDecoder.decode(frame.payload);
          this.daemon.sendTerminalInput(terminalId, { type: "input", data: text });
          return;
        } else if (frame.opcode === TerminalStreamOpcode.Resize) {
          try {
            const decoded = decodeTerminalResizePayload(frame.payload);
            if (decoded) {
              this.daemon.sendTerminalInput(terminalId, {
                type: "resize",
                cols: decoded.cols,
                rows: decoded.rows,
                intent: decoded.intent ?? "claim",
              });
              return;
            }
          } catch {}
        }
      }
    }

    if (this.activeWs && typeof this.activeWs.send === "function" && this.activeWs.readyState === 1) {
      this.activeWs.send(bytes.buffer as ArrayBuffer);
    }
  }

  // Event Subscriptions
  public on(event: string, handler: EventHandler): () => void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(handler);
    return () => {
      this.eventListeners.get(event)?.delete(handler);
    };
  }

  public emit(event: string, data: any) {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach((handler) => {
        try {
          handler(data);
        } catch (e) {
          console.error(`[PaseoClient] Error in listener for event ${event}:`, e);
        }
      });
    }
  }

  private setTerminalBuffer(terminalId: string, text: string) {
    const MAX_BUFFER_CHARS = 1_000_000;
    if (text.length > MAX_BUFFER_CHARS) {
      this.terminalBuffers.set(terminalId, text.slice(text.length - MAX_BUFFER_CHARS));
    } else {
      this.terminalBuffers.set(terminalId, text);
    }
  }

  private appendTerminalBuffer(terminalId: string, text: string) {
    const MAX_BUFFER_CHARS = 1_000_000;
    const existing = this.terminalBuffers.get(terminalId) || "";
    const updated = existing + text;
    if (updated.length > MAX_BUFFER_CHARS) {
      this.terminalBuffers.set(terminalId, updated.slice(updated.length - MAX_BUFFER_CHARS));
    } else {
      this.terminalBuffers.set(terminalId, updated);
    }
  }

  public getTerminalBuffer(slotOrId: number | string): string {
    const terminalId = typeof slotOrId === "string" ? slotOrId : this.slotTerminals.get(slotOrId);
    if (!terminalId) return "";
    return this.terminalBuffers.get(terminalId) || "";
  }

  public getTerminalSlot(terminalId: string): number | undefined {
    return this.terminalSlots.get(terminalId);
  }

  public onTerminalOutput(
    slotOrId: number | string,
    handler: (data: string) => void,
    options: { replayBuffer?: boolean } = {},
  ): () => void {
    const { replayBuffer = true } = options;
    const isId = typeof slotOrId === "string";

    if (isId) {
      if (!this.terminalIdListeners.has(slotOrId)) {
        this.terminalIdListeners.set(slotOrId, new Set());
      }
      this.terminalIdListeners.get(slotOrId)!.add(handler);
    } else {
      if (!this.terminalListeners.has(slotOrId)) {
        this.terminalListeners.set(slotOrId, new Set());
      }
      this.terminalListeners.get(slotOrId)!.add(handler);
    }

    if (replayBuffer) {
      const buffer = this.getTerminalBuffer(slotOrId);
      if (buffer) {
        try {
          handler(buffer);
        } catch (e) {
          console.error("[PaseoClient] Error replaying terminal buffer:", e);
        }
      }
    }

    return () => {
      if (isId) {
        this.terminalIdListeners.get(slotOrId)?.delete(handler);
      } else {
        this.terminalListeners.get(slotOrId)?.delete(handler);
      }
    };
  }

  public sendTerminalResize(
    terminalIdOrSlot: string | number,
    cols: number,
    rows: number,
    intent: "claim" | "update" = "claim",
  ) {
    const terminalId =
      typeof terminalIdOrSlot === "string"
        ? terminalIdOrSlot
        : this.slotTerminals.get(terminalIdOrSlot);
    if (terminalId) {
      this.daemon.sendTerminalInput(terminalId, {
        type: "resize",
        cols,
        rows,
        intent,
      });
    }
  }

  public async subscribeTerminalSession(
    terminalId: string,
    options: {
      restore?: boolean;
      mode?: "visible-snapshot" | "full-snapshot";
      scrollbackLines?: number;
      size?: { rows: number; cols: number };
    } = {},
  ): Promise<number> {
    const {
      restore = true,
      mode = "full-snapshot",
      scrollbackLines = 500,
      size,
    } = options;

    const isAlreadySubscribed = this.terminalSlots.has(terminalId);
    if (isAlreadySubscribed && restore) {
      try {
        this.daemon.unsubscribeTerminal(terminalId);
      } catch {}
    }

    const restoreOptions = restore
      ? {
          mode,
          scrollbackLines,
          ...(size ? { size } : {}),
        }
      : undefined;

    const sub = await this.daemon.subscribeTerminal(terminalId, {
      restore: restoreOptions,
    });

    if (sub.error !== null) {
      throw new Error(sub.error || `Failed to subscribe to terminal ${terminalId}`);
    }

    const slot = sub.slot;
    this.terminalSlots.set(terminalId, slot);
    this.slotTerminals.set(slot, terminalId);
    return slot;
  }

  // API Methods
  public async listProjects(): Promise<any> {
    return this.daemon.listProjects();
  }

  public async addProject(cwd: string): Promise<ProjectAddResult> {
    const res = await this.daemon.addProject(cwd);
    return res as ProjectAddResult;
  }

  public async createProjectDirectory(input: {
    parentPath: string;
    name: string;
  }): Promise<ProjectCreateDirectoryResult> {
    const res = await this.daemon.createProjectDirectory(input);
    return res as ProjectCreateDirectoryResult;
  }

  public async searchGithubRepositories(input: {
    query: string;
    limit?: number;
  }): Promise<GithubSearchRepositoriesResult> {
    const res = await this.daemon.searchGithubRepositories(input);
    return res as GithubSearchRepositoriesResult;
  }

  public async cloneGithubProject(input: {
    repo: string;
    targetDirectory: string;
    cloneProtocol?: "https" | "ssh";
  }): Promise<ProjectGithubCloneResult> {
    const res = await this.daemon.cloneGithubProject(input);
    return res as ProjectGithubCloneResult;
  }

  public async getDirectorySuggestions(options: {
    query: string;
    limit?: number;
    cwd?: string;
    includeFiles?: boolean;
    includeDirectories?: boolean;
    matchMode?: "fuzzy" | "suffix";
  }): Promise<DirectorySuggestionsResult> {
    const res = await this.daemon.getDirectorySuggestions(options);
    return res as DirectorySuggestionsResult;
  }

  public async getProjectIcon(
    projectId: string,
  ): Promise<{ icon: { mimeType: string; data: string } | null }> {
    return this.daemon.getProjectIcon(projectId) as any;
  }

  public async requestProjectIcon(
    cwd: string,
  ): Promise<{ icon: { mimeType: string; data: string } | null }> {
    return this.daemon.requestProjectIcon(cwd) as any;
  }

  public async fetchWorkspaces(): Promise<any> {
    return this.daemon.fetchWorkspaces();
  }

  public async listWorkspaceScripts(workspaceId: string): Promise<WorkspaceScriptOperationResult> {
    return this.daemon.listWorkspaceScripts(workspaceId) as any;
  }

  public async startWorkspaceScript(
    workspaceId: string,
    scriptName: string,
  ): Promise<StartWorkspaceScriptResult> {
    return this.daemon.startWorkspaceScript(workspaceId, scriptName) as any;
  }

  public async startWorkspaceScriptWithStatus(
    workspaceId: string,
    scriptName: string,
  ): Promise<WorkspaceScriptOperationResult> {
    return this.daemon.startWorkspaceScriptWithStatus(workspaceId, scriptName) as any;
  }

  public async stopWorkspaceScript(
    workspaceId: string,
    scriptName: string,
  ): Promise<WorkspaceScriptOperationResult> {
    return this.daemon.stopWorkspaceScript(workspaceId, scriptName) as any;
  }

  public async fetchAgents(
    options?: { workspaceId?: string; scope?: "active" | "all"; sort?: any } | string,
  ): Promise<any> {
    const opts = typeof options === "string" ? { workspaceId: options } : options;
    const scope = opts?.scope ?? "active";
    const res = await this.daemon.fetchAgents({
      scope: scope === "all" ? undefined : "active",
      sort: opts?.sort ?? [{ key: "created_at", direction: "asc" }],
      subscribe: { subscriptionId: "amble-agent-updates" },
    });
    const workspaceId = opts?.workspaceId;
    if (workspaceId && res && Array.isArray(res.entries)) {
      const filtered = res.entries.filter((e) => {
        const ag = e.agent || e;
        return !ag.workspaceId || ag.workspaceId === workspaceId;
      });
      return { ...res, entries: filtered };
    }
    return res;
  }

  public async openProject(cwd: string): Promise<{ workspace: WorkspaceItem }> {
    const res = await this.daemon.openProject(cwd);
    return res as any;
  }

  public async createWorktree(params: CreateWorktreeParams): Promise<CreateWorktreeResult> {
    const firstAgentContext =
      params.firstAgentContext ||
      (params.nameContext ? { prompt: params.nameContext } : undefined);
    const res = await this.daemon.createPaseoWorktree({
      cwd: params.cwd,
      projectId: params.projectId,
      worktreeSlug: params.worktreeSlug,
      refName: params.refName,
      action: params.action,
      firstAgentContext: firstAgentContext as any,
    });
    return res as any;
  }

  public async getBranchSuggestions(params: {
    cwd: string;
    query?: string;
    limit?: number;
  }): Promise<string[]> {
    try {
      const res = await this.daemon.getBranchSuggestions(params);
      return res?.branches || [];
    } catch {
      return [];
    }
  }

  public async validateBranch(params: {
    cwd: string;
    branchName: string;
  }): Promise<{ exists: boolean; resolvedRef?: string | null; error?: string | null }> {
    try {
      const res = await this.daemon.validateBranch(params);
      return res || { exists: false, resolvedRef: null, error: null };
    } catch (err: any) {
      return { exists: false, resolvedRef: null, error: err?.message || String(err) };
    }
  }

  public async fetchAgentTimeline(agentId: string): Promise<{ entries: any[] }> {
    return this.daemon.fetchAgentTimeline(agentId);
  }

  public async listProviderSubagents(parentAgentId: string): Promise<{ subagents: any[] }> {
    try {
      if (typeof (this.daemon as any).listProviderSubagents === "function") {
        return await (this.daemon as any).listProviderSubagents(parentAgentId);
      }
      return { subagents: [] };
    } catch (err) {
      console.warn("[PaseoClient] listProviderSubagents error:", err);
      return { subagents: [] };
    }
  }

  public async fetchProviderSubagentTimeline(
    parentAgentId: string,
    subagentId: string,
    options?: any,
  ): Promise<{ rows: any[] }> {
    try {
      if (typeof (this.daemon as any).fetchProviderSubagentTimeline === "function") {
        return await (this.daemon as any).fetchProviderSubagentTimeline(
          parentAgentId,
          subagentId,
          options,
        );
      }
      return { rows: [] };
    } catch (err) {
      console.warn("[PaseoClient] fetchProviderSubagentTimeline error:", err);
      return { rows: [] };
    }
  }

  public async listCommands(
    options?: { agentId?: string; draftConfig?: any; timeout?: number } | string,
  ): Promise<AgentSlashCommand[]> {
    const opts = typeof options === "string" ? { agentId: options } : options;
    const agentId = opts?.agentId || "";
    if (!agentId) return [];
    try {
      const res = await this.daemon.listCommands({ ...opts, agentId });
      return (res?.commands as AgentSlashCommand[]) || [];
    } catch (err) {
      console.warn("[PaseoClient] listCommands error:", err);
      return [];
    }
  }

  public async createAgent(params: {
    workspaceId: string;
    cwd: string;
    provider?: string;
    model?: string;
    mode?: string | null;
    thinkingEffort?: string;
    initialPrompt?: string;
    clientMessageId?: string;
    images?: Array<{ data: string; mimeType: string }>;
  }): Promise<{ agent: AgentSnapshot }> {
    const agent = await this.daemon.createAgent({
      workspaceId: params.workspaceId,
      cwd: params.cwd,
      config: {
        provider: params.provider || "opencode",
        cwd: params.cwd,
        model: params.model,
        modeId: params.mode || undefined,
        thinkingOptionId: params.thinkingEffort === "off" ? undefined : params.thinkingEffort,
      },
      initialPrompt: params.initialPrompt,
      clientMessageId: params.clientMessageId,
      images: params.images,
    });
    return { agent: agent as any };
  }

  public async sendAgentMessage(params: {
    agentId: string;
    text: string;
    attachments?: string[];
    images?: Array<{ data: string; mimeType: string }>;
    messageId?: string;
    activeTurnBehavior?: ActiveTurnBehavior;
  }): Promise<{ accepted: boolean }> {
    await this.setAgentTimelineSubscription([params.agentId]).catch(() => {});
    if (params.activeTurnBehavior === "followup") {
      if (typeof (this.daemon as any).waitForFinish === "function") {
        await (this.daemon as any).waitForFinish(params.agentId).catch(() => {});
      }
      await this.daemon.sendAgentMessage(params.agentId, params.text, {
        attachments: params.attachments as any,
        images: params.images,
        messageId: params.messageId,
      });
      return { accepted: true };
    }
    await this.daemon.sendAgentMessage(params.agentId, params.text, {
      attachments: params.attachments as any,
      images: params.images,
      messageId: params.messageId,
      activeTurnBehavior: params.activeTurnBehavior,
    });
    return { accepted: true };
  }

  public async cancelAgent(agentId: string): Promise<void> {
    return this.daemon.cancelAgent(agentId);
  }

  public async archiveAgent(agentId: string): Promise<any> {
    return this.daemon.archiveAgent(agentId);
  }

  public async updateAgent(
    agentId: string,
    updates: { name?: string; labels?: Record<string, string> },
  ): Promise<void> {
    return this.daemon.updateAgent(agentId, updates);
  }

  public async setAgentModel(
    agentId: string,
    modelId: string | null,
  ): Promise<{ accepted: boolean; error?: string | null }> {
    await this.daemon.setAgentModel(agentId, modelId);
    return { accepted: true };
  }

  public async setAgentThinking(
    agentId: string,
    thinkingOptionId: string | null,
  ): Promise<{ accepted: boolean; error?: string | null }> {
    await this.daemon.setAgentThinkingOption(agentId, thinkingOptionId);
    return { accepted: true };
  }

  public async setAgentMode(
    agentId: string,
    modeId: string,
  ): Promise<{ accepted: boolean; error?: string | null }> {
    const notice = await this.daemon.setAgentMode(agentId, modeId);
    return { accepted: true, error: notice?.message };
  }

  public async respondToPermission(
    agentId: string,
    requestId: string,
    response: AgentPermissionResponse,
  ): Promise<void> {
    return this.daemon.respondToPermission(agentId, requestId, response);
  }

  public async setAgentTimelineSubscription(agentIds: string[]): Promise<void> {
    return this.daemon.setAgentTimelineSubscription(agentIds);
  }

  public async getProvidersSnapshot(): Promise<any> {
    return this.daemon.getProvidersSnapshot();
  }

  public async listTerminals(workspaceId?: string): Promise<{ terminals: TerminalSessionInfo[] }> {
    const res = await this.daemon.listTerminals(
      undefined,
      undefined,
      workspaceId ? { workspaceId } : undefined,
    );
    const list: TerminalSessionInfo[] = [];
    if (res && Array.isArray(res.terminals)) {
      for (const t of res.terminals) {
        let slot = this.terminalSlots.get(t.id);
        if (slot === undefined) {
          try {
            const sub = await this.daemon.subscribeTerminal(t.id, {
              restore: { mode: "full-snapshot", scrollbackLines: 500 },
            });
            if (sub.error === null) {
              slot = sub.slot;
              this.terminalSlots.set(t.id, slot);
              this.slotTerminals.set(slot, t.id);
            }
          } catch (e) {
            console.warn(`[PaseoClient] Failed to subscribe to terminal ${t.id}:`, e);
          }
        }
        list.push({
          id: t.id,
          slot: slot ?? 0,
          title: t.title || t.name,
          rows: 24,
          cols: 80,
          cwd: res.cwd,
          workspaceId: t.workspaceId || workspaceId,
        });
      }
    }
    return { terminals: list };
  }

  public async createTerminal(params: {
    workspaceId?: string;
    cols?: number;
    rows?: number;
    cwd?: string;
  }): Promise<{ terminalId: string; slot: number }> {
    const res = await this.daemon.createTerminal(params.cwd || "", undefined, undefined, {
      workspaceId: params.workspaceId,
      size: params.cols && params.rows ? { cols: params.cols, rows: params.rows } : undefined,
    });
    if (!res.terminal) {
      throw new Error(res.error || "Failed to create terminal");
    }
    const terminalId = res.terminal.id;
    const sub = await this.daemon.subscribeTerminal(terminalId, {
      restore: { mode: "full-snapshot", scrollbackLines: 500 },
    });
    if (sub.error !== null) {
      throw new Error(sub.error || "Failed to subscribe to terminal");
    }
    const slot = sub.slot;
    this.terminalSlots.set(terminalId, slot);
    this.slotTerminals.set(slot, terminalId);
    return { terminalId, slot };
  }

  public async killTerminal(terminalId: string): Promise<any> {
    const slot = this.terminalSlots.get(terminalId);
    if (slot !== undefined) {
      this.terminalSlots.delete(terminalId);
      this.slotTerminals.delete(slot);
    }
    this.terminalBuffers.delete(terminalId);
    this.terminalIdListeners.delete(terminalId);
    return this.daemon.killTerminal(terminalId);
  }

  public async renameTerminal(params: {
    terminalId: string;
    title: string;
  }): Promise<{ success: boolean }> {
    const res = await this.daemon.renameTerminal(params);
    return { success: (res as any)?.success ?? true };
  }

  private diffFileToGitChange(file: {
    path: string;
    oldPath?: string;
    isNew: boolean;
    isDeleted: boolean;
    additions: number;
    deletions: number;
    hunks: Array<{
      lines: Array<{ type: "context" | "add" | "remove" | "header"; content: string }>;
    }>;
  }): GitFileChange {
    const status: GitFileChange["status"] = file.isNew
      ? "added"
      : file.isDeleted
        ? "deleted"
        : file.oldPath && file.oldPath !== file.path
          ? "renamed"
          : "modified";
    // Reconstruct unified diff text for the existing DiffViewer.
    const lines: string[] = [];
    lines.push(`--- a/${file.oldPath || file.path}`);
    lines.push(`+++ b/${file.path}`);
    for (const hunk of file.hunks || []) {
      for (const line of hunk.lines || []) {
        if (line.type === "add") lines.push(`+${line.content}`);
        else if (line.type === "remove") lines.push(`-${line.content}`);
        else lines.push(line.type === "header" ? line.content : ` ${line.content}`);
      }
    }
    return {
      path: file.path,
      status,
      insertions: file.additions,
      deletions: file.deletions,
      diff: lines.join("\n"),
    };
  }

  public async getGitStatus(workspaceIdOrCwd: string): Promise<GitStatusSummary> {
    const empty: GitStatusSummary = {
      branch: "main",
      ahead: 0,
      behind: 0,
      isClean: true,
      stagedFiles: [],
      unstagedFiles: [],
      untrackedFiles: [],
    };
    try {
      const res = await this.daemon.getCheckoutStatus(workspaceIdOrCwd);
      // checkout_status carries only branch/dirty metadata — the actual file
      // list lives behind getCheckoutDiff({ mode: "uncommitted" }).
      let files: GitFileChange[] = [];
      try {
        const cwd = (res as any).cwd || workspaceIdOrCwd;
        const diff = await this.daemon.getCheckoutDiff(cwd, { mode: "uncommitted" });
        files = ((diff as any)?.files || []).map((f: any) => this.diffFileToGitChange(f));
      } catch (diffErr) {
        console.warn("[PaseoClient] getCheckoutDiff error:", diffErr);
      }
      const isDirty = (res as any).isDirty ?? files.length > 0;
      const aheadBehind = (res as any).aheadBehind;
      return {
        branch: (res as any).currentBranch || "main",
        upstream: (res as any).upstreamRef || undefined,
        ahead: aheadBehind?.ahead ?? (res as any).aheadOfOrigin ?? 0,
        behind: aheadBehind?.behind ?? (res as any).behindOfOrigin ?? 0,
        isClean: !isDirty && files.length === 0,
        stagedFiles: [],
        unstagedFiles: files,
        untrackedFiles: files.filter((f) => f.status === "added").map((f) => f.path),
      };
    } catch {
      return empty;
    }
  }

  public async commitGitChanges(params: {
    workspaceId: string;
    message: string;
    cwd?: string;
  }): Promise<{ commitSha: string }> {
    const res = await this.daemon.checkoutCommit(params.cwd || params.workspaceId, {
      message: params.message,
      addAll: true,
    });
    const payload = res as any;
    if (payload && payload.success === false) {
      throw new Error(payload.error?.message || "Commit failed");
    }
    return payload;
  }

  public checkoutPrStatus(cwd: string) {
    return this.daemon.checkoutPrStatus(cwd);
  }

  public checkoutRefresh(cwd: string) {
    return this.daemon.checkoutRefresh(cwd);
  }

  public checkoutPull(cwd: string) {
    return this.daemon.checkoutPull(cwd);
  }

  public checkoutPush(cwd: string) {
    return this.daemon.checkoutPush(cwd);
  }

  public checkoutMerge(cwd: string, input: Parameters<DaemonClient["checkoutMerge"]>[1]) {
    return this.daemon.checkoutMerge(cwd, input);
  }

  public checkoutMergeFromBase(
    cwd: string,
    input: Parameters<DaemonClient["checkoutMergeFromBase"]>[1],
  ) {
    return this.daemon.checkoutMergeFromBase(cwd, input);
  }

  public checkoutPrCreate(cwd: string, input: Parameters<DaemonClient["checkoutPrCreate"]>[1]) {
    return this.daemon.checkoutPrCreate(cwd, input);
  }

  public checkoutPrMerge(cwd: string, input: Parameters<DaemonClient["checkoutPrMerge"]>[1]) {
    return this.daemon.checkoutPrMerge(cwd, input);
  }

  public checkoutForgeSetAutoMerge(
    cwd: string,
    input: Parameters<DaemonClient["checkoutForgeSetAutoMerge"]>[1],
  ) {
    return this.daemon.checkoutForgeSetAutoMerge(cwd, input);
  }

  public archiveWorkspace(workspaceId: string) {
    return this.daemon.archiveWorkspace(workspaceId);
  }

  public async setWorkspaceTitle(
    workspaceId: string,
    title: string | null,
  ): Promise<{ title: string | null }> {
    const res = await this.daemon.setWorkspaceTitle(workspaceId, title);
    return res;
  }

  public async getDaemonConfig(): Promise<{ config: any }> {
    return this.daemon.getDaemonConfig();
  }

  public async patchDaemonConfig(config: any): Promise<any> {
    return this.daemon.patchDaemonConfig(config);
  }
}
