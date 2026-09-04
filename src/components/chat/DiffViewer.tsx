import React, { useState } from "react";
import { FileCode, ChevronDown, ChevronRight, Copy, Check } from "lucide-react";
import { useWorkspace } from "../../context/WorkspaceContext";
import { formatRelativePath } from "../../lib/utils";
import { countDiffStats, type DiffStats } from "./diff-utils";
import { PressButton } from "../ui/button";

interface DiffViewerProps {
  filePath?: string;
  diffText?: string;
  oldString?: string;
  newString?: string;
  stats?: DiffStats;
}

export function DiffViewer({ filePath, diffText, oldString, newString, stats }: DiffViewerProps) {
  const { activeWorkspace, activeAgent } = useWorkspace();
  const cwd = activeAgent?.cwd || activeAgent?.project?.checkout?.cwd || activeWorkspace?.path;
  const displayPath = formatRelativePath(filePath, cwd) || "Diff";

  const [copied, setCopied] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);

  const parseDiffLines = () => {
    if (diffText) {
      return diffText.split("\n").map((line, idx) => {
        let type: "add" | "del" | "ctx" | "hdr" = "ctx";
        if (line.startsWith("+") && !line.startsWith("+++")) type = "add";
        else if (line.startsWith("-") && !line.startsWith("---")) type = "del";
        else if (line.startsWith("@@")) type = "hdr";
        return { line, type, id: idx };
      });
    }

    if (oldString !== undefined || newString !== undefined) {
      const lines: Array<{ line: string; type: "add" | "del" | "ctx" | "hdr"; id: number }> = [];
      if (oldString) {
        oldString.split("\n").forEach((l, idx) => {
          lines.push({ line: `-${l}`, type: "del", id: idx });
        });
      }
      if (newString) {
        newString.split("\n").forEach((l, idx) => {
          lines.push({ line: `+${l}`, type: "add", id: 1000 + idx });
        });
      }
      return lines;
    }

    return [];
  };

  const lines = parseDiffLines();
  const countedStats = diffText ? countDiffStats(diffText) : {
    additions: lines.filter((l) => l.type === "add").length,
    deletions: lines.filter((l) => l.type === "del").length,
  };
  const additions = stats?.additions ?? countedStats.additions;
  const deletions = stats?.deletions ?? countedStats.deletions;

  const handleCopy = () => {
    const content = diffText || `${oldString}\n${newString}`;
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden my-2 text-xs font-mono">
      {/* File Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-muted/40 border-b border-border select-none">
        <PressButton
          onPress={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 text-foreground font-medium hover:text-primary cursor-pointer truncate"
        >
          {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          <FileCode className="w-4 h-4 text-primary shrink-0" />
          <span className="truncate">{displayPath}</span>
        </PressButton>

        <div className="flex items-center gap-2">
          {(additions > 0 || deletions > 0) && (
            <div className="flex items-center gap-1.5 text-[11px] font-medium">
              {additions > 0 && <span className="text-emerald-600 dark:text-emerald-400">+{additions}</span>}
              {deletions > 0 && <span className="text-rose-600 dark:text-rose-400">-{deletions}</span>}
            </div>
          )}

          <PressButton
            onPress={handleCopy}
            className="p-1 rounded-sm text-muted-foreground hover:text-foreground hover:bg-accent cursor-pointer"
            title="Copy diff"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
          </PressButton>
        </div>
      </div>

      {/* Code diff lines */}
      {isExpanded && (
        <div className="overflow-x-auto max-h-96 p-2 bg-background/50 space-y-0.5">
          {lines.length === 0 ? (
            <div className="text-muted-foreground italic px-2 py-1">No changes</div>
          ) : (
            lines.map((l) => {
              let rowStyle = "text-foreground";
              if (l.type === "add") {
                rowStyle = "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-medium";
              } else if (l.type === "del") {
                rowStyle = "bg-rose-500/10 text-rose-700 dark:text-rose-300 opacity-80";
              } else if (l.type === "hdr") {
                rowStyle = "text-blue-500 bg-blue-500/5 font-semibold";
              }

              return (
                <div key={l.id} className={`px-2 py-0.5 rounded-xs leading-relaxed whitespace-pre font-mono ${rowStyle}`}>
                  {l.line}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
