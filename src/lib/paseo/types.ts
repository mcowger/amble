// Wire types and protocol contracts re-exported from @getpaseo/protocol
import {
  TerminalStreamOpcode,
  type TerminalStreamFrame,
} from "@getpaseo/protocol/binary-frames/index";
import type {
  ServerInfoStatusPayload,
  WSHelloMessage,
  SessionInboundMessage,
  SessionOutboundMessage,
} from "@getpaseo/protocol/messages";
import type { ClientCapability } from "@getpaseo/protocol/client-capabilities";
import type {
  AgentPermissionResponse,
  AgentPermissionAction,
  AgentPermissionRequest,
  AgentStreamEvent,
} from "@getpaseo/protocol/agent-types";

// Terminal frame opcodes and framing from protocol
export const TerminalOpcode = TerminalStreamOpcode;
export type TerminalOpcode = TerminalStreamOpcode;
export type TerminalFrame = TerminalStreamFrame;

// Wire Protocol Types re-exported from @getpaseo/protocol
export type ServerInfoPayload = ServerInfoStatusPayload;
export type ClientCapabilities = Partial<Record<ClientCapability, unknown>> & {
  [key: string]: unknown;
};

export type {
  WSHelloMessage,
  AgentPermissionResponse,
  AgentPermissionAction,
  AgentPermissionRequest,
  AgentStreamEvent,
  SessionInboundMessage,
  SessionOutboundMessage,
};

export interface QuestionOption {
  label: string;
  description?: string;
}

export interface QuestionFormQuestion {
  question: string;
  header: string;
  options: QuestionOption[];
  multiSelect?: boolean;
  allowOther?: boolean;
  allowEmpty?: boolean;
  placeholder?: string;
  dismissLabel?: string;
}

export type ConnectionState = "disconnected" | "connecting" | "connected" | "reconnecting" | "error";

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
export interface ProjectItem {
  id: string;
  projectKey?: string;
  name: string;
  rootPath: string;
  projectKind?: string;
}

export interface WorkspaceItem {
  id: string;
  name: string;
  title?: string;
  path: string;
  icon?: string;
  isFavorite?: boolean;
  activeAgentId?: string;
  lastActiveAt?: string;
  worktrees?: WorktreeItem[];
  projectId?: string;
  projectKey?: string;
  workspaceKind?: "local_checkout" | "worktree" | "directory";
  worktreeSlug?: string;
  branch?: string;
  scripts?: WorkspaceScriptItem[];
}

export interface WorktreeItem {
  id: string;
  name: string;
  title?: string;
  path: string;
  branch?: string;
  isClean?: boolean;
}

export interface MetadataGenerationProviderConfig {
  provider: string;
  model?: string;
  thinkingOptionId?: string;
}

export interface MetadataGenerationConfig {
  providers?: MetadataGenerationProviderConfig[];
}

export interface CreateWorktreeParams {
  cwd: string;
  projectId?: string;
  worktreeSlug?: string;
  refName?: string;
  action?: "branch-off" | "checkout";
  nameContext?: string;
  firstAgentContext?: {
    prompt?: string;
    attachments?: any[];
  };
  title?: string;
}

export interface CreateWorktreeResult {
  workspace?: WorkspaceItem | null;
  error?: string | null;
  errorCode?: string;
}

// Agent / Session
export interface ImageAttachment {
  data: string;
  mimeType: string;
  name?: string;
  size?: number;
}

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
  supportsVision?: boolean;
  metadata?: Record<string, unknown>;
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
  cwd?: string;
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
  pendingPermissions?: AgentPermissionRequest[];
  requiresAttention?: boolean;
  attentionReason?: string | null;
  createdAt: string;
  updatedAt: string;
  project?: {
    projectKey?: string;
    projectName?: string;
    checkout?: {
      cwd?: string;
      currentBranch?: string;
      isPaseoOwnedWorktree?: boolean;
      mainRepoRoot?: string | null;
    };
  };
  activeTurnId?: string;
  turnsCount?: number;
  lastUsage?: {
    inputTokens?: number;
    cachedInputTokens?: number;
    outputTokens?: number;
    totalCostUsd?: number;
    contextWindowMaxTokens?: number;
    contextWindowUsedTokens?: number;
    [key: string]: any;
  };
  tokenUsage?: {
    inputTokens?: number;
    outputTokens?: number;
    reasoningTokens?: number;
    totalCost?: number;
    contextWindow?: number;
    cachedTokens?: number;
    cachedInputTokens?: number;
    cacheReadTokens?: number;
    cacheWriteTokens?: number;
    cacheHitRate?: number;
    contextWindowUsedTokens?: number;
    totalCostUsd?: number;
    contextWindowMaxTokens?: number;
    [key: string]: any;
  };
  labels?: Record<string, string>;
}

export interface AgentSlashCommand {
  name: string;
  description: string;
  argumentHint?: string;
  kind?: "command" | "skill";
}

