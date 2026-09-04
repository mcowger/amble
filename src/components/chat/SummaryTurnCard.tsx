import React, { useRef, useEffect, useMemo, useState } from "react";
import {
  Terminal,
  FileCode,
  FileText,
  Search,
  Brain,
  Loader2,
  Wrench,
  Code2,
  AlertCircle,
  Sparkles,
  ListTodo,
} from "lucide-react";
import type {
  ToolCallTimelineItem,
  ReasoningTimelineItem,
  AssistantMessageTimelineItem,
  TodoTimelineItem,
  TodoItem,
} from "../../lib/paseo/types";
import { formatDuration, formatRelativePath, stripCwdFromText } from "../../lib/utils";
import { extractFilePathFromDiff, resolveDiffStats } from "./diff-utils";
import { AssistantMessage } from "./AssistantMessage";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { TodoItemsList } from "./TodoBlock";
import { PressButton } from "../ui/button";

interface SummaryTurnCardProps {
  toolCalls: ToolCallTimelineItem[];
  reasonings: ReasoningTimelineItem[];
  todos?: TodoTimelineItem[];
  assistantMessage?: AssistantMessageTimelineItem;
  isCurrentRunningTurn?: boolean;
  activeAgentCwd?: string;
}

function getToolIcon(toolName: string) {
  const lower = toolName.toLowerCase();
  if (lower.includes("read") || lower.includes("glob") || lower.includes("cat")) {
    return <FileText className="w-3.5 h-3.5 text-emerald-500 shrink-0" />;
  }
  if (lower.includes("edit") || lower.includes("write") || lower.includes("patch")) {
    return <FileCode className="w-3.5 h-3.5 text-blue-500 shrink-0" />;
  }
  if (lower.includes("bash") || lower.includes("terminal") || lower.includes("exec") || lower.includes("sh")) {
    return <Terminal className="w-3.5 h-3.5 text-amber-500 shrink-0" />;
  }
  if (lower.includes("search") || lower.includes("grep") || lower.includes("find")) {
    return <Search className="w-3.5 h-3.5 text-purple-500 shrink-0" />;
  }
  return <Code2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />;
}

function getRecentToolData(call: ToolCallTimelineItem, cwd?: string): string | undefined {
  const toolName = call.name || call.tool || "tool";

  if (call.title && call.title !== toolName) {
    return formatRelativePath(call.title, cwd);
  }

  if (call.filePath) {
    return formatRelativePath(call.filePath, cwd);
  }

  if (typeof call.input === "string") {
    return stripCwdFromText(call.input.split(/\r?\n/)[0]?.trim(), cwd);
  }

  if (call.input && typeof call.input === "object") {
    const input = call.input as Record<string, unknown>;
    const command = input.command;
    if (typeof command === "string") return stripCwdFromText(command, cwd);

    for (const key of ["filePath", "file_path", "path", "query", "pattern", "description", "name"]) {
      const value = input[key];
      if (typeof value === "string" && value.trim()) {
        return key === "filePath" || key === "file_path" || key === "path"
          ? formatRelativePath(value, cwd)
          : value;
      }
    }
  }

  if (typeof call.output === "string") {
    return `output: ${call.output.split(/\r?\n/)[0]?.trim()}`;
  }

  return undefined;
}

export function extractLatestTasks(todos?: TodoTimelineItem[]): TodoItem[] {
  if (!todos || todos.length === 0) return [];
  for (let i = todos.length - 1; i >= 0; i--) {
    const item = todos[i];
    if (item?.items && item.items.length > 0) {
      return item.items;
    }
  }
  return [];
}

export function extractCurrentAndNextTasks(tasks: TodoItem[]): TodoItem[] {
  const isDone = (task: TodoItem) => task.completed || task.status === "completed";
  const activeTasks = tasks.filter((task) => !isDone(task));
  const currentIndex = activeTasks.findIndex((task) => task.status === "in_progress");

  if (currentIndex >= 0) {
    return activeTasks.slice(currentIndex, currentIndex + 2);
  }

  return activeTasks.slice(0, 2);
}

