import React from "react";
import { useWorkspace } from "../../context/WorkspaceContext";
import { CloudUpload, CloudDownload, PackageOpen } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent } from "../ui/tooltip";

export function SessionTokenDetailPill() {
  const { activeAgent } = useWorkspace();

  const usage = activeAgent?.lastUsage || activeAgent?.tokenUsage;
  const uncachedInput = usage?.inputTokens || 0;
  const cached = (usage?.cachedInputTokens ?? usage?.cachedTokens ?? 0) as number;
  const uploaded = uncachedInput + cached;
  const downloaded = usage?.outputTokens || 0;
  const reasoning = usage?.reasoningTokens || 0;

  const cacheHitRate =
    usage?.cacheHitRate !== undefined
      ? Math.round(usage.cacheHitRate)
      : uploaded > 0
        ? Math.round((cached / uploaded) * 100)
        : 0;

  const totalCost = usage?.totalCostUsd ?? usage?.totalCost;

  const formatCompact = (n: number): string => {
    if (n >= 1_000_000) {
      const val = n / 1_000_000;
      return `${n % 1_000_000 === 0 ? val.toFixed(0) : val.toFixed(1)}M`;
    }
    if (n >= 1_000) {
      return `${Math.round(n / 1_000)}K`;
    }
    return `${n}`;
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 sm:gap-2 px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-[11px] font-medium bg-muted/60 hover:bg-muted border border-border/30 text-muted-foreground transition-colors cursor-pointer select-none shrink-0"
          title={`Uploaded: ${formatCompact(uploaded)} • Downloaded: ${formatCompact(downloaded)} • Cache hit rate: ${cacheHitRate}%`}
        >
          {/* Uploaded / Input */}
          <div className="flex items-center gap-0.5 sm:gap-1">
            <CloudUpload className="w-3 h-3 text-blue-400 shrink-0" />
            <span className="font-mono text-foreground">{formatCompact(uploaded)}</span>
          </div>

          <span className="hidden sm:inline text-border/60">•</span>

          {/* Downloaded / Output */}
          <div className="flex items-center gap-0.5 sm:gap-1">
            <CloudDownload className="w-3 h-3 text-emerald-400 shrink-0" />
            <span className="font-mono text-foreground">{formatCompact(downloaded)}</span>
          </div>

          <span className="hidden sm:inline text-border/60">•</span>

          {/* Cache Hit Rate */}
          <div className="flex items-center gap-0.5 sm:gap-1">
            <PackageOpen className="w-3 h-3 text-amber-400 shrink-0" />
            <span className="font-mono text-foreground">{cacheHitRate}%</span>
          </div>
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" align="center" className="space-y-1 p-2 text-xs">
        <div className="font-semibold text-foreground">Session Token Breakdown</div>
        <div className="text-[11px] text-muted-foreground space-y-0.5 font-mono">
          <div className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1 text-blue-400">
              <CloudUpload className="w-3 h-3" /> Uploaded (Input):
            </span>
            <span className="text-foreground">{uploaded.toLocaleString()}</span>
          </div>
          {cached > 0 && (
            <div className="flex items-center justify-between gap-4 pl-4 text-[10px]">
              <span className="text-muted-foreground">Cached prompt:</span>
              <span className="text-foreground">{cached.toLocaleString()}</span>
            </div>
          )}
          {uncachedInput > 0 && cached > 0 && (
            <div className="flex items-center justify-between gap-4 pl-4 text-[10px]">
              <span className="text-muted-foreground">New prompt:</span>
              <span className="text-foreground">{uncachedInput.toLocaleString()}</span>
            </div>
          )}
          <div className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1 text-emerald-400">
              <CloudDownload className="w-3 h-3" /> Downloaded (Output):
            </span>
            <span className="text-foreground">{downloaded.toLocaleString()}</span>
          </div>
          {reasoning > 0 && (
            <div className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1 text-purple-400">
                Reasoning:
              </span>
              <span className="text-foreground">{reasoning.toLocaleString()}</span>
            </div>
          )}
          <div className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1 text-amber-400">
              <PackageOpen className="w-3 h-3" /> Cache Hit Rate:
            </span>
            <span className="text-foreground">{cacheHitRate}%</span>
          </div>
          {typeof totalCost === "number" && totalCost > 0 && (
            <div className="border-t border-border/40 pt-1 mt-1 flex items-center justify-between gap-4 font-semibold text-foreground">
              <span>Cost:</span>
              <span>${totalCost.toFixed(4)}</span>
            </div>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
