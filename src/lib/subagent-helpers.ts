import { formatRelativePath, stripCwdFromText } from "./utils";
import type { ToolCallTimelineItem } from "./paseo/types";

export interface SubagentChildAction {
  id?: string;
  tool: string;
  name?: string;
  title?: string;
  status?: "running" | "completed" | "failed" | "canceled";
  input?: any;
  output?: any;
  filePath?: string;
  query?: string;
  command?: string;
  summary?: string;
  exitCode?: number | null;
}

export interface SubagentInfo {
  id: string;
  parentAgentId: string;
  toolCallId?: string;
  status: "running" | "completed" | "failed" | "canceled";
  title?: string;
  description?: string;
  subtitle?: string;
  subAgentType?: string;
  actions: SubagentChildAction[];
  output?: string;
}

export type ToolCategory =
  | "search"
  | "read"
  | "edit"
  | "terminal"
  | "web"
  | "subagent"
  | "default";

export function isSubagentToolCall(item: ToolCallTimelineItem): boolean {
  const toolName = (item.name || item.tool || "").toLowerCase();
  const detailType = (item.detail as any)?.type;
  if (detailType === "sub_agent") return true;
  if (toolName === "task") return true;
  if (toolName.includes("subagent") || toolName.includes("sub_agent")) return true;
  if (Boolean((item.input as any)?.subagent_type)) return true;
  return false;
}

export function getSubagentDetails(item: ToolCallTimelineItem): {
  description: string;
  subAgentType?: string;
} {
  const detail = (item.detail || {}) as Record<string, any>;
  const input = (item.input || {}) as Record<string, any>;
  const meta = (item.metadata || {}) as Record<string, any>;

  const description =
    detail.description ||
    input.description ||
    input.prompt ||
    meta.description ||
    item.title ||
    "";

  const subAgentType =
    detail.subAgentType ||
    input.subagent_type ||
    input.subAgentType ||
    meta.subAgentType;

  return { description, subAgentType };
}

