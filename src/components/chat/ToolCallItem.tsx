import React, { useState } from "react";
import {
  Terminal,
  FileCode,
  Search,
  Globe,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ChevronDown,
  ChevronRight,
  FileText,
  Code2,
  Copy,
  Check,
  Sparkles,
  Layers,
} from "lucide-react";
import { DiffViewer } from "./DiffViewer";
import { SubagentCallItem } from "./SubagentCallItem";
import { useWorkspace } from "../../context/WorkspaceContext";
import { formatRelativePath, stripCwdFromText } from "../../lib/utils";
import { isSubagentToolCall } from "../../lib/subagent-helpers";
import { PressButton } from "../ui/button";
import type { ToolCallTimelineItem } from "../../lib/paseo/types";
import {
  extractFilePathFromDiff,
  isDiffText,
  resolveDiffStats,
  type DiffStats,
} from "./diff-utils";

function formatContent(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function CopyButton({ text, title = "Copy" }: { text: string; title?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <PressButton
      type="button"
      onPress={handleCopy}
      className="p-1 rounded-sm text-muted-foreground hover:text-foreground hover:bg-accent/80 cursor-pointer transition-colors"
      title={title}
    >
      {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
    </PressButton>
  );
}

interface ResolvedInput {
  type: string;
  content: unknown;
  filePath?: string;
  diffText?: string;
  oldString?: string;
  newString?: string;
  diffStats?: DiffStats;
}

const getNumericField = (source: unknown, keys: string[]): number | undefined => {
  if (!source || typeof source !== "object") return undefined;
  for (const key of keys) {
    const value = (source as Record<string, unknown>)[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return undefined;
};

function getExplicitDiffStats(
  item: ToolCallTimelineItem,
  detail: Record<string, any>,
  meta: Record<string, any>,
  input: unknown,
  output: unknown,
): Partial<DiffStats> {
  const sources = [
    detail,
    meta,
    meta.filediff,
    meta.fileDiff,
    meta.diffStats,
    detail.stats,
    detail.diffStats,
    meta.stats,
    input,
    output,
    item,
  ];
  const additionKeys = ["additions", "insertions", "added", "linesAdded"];
  const deletionKeys = ["deletions", "removed", "linesRemoved"];

  return {
    additions: sources.reduce<number | undefined>(
      (value, source) => value ?? getNumericField(source, additionKeys),
      undefined,
    ),
    deletions: sources.reduce<number | undefined>(
      (value, source) => value ?? getNumericField(source, deletionKeys),
      undefined,
    ),
  };
}

function resolveToolInput(
  item: ToolCallTimelineItem,
  cwd?: string,
  outputContent?: string,
): ResolvedInput {
  const detail = (item.detail || {}) as Record<string, any>;
  const meta = (item.metadata || {}) as Record<string, any>;
  const rawName = (item.name || item.tool || "").toLowerCase();
  const input = item.input as any;

  // 1. Shell / Bash
  if (detail.type === "shell" || rawName === "bash" || rawName === "shell") {
    const rawCmd =
      detail.command ||
      (item.input as any)?.command ||
      (typeof item.input === "string" ? item.input : undefined) ||
      meta.command;
    const cmd = stripCwdFromText(rawCmd, cwd);
    return { type: "shell", content: cmd };
  }

  // 2. Read
  if (detail.type === "read" || rawName === "read") {
    const rawFp =
      detail.filePath ||
      input?.filePath ||
      input?.file_path ||
      item.filePath ||
      meta.display?.path;
    const fp = formatRelativePath(rawFp, cwd);
    let content = fp;
    if (detail.offset !== undefined) {
      content = `${fp} (lines ${detail.offset}-${detail.offset + (detail.limit || 0)})`;
    }
    return { type: "read", content, filePath: fp };
  }

  // 3. Edit / Apply Patch
  if (
    detail.type === "edit" ||
    rawName.includes("edit") ||
    rawName.includes("patch") ||
    rawName.includes("diff")
  ) {
    const rawFp =
      detail.filePath ||
      input?.filePath ||
      input?.file_path ||
      item.filePath ||
      meta.filePath ||
      meta.filediff?.file;
    const diffText =
      detail.unifiedDiff ??
      detail.patch ??
      detail.patchText ??
      meta.diff ??
      meta.filediff?.patch ??
      meta.patchText ??
      item.diff ??
      input?.unifiedDiff ??
      input?.diff ??
      input?.patch ??
      input?.patchText ??
      (typeof item.input === "string" ? item.input : undefined);
    const fp = formatRelativePath(rawFp || extractFilePathFromDiff(diffText), cwd);
    const oldString = detail.oldString ?? detail.old_string ?? input?.oldString ?? input?.old_string;
    const newString = detail.newString ?? detail.new_string ?? input?.newString ?? input?.new_string;
    const explicitStats = getExplicitDiffStats(item, detail, meta, input, item.output);
    return {
      type: "edit",
      content: fp,
      filePath: fp,
      diffText,
      oldString,
      newString,
      diffStats: resolveDiffStats({
        diffText,
        oldString,
        newString,
        ...explicitStats,
      }),
    };
  }

  // 4. Write
  if (detail.type === "write" || rawName.includes("write")) {
    const rawFp = detail.filePath || input?.filePath || input?.file_path || input?.path || item.filePath;
    const fp = formatRelativePath(rawFp, cwd);
    const writeContent = detail.content ?? input?.content;
    const explicitStats = getExplicitDiffStats(item, detail, meta, input, item.output);
    return {
      type: "write",
      content: fp ? (writeContent !== undefined ? `${fp}\n\n${writeContent}` : fp) : writeContent,
      filePath: fp,
      diffStats: resolveDiffStats({
        newString: typeof writeContent === "string" ? writeContent : undefined,
        ...explicitStats,
      }),
    };
  }

  // 5. Search / Grep / Glob
  if (
    detail.type === "search" ||
    rawName === "grep" ||
    rawName === "glob" ||
    rawName === "search"
  ) {
    const rawPath =
      detail.path ||
      (item.input as any)?.path ||
      (item.input as any)?.directory ||
      (item.input as any)?.dir ||
      (item.input as any)?.cwd ||
      (item.input as any)?.pathPrefix;
    const include =
      detail.include ||
      (item.input as any)?.include ||
      (item.input as any)?.glob ||
      (item.input as any)?.filePattern;
    const query =
      detail.query ||
      detail.pattern ||
      (item.input as any)?.query ||
      (item.input as any)?.pattern ||
      (typeof item.input === "string" ? item.input : undefined) ||
      meta.query;

    let path = rawPath ? formatRelativePath(rawPath, cwd) : undefined;
    if (!path && typeof outputContent === "string") {
      const match = outputContent.match(/(?:^|\n)([\w./-]+\.\w+):(?:\s*\n|\s*\d+:)/);
      if (match && match[1]) {
        path = formatRelativePath(match[1], cwd);
      }
    }

    let content: unknown;
    if (path || include) {
      const parts: string[] = [];
      if (query) parts.push(`pattern: ${query}`);
      if (path) parts.push(`path: ${path}`);
      if (include) parts.push(`include: ${include}`);
      if (typeof item.input === "object" && item.input !== null) {
        for (const [k, v] of Object.entries(item.input)) {
          if (
            ![
              "pattern",
              "query",
              "q",
              "path",
              "directory",
              "dir",
              "cwd",
              "pathPrefix",
              "include",
              "glob",
              "filePattern",
            ].includes(k)
          ) {
            parts.push(`${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`);
          }
        }
      }
      content = parts.join("\n");
    } else if (typeof item.input === "object" && item.input !== null) {
      content = item.input;
    } else {
      content = query || item.input;
    }

    return {
      type: "search",
      content,
      filePath: path,
    };
  }

  // 6. Sub Agent / Task
  if (detail.type === "sub_agent" || rawName === "task") {
    const desc =
      detail.description ||
      (item.input as any)?.description ||
      (item.input as any)?.prompt ||
      meta.description;
    const subType = detail.subAgentType || (item.input as any)?.subagent_type;
    const content = subType ? `[${subType}] ${desc || ""}` : desc;
    return { type: "sub_agent", content };
  }

  // 7. Plain Text / Skill
  if (detail.type === "plain_text" || rawName === "skill") {
    const label =
      detail.label ||
      (item.input as any)?.name ||
      (item.input as any)?.skill ||
      meta.label ||
      item.input;
    return { type: "plain_text", content: label };
  }

  // 8. Fetch
  if (detail.type === "fetch" || rawName === "fetch" || rawName === "web_fetch") {
    const url = detail.url || (item.input as any)?.url || item.input;
    return { type: "fetch", content: url };
  }

  // Generic fallback
  const genericInput =
    detail.input !== undefined
      ? detail.input
      : (item.input ??
        (item as any).args ??
        (item as any).arguments ??
        (item as any).parameters ??
        (item as any).params);
  return { type: detail.type || "unknown", content: genericInput };
}

interface ResolvedOutput {
  content: string | undefined;
  exitCode?: number | null;
  isDiff?: boolean;
  diffText?: string;
  diffStats?: DiffStats;
}

function resolveToolOutput(item: ToolCallTimelineItem, cwd?: string): ResolvedOutput {
  const detail = (item.detail || {}) as Record<string, any>;
  const meta = (item.metadata || {}) as Record<string, any>;
  const rawName = (item.name || item.tool || "").toLowerCase();

  // 1. Shell / Bash
  if (detail.type === "shell" || rawName === "bash" || rawName === "shell") {
    const rawOutput =
      detail.output !== undefined
        ? detail.output
        : (meta.output !== undefined ? meta.output : item.output);
    const output = typeof rawOutput === "string" ? stripCwdFromText(rawOutput, cwd) : rawOutput;
    return { content: output, exitCode: detail.exitCode };
  }

  // 2. Read
  if (detail.type === "read" || rawName === "read") {
    const content =
      detail.content !== undefined
        ? detail.content
        : (meta.display?.text || meta.preview || item.output);
    return { content };
  }

  // 3. Edit / Apply Patch
  if (
    detail.type === "edit" ||
    rawName.includes("edit") ||
    rawName.includes("patch") ||
    rawName.includes("diff")
  ) {
    const explicitDiff =
      detail.unifiedDiff ??
      detail.patch ??
      meta.diff ??
      meta.filediff?.patch ??
      item.diff;
    const outputDiff = isDiffText(item.output) ? item.output : undefined;
    const diff = explicitDiff ?? outputDiff ?? item.output;
    const diffText =
      typeof diff === "string" && (explicitDiff !== undefined || isDiffText(diff))
        ? stripCwdFromText(diff, cwd)
        : undefined;
    return {
      content: typeof diff === "string" ? stripCwdFromText(diff, cwd) : diff,
      isDiff: diffText !== undefined,
      diffText,
      diffStats: diffText !== undefined ? resolveDiffStats({ diffText }) : undefined,
    };
  }

  // 4. Write
  if (detail.type === "write" || rawName.includes("write")) {
    const content =
      detail.content ||
      meta.content ||
      item.output ||
      "File written successfully.";
    return { content };
  }

  // 5. Search / Grep / Glob
  if (
    detail.type === "search" ||
    rawName === "grep" ||
    rawName === "glob" ||
    rawName === "search"
  ) {
    let out = detail.content;
    if (!out && Array.isArray(detail.filePaths)) {
      out = detail.filePaths
        .map((p: string) => formatRelativePath(p, cwd))
        .join("\n");
    }
    if (!out && meta.count !== undefined) {
      out = `${meta.count} matches found`;
    }
    if (!out) {
      out = item.output;
    }
    const finalOut = typeof out === "string" ? stripCwdFromText(out, cwd) : out;
    return { content: finalOut };
  }

  // 6. Sub Agent / Task
  if (detail.type === "sub_agent" || rawName === "task") {
    const log = detail.log || item.output;
    return { content: typeof log === "string" ? stripCwdFromText(log, cwd) : log };
  }

  // 7. Plain Text / Skill
  if (detail.type === "plain_text" || rawName === "skill") {
    return { content: detail.text || meta.text || meta.output || item.output };
  }

  // 8. Fetch
  if (detail.type === "fetch" || rawName === "fetch" || rawName === "web_fetch") {
    return { content: detail.result || item.output };
  }

  // Generic fallback
  const out =
    detail.output !== undefined
      ? detail.output
      : (item.output ??
        (item as any).result ??
        meta.output ??
        meta.result);
  return {
    content:
      typeof out === "string"
        ? stripCwdFromText(out, cwd)
        : out !== undefined
        ? JSON.stringify(out, null, 2)
        : undefined,
  };
}

export function ToolCallItem({ item }: { item: ToolCallTimelineItem }) {
  if (isSubagentToolCall(item)) {
    return <SubagentCallItem item={item} />;
  }

  const [isExpanded, setIsExpanded] = useState(false);
  const { activeWorkspace, activeAgent } = useWorkspace();
  const cwd =
    activeAgent?.cwd ||
    activeAgent?.project?.checkout?.cwd ||
    activeWorkspace?.path;

  const toolName = item.name || item.tool || "tool";
  const outputInfo = resolveToolOutput(item, cwd);
  const inputInfo = resolveToolInput(item, cwd, outputInfo.content);

  const formattedInput = formatContent(inputInfo.content);
  const formattedOutput = outputInfo.content ? formatContent(outputInfo.content) : undefined;

  const isDiffTool =
    inputInfo.type === "edit" ||
    toolName.toLowerCase().includes("edit") ||
    toolName.toLowerCase().includes("patch") ||
    toolName.toLowerCase().includes("diff") ||
    inputInfo.diffText !== undefined ||
    inputInfo.oldString !== undefined ||
    inputInfo.newString !== undefined;

  const isFileModification =
    isDiffTool || inputInfo.type === "write" || toolName.toLowerCase().includes("write");

  const hasDiff =
    inputInfo.diffText !== undefined ||
    outputInfo.diffText !== undefined ||
    inputInfo.oldString !== undefined ||
    inputInfo.newString !== undefined;
  const showDiff = isDiffTool && hasDiff;
  const diffStats = inputInfo.diffStats || outputInfo.diffStats;

  const showInput =
    Boolean(formattedInput) &&
    (!isDiffTool || (!inputInfo.diffText && !inputInfo.oldString && !inputInfo.newString));

  const getToolIcon = () => {
    const t = toolName.toLowerCase();
    if (t.includes("bash") || t.includes("terminal") || t.includes("shell") || t.includes("exec")) {
      return <Terminal className="w-3.5 h-3.5 text-amber-500" />;
    }
    if (t.includes("edit") || t.includes("patch") || t.includes("write")) {
      return <FileCode className="w-3.5 h-3.5 text-blue-500" />;
    }
    if (t.includes("read") || t.includes("file")) {
      return <FileText className="w-3.5 h-3.5 text-emerald-500" />;
    }
    if (t.includes("grep") || t.includes("glob") || t.includes("search")) {
      return <Search className="w-3.5 h-3.5 text-purple-500" />;
    }
    if (t.includes("web") || t.includes("fetch")) {
      return <Globe className="w-3.5 h-3.5 text-cyan-500" />;
    }
    if (t.includes("task") || t.includes("sub_agent")) {
      return <Layers className="w-3.5 h-3.5 text-primary" />;
    }
    if (t.includes("skill")) {
      return <Sparkles className="w-3.5 h-3.5 text-amber-500" />;
    }
    return <Code2 className="w-3.5 h-3.5 text-primary" />;
  };

  const getStatusIcon = () => {
    switch (item.status) {
      case "running":
        return <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-500" />;
      case "completed":
        return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />;
      case "failed":
        return <AlertCircle className="w-3.5 h-3.5 text-destructive" />;
      case "canceled":
        return <span className="text-[10px] text-muted-foreground uppercase font-mono">Canceled</span>;
      default:
        return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />;
    }
  };

  // Extract a readable summary for the closed card header
  const getToolSummary = (): string | undefined => {
    if (item.title && item.title !== toolName) {
      return formatRelativePath(item.title, cwd);
    }

    if (inputInfo.type === "search") {
      const query =
        (item.detail as any)?.query ||
        (item.detail as any)?.pattern ||
        (item.input as any)?.query ||
        (item.input as any)?.pattern;
      const path = inputInfo.filePath;
      if (query && path) {
        return `${query} in ${path}`;
      }
      if (path) {
        return `in ${path}`;
      }
      if (query) {
        return query;
      }
    }

    const input = inputInfo.content;
    if (typeof input === "string") {
      const firstLine = input.split("\n")[0]?.trim();
      if (firstLine && firstLine !== toolName) {
        return formatRelativePath(firstLine, cwd);
      }
    }
    if (typeof input === "object" && input !== null) {
      const obj = input as Record<string, any>;
      if (obj.command && obj.command !== toolName) return stripCwdFromText(obj.command, cwd);
      if (obj.filePath && obj.filePath !== toolName) return formatRelativePath(obj.filePath, cwd);
      if (obj.pattern) return `pattern: "${obj.pattern}"`;
      if (obj.query) return `query: "${obj.query}"`;
      if (obj.description && obj.description !== toolName) return obj.description;
      if (obj.name && obj.name !== toolName) return obj.name;
    }

    if (inputInfo.filePath && inputInfo.filePath !== toolName) {
      return formatRelativePath(inputInfo.filePath, cwd);
    }

    return undefined;
  };

  const summaryText = getToolSummary();

  return (
    <div className="my-2 rounded-lg border border-border bg-card/70 text-xs overflow-hidden">
      {/* Tool Header Row */}
      <PressButton
        type="button"
        onPress={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-3 sm:px-3 py-2.5 sm:py-2 min-h-[44px] sm:min-h-[38px] text-left hover:bg-accent/50 cursor-pointer select-none transition-colors touch-manipulation"
      >
        <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
          {getToolIcon()}
          <span className="font-semibold text-foreground font-mono shrink-0">{toolName}</span>
          {summaryText ? (
            <span className="text-muted-foreground truncate font-mono text-[11px] min-w-0 flex-1">
              {summaryText}
            </span>
          ) : null}
        </div>

        <div className="flex items-center gap-2 shrink-0 ml-2">
          {isFileModification && diffStats && (diffStats.additions > 0 || diffStats.deletions > 0) ? (
            <div className="flex items-center gap-1.5 text-[11px] font-mono font-medium" title="File changes">
              {diffStats.additions > 0 ? (
                <span className="text-emerald-600 dark:text-emerald-400">+{diffStats.additions}</span>
              ) : null}
              {diffStats.deletions > 0 ? (
                <span className="text-rose-600 dark:text-rose-400">-{diffStats.deletions}</span>
              ) : null}
            </div>
          ) : null}
          {getStatusIcon()}
          {isExpanded ? (
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
          )}
        </div>
      </PressButton>

      {/* Expanded Details / Diff / Input / Output */}
      {isExpanded ? (
        <div className="p-3 border-t border-border bg-background/50 space-y-3 min-w-0 max-w-full overflow-hidden">
          {/* Diff Viewer for Edits / Patches */}
          {showDiff ? (
            <DiffViewer
              filePath={inputInfo.filePath}
              diffText={inputInfo.diffText || outputInfo.diffText}
              oldString={inputInfo.oldString}
              newString={inputInfo.newString}
              stats={diffStats}
            />
          ) : null}

          {/* Input Details */}
          {showInput ? (
            <div className="space-y-1.5 min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Input
                </span>
                <CopyButton text={formattedInput} title="Copy input" />
              </div>
              <pre className="p-2.5 rounded-lg bg-muted/40 font-mono text-[11px] text-foreground overflow-x-auto whitespace-pre-wrap select-text max-h-72 break-all min-w-0 max-w-full">
                {formattedInput}
              </pre>
            </div>
          ) : null}

          {/* Output / Result */}
          <div className="space-y-1.5 min-w-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Output
                </span>
                {outputInfo.exitCode !== undefined && outputInfo.exitCode !== null ? (
                  <span
                    className={`px-1.5 py-0.2 rounded-xs text-[10px] font-mono font-medium ${
                      outputInfo.exitCode === 0
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        : "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                    }`}
                  >
                    exit {outputInfo.exitCode}
                  </span>
                ) : null}
              </div>
              {formattedOutput ? <CopyButton text={formattedOutput} title="Copy output" /> : null}
            </div>

            {item.status === "running" ? (
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 font-mono text-[11px]">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Running...</span>
              </div>
            ) : formattedOutput ? (
              <pre className="p-2.5 rounded-lg bg-muted/40 font-mono text-[11px] text-foreground overflow-x-auto whitespace-pre-wrap select-text max-h-96 overflow-y-auto break-all min-w-0 max-w-full">
                {formattedOutput}
              </pre>
            ) : (
              <div className="p-2.5 rounded-lg bg-muted/20 text-muted-foreground font-mono text-[11px] italic">
                Completed with no output
              </div>
            )}
          </div>

          {/* Error */}
          {Boolean(item.error) ? (
            <div className="space-y-1.5 min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold text-destructive uppercase tracking-wider">
                  Error
                </span>
                <CopyButton text={formatContent(item.error)} title="Copy error" />
              </div>
              <pre className="p-2.5 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-[11px] font-mono overflow-x-auto whitespace-pre-wrap select-text break-all min-w-0 max-w-full">
                {formatContent(item.error)}
              </pre>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