export type ActiveTurnBehavior = "interrupt" | "steer" | "followup";

export interface QueuedFollowup {
  id: string;
  agentId: string;
  text: string;
  attachments?: string[];
  images?: ImageAttachment[];
  timestamp: string;
}

// Timeline items
export interface UserMessageTimelineItem {
  type: "user_message";
  text: string;
  messageId?: string;
  clientMessageId?: string;
  timestamp?: string;
  attachments?: string[];
  images?: ImageAttachment[];
  activeTurnBehavior?: ActiveTurnBehavior;
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
  turnId?: string;
}

export interface ToolCallTimelineItem {
  type: "tool_call";
  tool?: string;
  name?: string;
  callId: string;
  input?: Record<string, unknown> | string | unknown;
  output?: Record<string, unknown> | string | unknown;
  detail?: any;
  metadata?: Record<string, unknown>;
  status: "running" | "completed" | "failed" | "canceled";
  error?: unknown;
  title?: string;
  elapsedMs?: number;
  diff?: string;
  filePath?: string;
  additions?: number;
  deletions?: number;
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

export interface CompactionTimelineItem {
  type: "compaction";
  status: "loading" | "completed";
  trigger?: "auto" | "manual";
  preTokens?: number;
}

export interface PendingPermission {
  key: string;
  agentId: string;
  request: AgentPermissionRequest;
}

export type TimelineItem =
  | UserMessageTimelineItem
  | AssistantMessageTimelineItem
  | ReasoningTimelineItem
  | ToolCallTimelineItem
  | TodoTimelineItem
  | ErrorTimelineItem
  | PermissionRequestTimelineItem
  | CompactionTimelineItem;

export interface TerminalSessionInfo {
  id: string;
  slot: number;
  title?: string;
  rows: number;
  cols: number;
  cwd?: string;
  workspaceId?: string;
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

// Project registration and source options
export interface ProjectAddResult {
  requestId: string;
  project: {
    projectId: string;
    projectKey?: string;
    projectDisplayName: string;
    projectRootPath: string;
    projectKind: string;
  } | null;
  error: string | null;
  errorCode?: string | null;
}

export interface ProjectCreateDirectoryResult {
  requestId: string;
  directoryPath: string | null;
  project: {
    projectId: string;
    projectKey?: string;
    projectDisplayName: string;
    projectRootPath: string;
    projectKind: string;
  } | null;
  error: string | null;
  errorCode: string | null;
}

export interface GithubRepository {
  id: string;
  name: string;
  nameWithOwner: string;
  description: string | null;
  visibility: "public" | "private" | "internal";
  updatedAt: string;
  cloneUrl: string;
}

export type GithubSearchRepositoriesResult =
  | {
      status: "success";
      requestId: string;
      repositories: GithubRepository[];
      available: true;
      error: null;
    }
  | {
      status: "unavailable";
      requestId: string;
      repositories: GithubRepository[];
      reason: string;
      available: false;
      error: string;
    }
  | {
      status: "unauthenticated";
      requestId: string;
      repositories: GithubRepository[];
      available: false;
      error: string;
    }
  | {
      status: "error";
      requestId: string;
      repositories: GithubRepository[];
      available: boolean;
      error: string;
    };

export interface ProjectGithubCloneResult {
  requestId: string;
  repo: string;
  checkoutPath: string | null;
  project: {
    projectId: string;
    projectKey?: string;
    projectDisplayName: string;
    projectRootPath: string;
    projectKind: string;
  } | null;
  error: string | null;
}

export interface DirectorySuggestionEntry {
  path: string;
  kind: "file" | "directory";
}

export interface DirectorySuggestionsResult {
  directories: string[];
  entries?: DirectorySuggestionEntry[];
  error: string | null;
  requestId: string;
}

// Workspace Script & Service Types
export type WorkspaceScriptLifecycle = "running" | "stopped";
export type WorkspaceScriptHealth = "healthy" | "unhealthy" | null;

export interface WorkspaceScriptItem {
  scriptName: string;
  type: "script" | "service";
  hostname: string;
  port: number | null;
  localProxyUrl?: string | null;
  publicProxyUrl?: string | null;
  proxyUrl?: string | null;
  lifecycle: WorkspaceScriptLifecycle;
  health: WorkspaceScriptHealth;
  exitCode?: number | null;
  terminalId?: string | null;
}

export interface WorkspaceScriptOperationResult {
  requestId: string;
  workspaceId: string;
  scriptName?: string;
  script?: WorkspaceScriptItem | null;
  scripts?: WorkspaceScriptItem[];
  error: string | null;
}

export interface StartWorkspaceScriptResult {
  requestId: string;
  workspaceId: string;
  scriptName: string;
  terminalId: string | null;
  error: string | null;
}

export type WorkspaceScriptRouteKind = "public" | "paseo" | "direct";

export interface WorkspaceScriptRoute {
  kind: WorkspaceScriptRouteKind;
  name: string;
  url: string;
  displayUrl: string;
}