export function getToolDisplayInfo(toolName: string): {
  displayName: string;
  category: ToolCategory;
} {
  const t = (toolName || "").toLowerCase().trim();

  if (
    t === "grep" ||
    t === "glob" ||
    t === "search" ||
    t.includes("search") ||
    t.includes("grep") ||
    t.includes("glob") ||
    t.includes("find")
  ) {
    return { displayName: "Search Files", category: "search" };
  }

  if (
    t === "read" ||
    t === "read_file" ||
    t === "readfile" ||
    t.includes("read")
  ) {
    return { displayName: "Read File", category: "read" };
  }

  if (
    t === "edit" ||
    t === "write" ||
    t === "multiedit" ||
    t === "apply_patch" ||
    t.includes("edit") ||
    t.includes("patch") ||
    t.includes("write")
  ) {
    return { displayName: "Edit File", category: "edit" };
  }

  if (
    t === "bash" ||
    t === "shell" ||
    t === "terminal" ||
    t === "exec" ||
    t.includes("bash") ||
    t.includes("terminal") ||
    t.includes("shell")
  ) {
    return { displayName: "Run Command", category: "terminal" };
  }

  if (
    t === "web_search" ||
    t === "web_fetch" ||
    t === "fetch" ||
    t.includes("fetch") ||
    t.includes("web")
  ) {
    return { displayName: "Web Fetch", category: "web" };
  }

  if (t === "task" || t.includes("subagent") || t.includes("sub_agent")) {
    return { displayName: "Agent Task", category: "subagent" };
  }

  // Fallback: title case cleaned name
  const formatted = t
    .split(/[_\-\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

  return { displayName: formatted || "Tool", category: "default" };
}

export function getFileExtension(filePath?: string): string | null {
  if (!filePath) return null;
  const cleanPath = (filePath.split("?")[0] || "").split("#")[0]?.trim() || "";
  const parts = cleanPath.split(/[/\\]/);
  const fileName = parts[parts.length - 1];
  if (!fileName || !fileName.includes(".")) return null;
  const ext = fileName.split(".").pop()?.toUpperCase();
  if (!ext || ext.length > 6 || ext.includes(" ")) return null;
  return ext;
}

export function getActionTargetText(action: SubagentChildAction, cwd?: string): string {
  if (action.filePath) {
    return formatRelativePath(action.filePath, cwd);
  }
  if (action.query) {
    return action.query;
  }
  if (action.command) {
    return stripCwdFromText(action.command, cwd);
  }
  if (action.summary) {
    return stripCwdFromText(action.summary, cwd);
  }
  if (action.title && action.title !== action.tool) {
    return stripCwdFromText(action.title, cwd);
  }
  if (typeof action.input === "string") {
    return stripCwdFromText(action.input, cwd);
  }
  if (typeof action.input === "object" && action.input !== null) {
    const inp = action.input as Record<string, any>;
    if (inp.filePath) return formatRelativePath(inp.filePath, cwd);
    if (inp.path) return formatRelativePath(inp.path, cwd);
    if (inp.file_path) return formatRelativePath(inp.file_path, cwd);
    if (inp.pattern) return inp.pattern;
    if (inp.query) return inp.query;
    if (inp.command) return stripCwdFromText(inp.command, cwd);
    if (inp.cmd) return stripCwdFromText(inp.cmd, cwd);
    if (inp.url) return inp.url;
    if (inp.description) return inp.description;
    if (inp.prompt) return inp.prompt;
  }
  return "";
}

export function normalizeSubagentAction(raw: any): SubagentChildAction | null {
  if (!raw || typeof raw !== "object") return null;

  const tool =
    raw.tool ||
    raw.name ||
    raw.toolName ||
    raw.action ||
    raw.type ||
    "tool";

  const state = raw.state || {};
  const status =
    state.status ||
    raw.status ||
    (raw.completed ? "completed" : undefined) ||
    "completed";

  const input = state.input !== undefined ? state.input : raw.input;
  const output = state.output !== undefined ? state.output : raw.output;
  const detail = raw.detail || {};

  const filePath =
    raw.filePath ||
    state.filePath ||
    detail.filePath ||
    input?.filePath ||
    input?.path ||
    input?.file_path;

  const query =
    raw.query ||
    raw.pattern ||
    detail.query ||
    detail.pattern ||
    input?.query ||
    input?.pattern;

  const command =
    raw.command ||
    detail.command ||
    input?.command ||
    input?.cmd;

  const summary =
    raw.summary ||
    state.title ||
    raw.title ||
    detail.summary;

  return {
    id: raw.id || (raw.index !== undefined ? String(raw.index) : undefined),
    tool,
    status: status as any,
    title: raw.title || state.title,
    summary,
    input,
    output,
    filePath,
    query,
    command,
    exitCode: detail.exitCode,
  };
}

export function parseTaskMetadataBlock(output?: string): {
  sessionId?: string;
  summaryEntries: SubagentChildAction[];
} {
  if (typeof output !== "string" || output.trim().length === 0) {
    return { summaryEntries: [] };
  }

  const blockMatch = output.match(/<task_metadata>\s*([\s\S]*?)\s*<\/task_metadata>/i);
  if (!blockMatch?.[1]) return { summaryEntries: [] };

  try {
    const parsed = JSON.parse(blockMatch[1].trim()) as Record<string, any>;
    const rawList = parsed.summary || parsed.entries || parsed.tools || parsed.calls || [];
    const entries: SubagentChildAction[] = [];

    if (Array.isArray(rawList)) {
      for (const item of rawList) {
        const norm = normalizeSubagentAction(item);
        if (norm) entries.push(norm);
      }
    }

    const sessionId = parsed.sessionId || parsed.sessionID;
    return {
      sessionId: typeof sessionId === "string" ? sessionId : undefined,
      summaryEntries: entries,
    };
  } catch {
    return { summaryEntries: [] };
  }
}

export function parseActionLinesFromLog(logText?: string): SubagentChildAction[] {
  if (!logText || typeof logText !== "string") return [];
  const lines = logText.split("\n");
  const actions: SubagentChildAction[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const match = line.match(/^[-*•]?\s*([A-Za-z\s_]+)[:\s-]+(.+)$/);
    if (match && match[1] && match[2]) {
      const candidateTool = match[1].trim().toLowerCase();
      const target = match[2].trim();

      if (
        candidateTool.includes("search") ||
        candidateTool.includes("grep") ||
        candidateTool.includes("glob")
      ) {
        actions.push({ tool: "grep", query: target, status: "completed" });
      } else if (candidateTool.includes("read")) {
        actions.push({ tool: "read", filePath: target, status: "completed" });
      } else if (
        candidateTool.includes("edit") ||
        candidateTool.includes("write") ||
        candidateTool.includes("patch")
      ) {
        actions.push({ tool: "edit", filePath: target, status: "completed" });
      } else if (
        candidateTool.includes("bash") ||
        candidateTool.includes("command") ||
        candidateTool.includes("run")
      ) {
        actions.push({ tool: "bash", command: target, status: "completed" });
      }
    }
  }

  return actions;
}

export function extractEmbeddedActions(item: ToolCallTimelineItem): SubagentChildAction[] {
  const actions: SubagentChildAction[] = [];

  const detailActions = (item.detail as any)?.actions;
  if (Array.isArray(detailActions) && detailActions.length > 0) {
    for (const act of detailActions) {
      const norm = normalizeSubagentAction(act);
      if (norm) actions.push(norm);
    }
    return actions;
  }

  const meta = (item.metadata || {}) as Record<string, any>;
  const candidateList = meta.summary || meta.entries || meta.tools || meta.calls;
  if (Array.isArray(candidateList) && candidateList.length > 0) {
    for (const act of candidateList) {
      const norm = normalizeSubagentAction(act);
      if (norm) actions.push(norm);
    }
    return actions;
  }

  const outputStr = typeof item.output === "string" ? item.output : undefined;
  const parsedMeta = parseTaskMetadataBlock(outputStr);
  if (parsedMeta.summaryEntries.length > 0) {
    return parsedMeta.summaryEntries;
  }

  const logStr = (item.detail as any)?.log;
  if (typeof logStr === "string" && logStr.length > 0) {
    const fromLog = parseActionLinesFromLog(logStr);
    if (fromLog.length > 0) return fromLog;
  }

  if (outputStr && outputStr.length > 0) {
    const fromLog = parseActionLinesFromLog(outputStr);
    if (fromLog.length > 0) return fromLog;
  }

  return actions;
}

export function cleanSubagentOutput(rawOutput?: unknown): string {
  if (rawOutput === undefined || rawOutput === null) return "";

  let text = "";
  if (typeof rawOutput === "object") {
    const obj = rawOutput as Record<string, any>;
    if (typeof obj.result === "string") text = obj.result;
    else if (typeof obj.output === "string") text = obj.output;
    else if (typeof obj.content === "string") text = obj.content;
    else if (typeof obj.text === "string") text = obj.text;
    else if (typeof obj.summary === "string") text = obj.summary;
    else {
      try {
        text = JSON.stringify(rawOutput, null, 2);
      } catch {
        text = String(rawOutput);
      }
    }
  } else {
    text = String(rawOutput).trim();
  }

  // 1. If text looks like JSON, try parsing it
  if (
    (text.startsWith("{") && text.endsWith("}")) ||
    (text.startsWith("[") && text.endsWith("]"))
  ) {
    try {
      const parsed = JSON.parse(text);
      if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
        if (typeof parsed.result === "string") text = parsed.result;
        else if (typeof parsed.output === "string") text = parsed.output;
        else if (typeof parsed.content === "string") text = parsed.content;
        else if (typeof parsed.text === "string") text = parsed.text;
        else if (typeof parsed.summary === "string") text = parsed.summary;
      }
    } catch {
      // not valid JSON, proceed
    }
  }

  // 2. Extract <task_result>...</task_result> if present
  const taskResultMatch = text.match(/<task_result>\s*([\s\S]*?)\s*<\/task_result>/i);
  if (taskResultMatch && taskResultMatch[1] !== undefined) {
    text = taskResultMatch[1];
  } else {
    // 3. Extract <result>...</result> if present
    const resultMatch = text.match(/<result>\s*([\s\S]*?)\s*<\/result>/i);
    if (resultMatch && resultMatch[1] !== undefined) {
      text = resultMatch[1];
    }
  }

  // 4. Strip <task_metadata>...</task_metadata> blocks
  text = text.replace(/<task_metadata>[\s\S]*?<\/task_metadata>/gi, "");

  // 5. Strip any outer <task ...> and </task> tags
  text = text.replace(/<task\b[^>]*>/gi, "").replace(/<\/task>/gi, "");

  // 6. Strip stray <task_result> or <result> tags if any remain
  text = text.replace(/<\/?task_result>/gi, "").replace(/<\/?result>/gi, "");

  return text.trim();
}

export function resolveAndDeduplicateActions(
  rawActions: SubagentChildAction[],
  cwd?: string,
  isCompleted?: boolean,
): SubagentChildAction[] {
  if (!rawActions || rawActions.length === 0) return [];

  const deduped: SubagentChildAction[] = [];
  for (const act of rawActions) {
    const target = getActionTargetText(act, cwd).trim();
    const tool = (act.tool || "").toLowerCase().trim();

    // 1. If an action with the exact same ID already exists, merge/update it
    if (act.id) {
      const existingIdx = deduped.findIndex((d) => d.id === act.id);
      if (existingIdx >= 0) {
        deduped[existingIdx] = {
          ...deduped[existingIdx],
          ...act,
          query: act.query || deduped[existingIdx]?.query,
          filePath: act.filePath || deduped[existingIdx]?.filePath,
          command: act.command || deduped[existingIdx]?.command,
          summary: act.summary || deduped[existingIdx]?.summary,
          status: isCompleted ? "completed" : (act.status || deduped[existingIdx]?.status),
        };
        continue;
      }
    }

    // 2. If consecutive actions are the same tool:
    if (deduped.length > 0) {
      const lastIdx = deduped.length - 1;
      const last = deduped[lastIdx]!;
      const lastTarget = getActionTargetText(last, cwd).trim();
      const lastTool = (last.tool || "").toLowerCase().trim();

      if (lastTool === tool) {
        // Case A: Previous had no target, current has target -> update previous
        if (!lastTarget && target) {
          deduped[lastIdx] = {
            ...last,
            ...act,
            status: isCompleted ? "completed" : act.status,
          };
          continue;
        }
        // Case B: Same target -> update status
        if (lastTarget === target) {
          deduped[lastIdx] = {
            ...last,
            ...act,
            status: isCompleted
              ? "completed"
              : (act.status === "completed" ? "completed" : last.status),
          };
          continue;
        }
      }
    }

    deduped.push({
      ...act,
      status: isCompleted ? "completed" : act.status,
    });
  }

  // 3. Drop empty actions if there are actions with real targets for that tool
  const cleaned: SubagentChildAction[] = [];
  for (const a of deduped) {
    const t = getActionTargetText(a, cwd).trim();
    if (!t) {
      const hasTargetCounterpart = deduped.some(
        (other) =>
          (other.tool || "").toLowerCase() === (a.tool || "").toLowerCase() &&
          getActionTargetText(other, cwd).trim().length > 0,
      );
      if (hasTargetCounterpart) continue;
    }
    cleaned.push(a);
  }

  return cleaned;
}
