import { CLIENT_CAPS } from "@getpaseo/protocol/client-capabilities";
import {
  type ConnectionState,
  type WSHelloMessage,
  type ServerInfoPayload,
  type WorkspaceItem,
  type AgentSnapshot,
  type TimelineItem,
  type TerminalSessionInfo,
  type GitStatusSummary,
  TerminalOpcode,
} from "./types";
import { decodeTerminalFrame, decodeTerminalPayloadAsString, encodeTerminalFrame } from "./binary-codec";

export interface PaseoClientConfig {
  url?: string;
  token?: string;
  clientId?: string;
  autoReconnect?: boolean;
  pingIntervalMs?: number;
  requestTimeoutMs?: number;
}

export type EventHandler<T = any> = (data: T) => void;

export class PaseoClient {
  private ws: WebSocket | null = null;
  private url: string;
  private token?: string;
  private clientId: string;
  private state: ConnectionState = "disconnected";
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private livenessTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private lastActivityAt: number = Date.now();
  private readonly maxReconnectDelay = 10000;
  private readonly pingIntervalMs: number;
  private readonly requestTimeoutMs: number;
  private readonly livenessTimeoutMs = 15000;

  private pendingRequests = new Map<
    string,
    {
      resolve: (value: any) => void;
      reject: (reason?: any) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();

  private eventListeners = new Map<string, Set<EventHandler>>();
  private terminalListeners = new Map<number, Set<(data: string) => void>>();
  private cleanupBrowserListeners: (() => void) | null = null;

  constructor(config: PaseoClientConfig = {}) {
    this.url = config.url || this.getDefaultUrl();
    this.token = config.token;
    this.clientId = config.clientId || this.getOrCreateClientId();
    this.pingIntervalMs = config.pingIntervalMs || 4000;
    this.requestTimeoutMs = config.requestTimeoutMs || 30000;

    this.setupBrowserLifecycleListeners();
  }

  private getDefaultUrl(): string {
    if (typeof window !== "undefined") {
      const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
      const host = window.location.hostname || "127.0.0.1";
      return `${proto}//${host}:6767/ws`;
    }
    return "ws://127.0.0.1:6767/ws";
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

  public checkConnectionLiveness() {
    if (this.state === "disconnected") return;

    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.log("[PaseoClient] Socket is not open on visibility restore, reconnecting...");
      this.reconnectAttempts = 0;
      this.scheduleReconnect(100);
      return;
    }

    const elapsed = Date.now() - this.lastActivityAt;
    if (elapsed > this.livenessTimeoutMs) {
      console.log(`[PaseoClient] No socket activity for ${Math.round(elapsed / 1000)}s, recycling connection...`);
      this.ws.close();
    } else {
      this.sendPing();
    }
  }

  public getState(): ConnectionState {
    return this.state;
  }

  public setToken(token?: string) {
    this.token = token;
  }

  public setUrl(url: string) {
    this.url = url;
  }

  public connect(): Promise<ServerInfoPayload> {
    return new Promise((resolve, reject) => {
      this.cleanup();
      this.setState("connecting");

      try {
        const protocols = this.token ? [`paseo.bearer.${this.token}`] : [];
        const ws = new WebSocket(this.url, protocols);
        ws.binaryType = "arraybuffer";
        this.ws = ws;
        this.lastActivityAt = Date.now();

        let helloResolved = false;

        const onConnectTimeout = setTimeout(() => {
          if (!helloResolved) {
            this.setState("error");
            ws.close();
            reject(new Error("Connection timed out waiting for server info"));
          }
        }, 12000);

        ws.onopen = () => {
          this.lastActivityAt = Date.now();
          this.sendHello();
        };

        ws.onmessage = (event) => {
          this.lastActivityAt = Date.now();
          if (typeof event.data === "string") {
            try {
              const raw = JSON.parse(event.data);
              this.handleRawInboundMessage(raw, (info) => {
                if (!helloResolved) {
                  helloResolved = true;
                  clearTimeout(onConnectTimeout);
                  this.reconnectAttempts = 0;
                  this.setState("connected");
                  this.startHeartbeat();
                  resolve(info);
                }
              });
            } catch (err) {
              console.error("[PaseoClient] Failed to parse message:", event.data, err);
            }
          } else if (event.data instanceof ArrayBuffer) {
            this.handleBinaryMessage(event.data);
          }
        };

        ws.onerror = (err) => {
          console.warn("[PaseoClient] WebSocket error:", err);
          if (!helloResolved) {
            clearTimeout(onConnectTimeout);
            this.setState("error");
            reject(new Error("WebSocket connection failed"));
          }
        };

        ws.onclose = (ev) => {
          console.log(`[PaseoClient] WebSocket closed (${ev.code}: ${ev.reason})`);
          this.stopHeartbeat();
          if (this.state !== "disconnected") {
            this.scheduleReconnect();
          }
        };
      } catch (err) {
        this.setState("error");
        reject(err);
      }
    });
  }

  public disconnect() {
    this.setState("disconnected");
    this.cleanup();
  }

  private cleanup() {
    this.stopHeartbeat();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.onmessage = null;
      this.ws.onopen = null;
      try {
        this.ws.close();
      } catch {}
      this.ws = null;
    }
    for (const [_, req] of this.pendingRequests.entries()) {
      clearTimeout(req.timer);
      req.reject(new Error("Connection closed"));
    }
    this.pendingRequests.clear();
  }

