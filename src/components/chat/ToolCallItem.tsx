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
} from "lucide-react";
import { DiffViewer } from "./DiffViewer";
import type { ToolCallTimelineItem } from "../../lib/paseo/types";

export function ToolCallItem({ item }: { item: ToolCallTimelineItem }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const toolName = item.tool || (item as any).name || (item as any).title || "tool";

  const getToolIcon = () => {
    const t = toolName.toLowerCase();
    if (t.includes("bash") || t.includes("terminal") || t.includes("exec")) {
      return <Terminal className="w-3.5 h-3.5 text-amber-500" />;
    }
    if (t.includes("edit") || t.includes("write")) {
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

  // Extract a readable summary from tool input
  const getToolSummary = () => {
    if (item.title) return item.title;
    const input = item.input as any;
    if (typeof input === "object" && input !== null) {
      if (input.command) return input.command;
      if (input.filePath) return input.filePath;
      if (input.pattern) return `pattern: "${input.pattern}"`;
      if (input.query) return `query: "${input.query}"`;
    }
    return toolName;
  };

  const inputObj = typeof item.input === "object" && item.input !== null ? (item.input as any) : null;
  const isEditTool = toolName.toLowerCase().includes("edit") || (inputObj && inputObj.oldString !== undefined);

  return (
    <div className="my-2 rounded-lg border border-border bg-card/70 text-xs overflow-hidden">
      {/* Tool Header Row */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-accent/50 cursor-pointer select-none transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {getToolIcon()}
          <span className="font-semibold text-foreground font-mono">{toolName}</span>
          <span className="text-muted-foreground truncate font-mono text-[11px]">
            {getToolSummary()}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0 ml-2">
          {getStatusIcon()}
          {isExpanded ? (
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
          )}
        </div>
      </button>

      {/* Expanded Details / Diff / Output */}
      {isExpanded && (
        <div className="p-3 border-t border-border bg-background/50 space-y-2">
          {/* Edit Diff Viewer if applicable */}
          {isEditTool && inputObj && (
            <DiffViewer
              filePath={inputObj.filePath || item.filePath}
              oldString={inputObj.oldString}
              newString={inputObj.newString}
              diffText={item.diff}
            />
          )}

          {/* Input details */}
          {(!isEditTool || !inputObj?.oldString) && (
            <div className="space-y-1">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase">Input</span>
              <pre className="p-2 rounded-md bg-muted/40 font-mono text-[11px] text-foreground overflow-x-auto whitespace-pre-wrap">
                {typeof item.input === "string" ? item.input : JSON.stringify(item.input, null, 2)}
              </pre>
            </div>
          )}

          {/* Output / Result */}
          {item.output !== undefined && item.output !== null && (
            <div className="space-y-1">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase">Output</span>
              <pre className="p-2 rounded-md bg-muted/40 font-mono text-[11px] text-foreground overflow-x-auto whitespace-pre-wrap max-h-60 overflow-y-auto">
                {typeof item.output === "string" ? item.output : JSON.stringify(item.output, null, 2)}
              </pre>
            </div>
          )}

          {/* Error */}
          {item.error && (
            <div className="p-2 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-[11px] font-mono">
              {typeof item.error === "string" ? item.error : JSON.stringify(item.error, null, 2)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
