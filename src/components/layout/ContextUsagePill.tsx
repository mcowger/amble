import React from "react";
import { useWorkspace } from "../../context/WorkspaceContext";
import { Meter } from "../ui/meter";
import { Tooltip, TooltipTrigger, TooltipContent } from "../ui/tooltip";

export function ContextUsagePill() {
  const { activeAgent, models, selectedModel } = useWorkspace();

  const usage = activeAgent?.lastUsage || activeAgent?.tokenUsage;

  const usedTokens =
    usage?.contextWindowUsedTokens ??
    ((usage?.inputTokens || 0) + (usage?.cachedInputTokens || usage?.cachedTokens || 0) + (usage?.outputTokens || 0));

  const currentModel =
    models.find((m) => m.id === activeAgent?.model || m.id === selectedModel) ||
    models.find((m) => m.id.endsWith(`/${activeAgent?.model || selectedModel}`));

  const maxTokens =
    usage?.contextWindowMaxTokens ||
    usage?.contextWindow ||
    currentModel?.contextWindow ||
    1_000_000;

  const ratio = Math.min(1, Math.max(0, usedTokens / (maxTokens || 1)));
  const percentage = Math.round(ratio * 100);

  const formatK = (tokens: number): string => {
    if (tokens >= 1_000) {
      return `${Math.round(tokens / 1_000)}K`;
    }
    return `${tokens}`;
  };

  const variant: "default" | "success" | "warning" | "danger" =
    percentage >= 90 ? "danger" : percentage >= 70 ? "warning" : "default";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1 sm:gap-1.5 px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-[11px] font-medium bg-muted/60 hover:bg-muted border border-border/30 text-muted-foreground transition-colors cursor-pointer select-none shrink-0"
          title={`Context Window: ${formatK(usedTokens)} / ${formatK(maxTokens)} (${percentage}%)`}
        >
          <div className="hidden sm:block">
            <Meter
              value={usedTokens}
              max={maxTokens}
              size="sm"
              variant={variant}
              className="w-12 h-1.5"
            />
          </div>
          <span className="font-mono text-foreground font-semibold">
            {percentage}%
          </span>
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" align="center" className="space-y-1 p-2 text-xs">
        <div className="font-semibold text-foreground">Context Window</div>
        <div className="text-muted-foreground font-mono">
          {formatK(usedTokens)} / {formatK(maxTokens)} ({percentage}%)
        </div>
        <div className="text-[10px] text-muted-foreground border-t border-border/40 pt-1 mt-1 space-y-0.5 font-mono">
          <div>Used: {usedTokens.toLocaleString()} tokens</div>
          <div>Capacity: {maxTokens.toLocaleString()} tokens</div>
          <div>Remaining: {Math.max(0, maxTokens - usedTokens).toLocaleString()} tokens</div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