export function SummaryTurnCard({
  toolCalls,
  reasonings,
  todos = [],
  assistantMessage,
  isCurrentRunningTurn = false,
  activeAgentCwd,
}: SummaryTurnCardProps) {
  const thoughtScrollRef = useRef<HTMLDivElement>(null);
  const [showAllTasksMobile, setShowAllTasksMobile] = useState(false);

  // Extract latest tasks list from todos
  const tasks = useMemo<TodoItem[]>(() => extractLatestTasks(todos), [todos]);
  const mobileTasks = useMemo(() => extractCurrentAndNextTasks(tasks), [tasks]);
  const recentToolCalls = useMemo(() => toolCalls.slice(-3).reverse(), [toolCalls]);

  const completedTasksCount = useMemo(() => {
    return tasks.filter((t) => t.completed || t.status === "completed").length;
  }, [tasks]);

  // Aggregate tool call counts and statuses
  const { toolStats, modifiedFiles, totalToolsCount } = useMemo(() => {
    const statsMap = new Map<
      string,
      { count: number; running: number; failed: number }
    >();
    const filesMap = new Map<string, { additions: number; deletions: number }>();

    for (const call of toolCalls) {
      const rawName = call.tool || call.name || "tool";
      const name = rawName.toLowerCase();
      const current = statsMap.get(name) || { count: 0, running: 0, failed: 0 };
      current.count += 1;
      if (call.status === "running") current.running += 1;
      if (call.status === "failed") current.failed += 1;
      statsMap.set(name, current);

      // Extract file path if available
      let filePath = call.filePath;
      if (!filePath && call.input && typeof call.input === "object") {
        const inputObj = call.input as Record<string, unknown>;
        if (typeof inputObj.filePath === "string") filePath = inputObj.filePath;
        else if (typeof inputObj.path === "string") filePath = inputObj.path;
      }
      if (!filePath && typeof call.diff === "string") {
        filePath = extractFilePathFromDiff(call.diff);
      }

      if (filePath) {
        const normPath = formatRelativePath(filePath, activeAgentCwd);
        const stats = resolveDiffStats({
          diffText: typeof call.diff === "string" ? call.diff : undefined,
          additions: call.additions,
          deletions: call.deletions,
        });

        const fileEntry = filesMap.get(normPath) || { additions: 0, deletions: 0 };
        if (stats) {
          fileEntry.additions += stats.additions;
          fileEntry.deletions += stats.deletions;
        }
        filesMap.set(normPath, fileEntry);
      }
    }

    const sortedStats = Array.from(statsMap.entries())
      .map(([tool, data]) => ({
        tool,
        ...data,
      }))
      .sort((a, b) => b.count - a.count);

    const sortedFiles = Array.from(filesMap.entries())
      .map(([path, stats]) => ({
        path,
        ...stats,
      }))
      .sort((a, b) => b.additions + b.deletions - (a.additions + a.deletions));

    return {
      toolStats: sortedStats,
      modifiedFiles: sortedFiles,
      totalToolsCount: toolCalls.length,
    };
  }, [toolCalls, activeAgentCwd]);

  // Combined thoughts and duration
  const { combinedThoughtText, isStreamingReasoning, totalReasoningDurationMs } = useMemo(() => {
    let text = "";
    let isStreaming = false;
    let totalMs = 0;

    for (const r of reasonings) {
      if (r.text) {
        if (text) text += "\n\n";
        text += r.text.trim();
      }
      if (r.isStreaming) isStreaming = true;
      if (r.durationMs) totalMs += r.durationMs;
      else if (r.startedAt && r.isStreaming) {
        totalMs += Math.max(0, Date.now() - r.startedAt);
      }
    }

    return {
      combinedThoughtText: text,
      isStreamingReasoning: isStreaming,
      totalReasoningDurationMs: totalMs,
    };
  }, [reasonings]);

  // Auto-scroll thought mini console when streaming
  useEffect(() => {
    if (thoughtScrollRef.current) {
      thoughtScrollRef.current.scrollTop = thoughtScrollRef.current.scrollHeight;
    }
  }, [combinedThoughtText, isStreamingReasoning]);

  return (
    <div className="my-2 sm:my-3 space-y-2 sm:space-y-3">
      {/* 2-Column Summary Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 sm:gap-3 items-stretch">
        {/* Left Column: Tools Summary */}
        <div className="order-2 md:order-1 rounded-lg border border-border/60 bg-muted/20 p-2.5 md:p-3 flex flex-col min-w-0 min-h-0 md:min-h-[160px]">
          <div className="flex items-center justify-between pb-1.5 md:pb-2 border-b border-border/40 text-xs font-semibold text-foreground select-none shrink-0">
            <div className="flex items-center gap-1.5">
              <Wrench className="w-3.5 h-3.5 text-muted-foreground" />
              <span>Tools</span>
            </div>
            <span className="text-[11px] font-mono text-muted-foreground font-normal">
              {totalToolsCount} {totalToolsCount === 1 ? "call" : "calls"}
            </span>
          </div>

          {/* Tasks & Plan (if present) */}
          {tasks.length > 0 && (
            <div className="py-2 border-b border-border/30 space-y-2 shrink-0">
              <div className="flex items-center justify-between text-[10px] uppercase font-semibold text-muted-foreground tracking-wider select-none">
                <div className="flex items-center gap-1.5">
                  <ListTodo className="w-3.5 h-3.5 text-primary" />
                  <span>Tasks & Plan</span>
                </div>
                <span className="text-[10px] font-mono font-normal text-muted-foreground">
                  {completedTasksCount}/{tasks.length}
                </span>
              </div>
              <div className="hidden md:block">
                <TodoItemsList
                  items={tasks}
                  className="space-y-1.5 max-h-56 overflow-y-auto pr-1"
                />
              </div>
              <div className="md:hidden">
                {showAllTasksMobile ? (
                  <TodoItemsList
                    items={tasks}
                    collapseCompleted={false}
                    className="space-y-1.5"
                  />
                ) : mobileTasks.length > 0 ? (
                  <TodoItemsList items={mobileTasks} className="space-y-1.5" />
                ) : (
                  <div className="text-xs italic text-muted-foreground">All tasks complete</div>
                )}
                {tasks.length > mobileTasks.length && (
                  <PressButton
                    type="button"
                    onPress={() => setShowAllTasksMobile((expanded) => !expanded)}
                    className="mt-1.5 min-h-8 text-[11px] font-medium text-primary touch-manipulation"
                    aria-expanded={showAllTasksMobile}
                  >
                    {showAllTasksMobile ? "Show fewer tasks" : `Show all ${tasks.length} tasks`}
                  </PressButton>
                )}
              </div>
            </div>
          )}

          {recentToolCalls.length > 0 && (
            <div className="md:hidden border-b border-border/30 py-2 space-y-1.5">
              <div className="flex items-center justify-between text-[10px] uppercase font-semibold text-muted-foreground tracking-wider select-none">
                <span>Recent Activity</span>
                <span className="font-mono font-normal">{recentToolCalls.length} latest</span>
              </div>
              <div className="-mx-1">
                {recentToolCalls.map((call) => (
                  <div key={call.callId} className="flex items-start gap-2 rounded-md px-1 py-1.5 min-w-0">
                    {getToolIcon(call.name || call.tool || "tool")}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2 text-[11px] font-mono">
                        <span className="truncate font-semibold text-foreground">
                          {call.name || call.tool || "tool"}
                        </span>
                        <span
                          className={`shrink-0 ${
                            call.status === "running"
                              ? "text-amber-500"
                              : call.status === "failed"
                              ? "text-destructive"
                              : "text-muted-foreground"
                          }`}
                        >
                          {call.status}
                        </span>
                      </div>
                      {getRecentToolData(call, activeAgentCwd) && (
                        <div className="truncate text-[11px] text-muted-foreground font-mono">
                          {getRecentToolData(call, activeAgentCwd)}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tool counts */}
          <div className="py-2 grid grid-cols-2 gap-x-3 gap-y-1.5 md:block md:space-y-1.5 flex-1">
            {toolStats.length === 0 ? (
              <div className="col-span-2 text-xs text-muted-foreground italic py-1">
                No tool calls executed
              </div>
            ) : (
              toolStats.map((stat) => (
                <div
                  key={stat.tool}
                  className="flex items-center justify-between text-[11px] md:text-xs font-mono min-w-0"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {getToolIcon(stat.tool)}
                    <span className="text-foreground truncate">{stat.tool}:</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {stat.running > 0 && (
                      <Loader2 className="w-3 h-3 animate-spin text-amber-500" />
                    )}
                    {stat.failed > 0 && (
                      <span className="text-[10px] text-destructive flex items-center gap-0.5">
                        <AlertCircle className="w-2.5 h-2.5" />
                        {stat.failed}
                      </span>
                    )}
                    <span className="font-semibold text-foreground">{stat.count}x</span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Touched / Modified files */}
          {modifiedFiles.length > 0 && (
            <div className="pt-1.5 md:pt-2 border-t border-border/30 mt-auto select-none shrink-0">
              <div className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider mb-1.5">
                Touched Files ({modifiedFiles.length})
              </div>
              <div className="space-y-1 max-h-20 md:max-h-28 overflow-y-auto pr-1">
                {modifiedFiles.map((file) => (
                  <div
                    key={file.path}
                    className="flex items-center justify-between text-[11px] font-mono gap-2"
                  >
                    <span
                      className="text-foreground/85 truncate"
                      title={file.path}
                    >
                      {file.path}
                    </span>
                    <div className="flex items-center gap-1 shrink-0 text-[10px]">
                      {file.additions > 0 && (
                        <span className="text-emerald-500 font-semibold">
                          +{file.additions}
                        </span>
                      )}
                      {file.deletions > 0 && (
                        <span className="text-red-500 font-semibold">
                          -{file.deletions}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Thought Log Mini Console */}
        <div className="order-1 md:order-2 rounded-lg border border-border/60 bg-muted/20 p-2.5 md:p-3 flex flex-col min-w-0 min-h-[156px] max-h-[190px] md:h-0 md:min-h-full md:max-h-none">
          <div className="flex items-center justify-between pb-1.5 md:pb-2 border-b border-border/40 text-xs font-semibold text-foreground select-none shrink-0">
            <div className="flex items-center gap-1.5">
              <Brain className="w-3.5 h-3.5 text-blue-500" />
              <span>Thought Log</span>
            </div>
            {isStreamingReasoning ? (
              <div className="flex items-center gap-1 text-[11px] text-amber-500 font-mono">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>thinking</span>
              </div>
            ) : totalReasoningDurationMs > 0 ? (
              <span className="text-[11px] font-mono text-muted-foreground font-normal">
                {formatDuration(totalReasoningDurationMs)}
              </span>
            ) : null}
          </div>

          {/* Monospace Scrolling Console */}
          <div
            ref={thoughtScrollRef}
            className="mt-1.5 md:mt-2 h-[108px] md:h-auto md:flex-1 min-h-0 overflow-y-auto overflow-x-hidden text-xs leading-relaxed bg-background/60 rounded-md p-2 md:p-2.5 border border-border/30 text-muted-foreground select-text"
          >
            {combinedThoughtText ? (
              <MarkdownRenderer content={combinedThoughtText} variant="thought" />
            ) : isStreamingReasoning ? (
              <div className="flex items-center gap-2 italic text-muted-foreground">
                <Loader2 className="w-3 h-3 animate-spin text-amber-500 shrink-0" />
                <span>Processing thoughts...</span>
              </div>
            ) : (
              <div className="italic text-muted-foreground/60">
                No reasoning trace recorded.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom: Assistant Response or Working Status */}
      {assistantMessage ? (
        <AssistantMessage item={assistantMessage} />
      ) : isCurrentRunningTurn ? (
        <div className="flex items-center gap-2.5 p-3 rounded-xl border border-border/40 bg-muted/20 text-xs text-muted-foreground animate-pulse select-none">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-500 shrink-0" />
          <span>Agent is executing...</span>
        </div>
      ) : null}
    </div>
  );
}