  private setState(state: ConnectionState) {
    if (this.state !== state) {
      this.state = state;
      this.emit("state_change", state);
    }
  }

  private sendHello() {
    const hello: WSHelloMessage = {
      type: "hello",
      clientId: this.clientId,
      clientType: "browser",
      protocolVersion: 1,
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
    };
    this.sendJson(hello);
  }

  private sendPing() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.sendJson({ type: "ping" });
    }
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.lastActivityAt = Date.now();

    // 1. Send application ping every 4s to claim/renew socket lease
    this.pingTimer = setInterval(() => {
      this.sendPing();
    }, this.pingIntervalMs);

    // 2. Check liveness: if no traffic/pong seen in 15s, proactively recycle connection
    this.livenessTimer = setInterval(() => {
      if (this.state === "connected") {
        const elapsed = Date.now() - this.lastActivityAt;
        if (elapsed > this.livenessTimeoutMs) {
          console.warn(`[PaseoClient] Liveness failure (${Math.round(elapsed / 1000)}s without traffic), reconnecting...`);
          if (this.ws) {
            try {
              this.ws.close();
            } catch {}
          }
        }
      }
    }, 5000);
  }

  private stopHeartbeat() {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
    if (this.livenessTimer) {
      clearInterval(this.livenessTimer);
      this.livenessTimer = null;
    }
  }

  private scheduleReconnect(explicitDelayMs?: number) {
    this.setState("reconnecting");
    this.reconnectAttempts++;
    const delay =
      explicitDelayMs !== undefined
        ? explicitDelayMs
        : Math.min(1000 * Math.pow(1.4, this.reconnectAttempts - 1), this.maxReconnectDelay);

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect().catch((err) => {
        console.warn("[PaseoClient] Reconnect attempt failed:", err);
      });
    }, delay);
  }

  private sendJson(msg: object) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  public sendBinary(data: Uint8Array | ArrayBuffer) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      if (data instanceof Uint8Array) {
        this.ws.send(data.buffer as ArrayBuffer);
      } else {
        this.ws.send(data);
      }
    }
  }

  private handleRawInboundMessage(raw: any, onServerInfo?: (info: ServerInfoPayload) => void) {
    if (!raw) return;

    if (raw.type === "pong") {
      this.lastActivityAt = Date.now();
      return;
    }

    // Unwrap session frames
    const msg = raw.type === "session" && raw.message ? raw.message : raw;

    // Check for server_info status frame
    if (msg.type === "status" && msg.payload?.status === "server_info") {
      this.emit("server_info", msg.payload);
      if (onServerInfo) {
        onServerInfo(msg.payload);
      }
      return;
    }

    // Correlate RPC responses
    const reqId = msg.requestId || msg.payload?.requestId;
    if (reqId && this.pendingRequests.has(reqId)) {
      const pending = this.pendingRequests.get(reqId)!;
      this.pendingRequests.delete(reqId);
      clearTimeout(pending.timer);

      if (msg.type === "rpc_error" || msg.error || (msg.payload && msg.payload.error)) {
        pending.reject(new Error(msg.payload?.error || msg.error || "RPC error"));
      } else {
        pending.resolve(msg.payload !== undefined ? msg.payload : msg);
      }
      return;
    }

    // Event routing
    this.emit(msg.type, msg.payload || msg);
    if (msg.type === "agent_stream") {
      this.emit("agent_stream", msg.payload || msg);
    } else if (msg.type === "agent_update") {
      this.emit("agent_update", msg.payload || msg);
    } else if (msg.type === "workspace_update") {
      this.emit("workspace_update", msg.payload || msg);
    } else if (msg.type === "providers_snapshot_update") {
      this.emit("providers_snapshot_update", msg.payload || msg);
    }
  }

  private handleBinaryMessage(buffer: ArrayBuffer) {
    this.lastActivityAt = Date.now();
    const frame = decodeTerminalFrame(buffer);
    if (!frame) return;

    if (frame.opcode === TerminalOpcode.Output || frame.opcode === TerminalOpcode.Snapshot) {
      const text = decodeTerminalPayloadAsString(frame.payload);
      const listeners = this.terminalListeners.get(frame.slot);
      if (listeners) {
        listeners.forEach((fn) => fn(text));
      }
      this.emit("terminal_data", { slot: frame.slot, data: text });
    }
  }

  // Session RPC Request
  public async request<T = any>(type: string, payload: Record<string, any> = {}): Promise<T> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error("Client is not connected to Paseo daemon");
    }

    const requestId = `req-${Math.random().toString(36).substring(2, 9)}-${Date.now()}`;
    const innerMessage = {
      type,
      requestId,
      ...payload,
    };

    const envelope = {
      type: "session",
      message: innerMessage,
    };

    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          this.pendingRequests.delete(requestId);
          reject(new Error(`Request ${type} (${requestId}) timed out`));
        }
      }, this.requestTimeoutMs);

      this.pendingRequests.set(requestId, { resolve, reject, timer });
      this.sendJson(envelope);
    });
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

  public onTerminalOutput(slot: number, handler: (data: string) => void): () => void {
    if (!this.terminalListeners.has(slot)) {
      this.terminalListeners.set(slot, new Set());
    }
    this.terminalListeners.get(slot)!.add(handler);
    return () => {
      this.terminalListeners.get(slot)?.delete(handler);
    };
  }

  // API Methods
  public async fetchWorkspaces(): Promise<any> {
    return this.request("fetch_workspaces_request", {});
  }

  public async fetchAgents(workspaceId?: string): Promise<any> {
    return this.request("fetch_agents_request", {
      filter: workspaceId ? { workspaceId } : undefined,
    });
  }

  public async openProject(cwd: string): Promise<{ workspace: WorkspaceItem }> {
    return this.request("open_project_request", { cwd });
  }

  public async fetchAgentTimeline(agentId: string): Promise<{ entries: any[] }> {
    return this.request("fetch_agent_timeline_request", { agentId });
  }

  public async createAgent(params: {
    workspaceId: string;
    cwd: string;
    provider?: string;
    model?: string;
    mode?: string;
    thinkingEffort?: string;
    initialPrompt?: string;
  }): Promise<{ agent: AgentSnapshot }> {
    return this.request("create_agent_request", {
      config: {
        provider: params.provider || "opencode",
        cwd: params.cwd,
        model: params.model,
        modeId: params.mode || "build",
        thinkingOptionId: params.thinkingEffort === "off" ? undefined : params.thinkingEffort,
      },
      workspaceId: params.workspaceId,
      initialPrompt: params.initialPrompt,
      attachments: [],
      labels: {},
    });
  }

  public async sendAgentMessage(params: {
    agentId: string;
    text: string;
    attachments?: string[];
  }): Promise<{ accepted: boolean }> {
    await this.setAgentTimelineSubscription([params.agentId]).catch(() => {});
    return this.request("send_agent_message_request", {
      agentId: params.agentId,
      text: params.text,
      attachments: params.attachments || [],
    });
  }

  public async cancelAgent(agentId: string): Promise<void> {
    return this.request("cancel_agent_request", { agentId });
  }

  public async setAgentTimelineSubscription(agentIds: string[]): Promise<void> {
    return this.request("agent.timeline.set_subscription.request", {
      agentIds: [...new Set(agentIds)].sort(),
    });
  }

  public async getProvidersSnapshot(): Promise<any> {
    return this.request("get_providers_snapshot_request", {});
  }

  public async listTerminals(workspaceId?: string): Promise<{ terminals: TerminalSessionInfo[] }> {
    return this.request("list_terminals_request", { workspaceId });
  }

  public async createTerminal(params: {
    workspaceId?: string;
    cols?: number;
    rows?: number;
  }): Promise<{ terminalId: string; slot: number }> {
    return this.request("create_terminal_request", params);
  }

  public async getGitStatus(workspaceId: string): Promise<GitStatusSummary> {
    return this.request("checkout_status_request", { workspaceId });
  }

  public async commitGitChanges(params: {
    workspaceId: string;
    message: string;
  }): Promise<{ commitSha: string }> {
    return this.request("checkout_commit_request", params);
  }
}
