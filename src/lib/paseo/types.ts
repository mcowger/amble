// Wire types and data contracts for the Paseo Daemon WebSocket API

export type ConnectionState = "disconnected" | "connecting" | "connected" | "reconnecting" | "error";

export interface ClientCapabilities {
  custom_mode_icons?: boolean;
  reasoning_merge_enum?: boolean;
  terminal_reflowable_snapshot?: boolean;
  provider_subagents?: boolean;
  project_updates?: boolean;
  compact_provider_snapshots?: boolean;
  timeline_replacement_invalidation?: boolean;
  selective_agent_timeline?: boolean;
  [key: string]: unknown;
}

export interface WSHelloMessage {
  type: "hello";
  clientId: string;
  clientType: "browser";
  protocolVersion: 1;
  capabilities: ClientCapabilities;
}

export interface ServerInfoPayload {
  version?: string;
  capabilities?: Record<string, unknown>;
  authRequired?: boolean;
  serverId?: string;
  daemonVersion?: string;
  features?: string[];
  [key: string]: unknown;
}

export interface ServerInfoMessage {
  type: "server_info";
  payload: ServerInfoPayload;
}

export interface PingMessage {
  type: "ping";
}

export interface PongMessage {
  type: "pong";
}

// Top level protocol envelope
export interface WSInboundMessage {
  type: string;
  requestId?: string;
  payload?: any;
  error?: string;
  event?: string;
  [key: string]: unknown;
}

// Workspaces & Projects
export interface WorkspaceItem {
  id: string;
  name: string;
  path: string;
  icon?: string;
  isFavorite?: boolean;
  activeAgentId?: string;
  lastActiveAt?: string;
  worktrees?: WorktreeItem[];
}

export interface WorktreeItem {
  id: string;
  name: string;
  path: string;
  branch?: string;
  isClean?: boolean;
}

// Agent / Session
export interface AgentModel {
  id: string;
  name: string;
  provider: string;
  agentProvider?: string;
  providerName?: string;
  displayName?: string;
  description?: string;
  contextWindow?: number;
  outputLimit?: number;
  reasoningSupported?: boolean;
  thinkingSetIndex?: number;
  thinkingOptions?: Array<{ id: string; label: string; isDefault?: boolean }>;
  availableModes?: AgentMode[];
  defaultModeId?: string | null;
  cost?: {
    input: number;
    output: number;
    cache?: { read: number; write: number };
  };
}

export interface AgentMode {
  id: string;
  name: string;
  icon?: string;
  description?: string;
  colorTier?: string;
}

export interface AgentSnapshot {
  id: string;
  provider?: string;
  workspaceId?: string;
  name?: string;
  title?: string;
  status: "idle" | "running" | "paused" | "completed" | "failed" | "canceled";
  model?: string | null;
  currentModeId?: string | null;
  thinkingOptionId?: string | null;
  effectiveThinkingOptionId?: string | null;
  capabilities?: {
    supportsDynamicModes?: boolean;
  };
  availableModes?: AgentMode[];
  createdAt: string;
  updatedAt: string;
  activeTurnId?: string;
  turnsCount?: number;
  tokenUsage?: {
    inputTokens?: number;
    outputTokens?: number;
    reasoningTokens?: number;
    totalCost?: number;
    contextWindow?: number;
  };
  labels?: Record<string, string>;
}

// Timeline items
export interface UserMessageTimelineItem {
  type: "user_message";
  text: string;
  messageId?: string;
  clientMessageId?: string;
  timestamp?: string;
  attachments?: string[];
}

export interface AssistantMessageTimelineItem {
  type: "assistant_message";
  text: string;
  messageId?: string;
  timestamp?: string;
  model?: string;
}

export interface ReasoningTimelineItem {
  type: "reasoning";
  text: string;
  isStreaming?: boolean;
  durationMs?: number;
  startedAt?: number;
}

export interface ToolCallTimelineItem {
  type: "tool_call";
  tool: string;
  callId: string;
  input: Record<string, unknown> | string | unknown;
  output?: Record<string, unknown> | string | unknown;
  status: "running" | "completed" | "failed" | "canceled";
  error?: unknown;
  title?: string;
  elapsedMs?: number;
  diff?: string;
  filePath?: string;
}

export interface TodoItem {
  id?: string;
  text: string;
  completed: boolean;
  status?: "pending" | "in_progress" | "completed";
  activeForm?: string;
}

export interface TodoTimelineItem {
  type: "todo";
  items: TodoItem[];
}

export interface ErrorTimelineItem {
  type: "error";
  message: string;
  code?: string;
}

export interface PermissionRequestTimelineItem {
  type: "permission_request";
  requestId: string;
  tool: string;
  params: Record<string, unknown>;
  status: "pending" | "granted" | "denied";
}

export type TimelineItem =
  | UserMessageTimelineItem
  | AssistantMessageTimelineItem
  | ReasoningTimelineItem
  | ToolCallTimelineItem
  | TodoTimelineItem
  | ErrorTimelineItem
  | PermissionRequestTimelineItem;

// Agent Stream Events
export type AgentStreamEvent =
  | { type: "thread_started"; sessionId: string; provider: unknown }
  | { type: "turn_started"; turnId?: string; provider: unknown }
  | { type: "turn_completed"; turnId?: string; usage?: unknown; provider: unknown }
  | { type: "turn_failed"; error: string; code?: string; diagnostic?: string; provider: unknown }
  | { type: "turn_canceled"; reason: string; provider: unknown }
  | { type: "timeline"; item: TimelineItem; turnId?: string; provider: unknown }
  | { type: "permission_requested"; request: { id: string; tool: string; params: unknown } }
  | { type: "permission_resolved"; requestId: string; resolution: unknown }
  | { type: "attention_required"; reason: string; notification?: unknown };

// Terminal frame opcodes
export const TerminalOpcode = {
  Output: 0x01,
  Input: 0x02,
  Resize: 0x03,
  Snapshot: 0x04,
  Restore: 0x05,
} as const;

export type TerminalOpcode = (typeof TerminalOpcode)[keyof typeof TerminalOpcode];

export interface TerminalFrame {
  opcode: TerminalOpcode;
  slot: number;
  payload: Uint8Array;
}

export interface TerminalSessionInfo {
  id: string;
  slot: number;
  title?: string;
  rows: number;
  cols: number;
  cwd?: string;
}

// Git Status & Diffs
export interface GitStatusSummary {
  branch: string;
  upstream?: string;
  ahead: number;
  behind: number;
  isClean: boolean;
  stagedFiles: GitFileChange[];
  unstagedFiles: GitFileChange[];
  untrackedFiles: string[];
}

export interface GitFileChange {
  path: string;
  status: "added" | "modified" | "deleted" | "renamed";
  insertions?: number;
  deletions?: number;
  diff?: string;
}
