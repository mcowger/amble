import React, { useState, useMemo } from "react";
import {
  Bot,
  Search,
  FileText,
  FileCode,
  Terminal,
  Globe,
  Code2,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  ChevronDown,
  Copy,
  Check,
} from "lucide-react";
import type { ToolCallTimelineItem } from "../../lib/paseo/types";
import { useWorkspace } from "../../context/WorkspaceContext";
import {
  getToolDisplayInfo,
  getFileExtension,
  getActionTargetText,
  cleanSubagentOutput,
  resolveAndDeduplicateActions,
  type SubagentChildAction,
  type ToolCategory,
} from "../../lib/subagent-helpers";
import { MarkdownRenderer } from "./MarkdownRenderer";

const DEFAULT_VISIBLE_ACTIONS = 6;

function ActionToolIcon({ category }: { category: ToolCategory }) {
  switch (category) {
    case "search":
      return <Search className="w-3.5 h-3.5 text-purple-500 shrink-0" />;
    case "read":
      return <FileText className="w-3.5 h-3.5 text-emerald-500 shrink-0" />;
    case "edit":
      return <FileCode className="w-3.5 h-3.5 text-blue-500 shrink-0" />;
    case "terminal":
      return <Terminal className="w-3.5 h-3.5 text-amber-500 shrink-0" />;
    case "web":
      return <Globe className="w-3.5 h-3.5 text-cyan-500 shrink-0" />;
    case "subagent":
      return <Bot className="w-3.5 h-3.5 text-primary shrink-0" />;
    default:
      return <Code2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />;
  }
}

export function SubagentCallItem({ item }: { item: ToolCallTimelineItem }) {
  const { getSubagentInfo, activeAgent, activeWorkspace } = useWorkspace();
  const [isActionsExpanded, setIsActionsExpanded] = useState(false);
  const [isOutputExpanded, setIsOutputExpanded] = useState(false);
  const [hasCopied, setHasCopied] = useState(false);

  const cwd =
    activeAgent?.cwd ||
    activeAgent?.project?.checkout?.cwd ||
    activeWorkspace?.path;

  const subInfo = getSubagentInfo(item.callId, item);

  const isRunning =
    (item.status === "running" || subInfo?.status === "running") &&
    item.status !== "completed" &&
    item.status !== "failed" &&
    item.status !== "canceled" &&
    subInfo?.status !== "completed" &&
    subInfo?.status !== "failed" &&
    subInfo?.status !== "canceled";
  const isFailed = item.status === "failed" || subInfo?.status === "failed";
  const isCompleted = !isRunning && !isFailed;

  const description =
    subInfo?.description ||
    (item.detail as any)?.description ||
    (item.input as any)?.description ||
    (item.input as any)?.prompt ||
    item.title ||
    "";

  const actions = useMemo<SubagentChildAction[]>(() => {
    return resolveAndDeduplicateActions(subInfo?.actions || [], cwd, isCompleted);
  }, [subInfo?.actions, cwd, isCompleted]);

  const outputText =
    subInfo?.output || (typeof item.output === "string" ? item.output : (item.detail as any)?.log);

  const cleanOutput = useMemo(() => {
    return cleanSubagentOutput(outputText);
  }, [outputText]);

  const visibleActions = useMemo(() => {
    if (isActionsExpanded || actions.length <= DEFAULT_VISIBLE_ACTIONS) {
      return actions;
    }
    return actions.slice(-DEFAULT_VISIBLE_ACTIONS);
  }, [actions, isActionsExpanded]);

  const hiddenCount = Math.max(0, actions.length - visibleActions.length);

  const handleCopyOutput = () => {
    if (!cleanOutput) return;
    navigator.clipboard.writeText(cleanOutput);
    setHasCopied(true);
    setTimeout(() => setHasCopied(false), 2000);
  };

  return (
    <div className="my-2.5 text-xs select-none">
      {/* Header Row */}
      <div className="flex items-center gap-2 py-1 px-1">
        <Bot className="w-3.5 h-3.5 text-foreground/80 shrink-0" />
        <span className="font-semibold text-foreground/90 font-mono shrink-0">
          Agent Task
        </span>
        {description ? (
          <span
            className="text-muted-foreground truncate flex-1 min-w-0 font-normal"
            title={description}
          >
            {description}
          </span>
        ) : null}

        {/* Status indicator on right */}
        <div className="flex items-center gap-1.5 shrink-0 ml-auto">
          {isRunning ? (
            <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-500" />
            </div>
          ) : isFailed ? (
            <AlertCircle className="w-3.5 h-3.5 text-destructive" />
          ) : (
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500/80" />
          )}
        </div>
      </div>

      {/* Tree Guide Line & Child Actions */}
      <div className="relative ml-2.5 pl-4 py-1 border-l border-border/80 space-y-1">
        {/* +N more... toggle button if more items than default view */}
        {hiddenCount > 0 ? (
          <button
            type="button"
            onClick={() => setIsActionsExpanded(true)}
            className="text-[11px] text-muted-foreground/70 hover:text-foreground font-mono py-0.5 select-none text-left cursor-pointer transition-colors block"
          >
            +{hiddenCount} more...
          </button>
        ) : isActionsExpanded && actions.length > DEFAULT_VISIBLE_ACTIONS ? (
          <button
            type="button"
            onClick={() => setIsActionsExpanded(false)}
            className="text-[11px] text-muted-foreground/70 hover:text-foreground font-mono py-0.5 select-none text-left cursor-pointer transition-colors block"
          >
            Show fewer
          </button>
        ) : null}

        {/* Action entries list */}
        {visibleActions.length > 0 ? (
          visibleActions.map((action, idx) => {
            const toolInfo = getToolDisplayInfo(action.tool);
            const targetText = getActionTargetText(action, cwd);
            const ext =
              toolInfo.category === "read" || toolInfo.category === "edit"
                ? getFileExtension(action.filePath || targetText)
                : null;
            const isActionRunning = isRunning && action.status === "running";

            return (
              <div
                key={action.id || `${action.tool}-${idx}`}
                className="flex items-center gap-2 min-w-0 w-full py-0.5 text-xs font-mono"
              >
                <ActionToolIcon category={toolInfo.category} />
                <span className="text-[11.5px] font-medium text-foreground/80 shrink-0 select-none">
                  {toolInfo.displayName}
                </span>

                {/* File extension badge if applicable */}
                {ext ? (
                  <span className="px-1 py-0.2 rounded text-[9px] font-mono font-semibold uppercase bg-muted text-muted-foreground shrink-0 border border-border/50">
                    {ext}
                  </span>
                ) : null}

                {/* Target text: path / query / command / summary */}
                {targetText ? (
                  <span
                    className="text-[11px] font-mono text-muted-foreground/80 truncate min-w-0 flex-1 select-text"
                    title={targetText}
                  >
                    {targetText}
                  </span>
                ) : null}

                {isActionRunning ? (
                  <Loader2 className="w-3 h-3 animate-spin text-amber-500 shrink-0 ml-auto" />
                ) : null}
              </div>
            );
          })
        ) : isRunning ? (
          <div className="flex items-center gap-2 py-1 text-xs text-muted-foreground/70 italic font-mono">
            <Loader2 className="w-3 h-3 animate-spin text-amber-500 shrink-0" />
            <span>Waiting for subagent activity...</span>
          </div>
        ) : (
          <div className="text-xs text-muted-foreground/60 italic font-mono py-0.5">
            No subagent activity recorded
          </div>
        )}

        {/* Collapsible Output Section */}
        {cleanOutput ? (
          <div className="pt-1.5">
            <button
              type="button"
              onClick={() => setIsOutputExpanded(!isOutputExpanded)}
              className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer select-none"
            >
              {isOutputExpanded ? (
                <ChevronDown className="w-3 h-3 shrink-0" />
              ) : (
                <ChevronRight className="w-3 h-3 shrink-0" />
              )}
              <span>Output</span>
            </button>

            {isOutputExpanded ? (
              <div className="mt-1.5 relative rounded-lg bg-card/60 border border-border p-3 text-foreground text-[11px] overflow-x-auto max-h-72 overflow-y-auto select-text">
                <div className="absolute top-2 right-2 z-10">
                  <button
                    type="button"
                    onClick={handleCopyOutput}
                    className="p-1 rounded bg-background/80 hover:bg-accent border border-border text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                    title="Copy output"
                  >
                    {hasCopied ? (
                      <Check className="w-3 h-3 text-emerald-500" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </button>
                </div>
                <MarkdownRenderer content={cleanOutput} />
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
