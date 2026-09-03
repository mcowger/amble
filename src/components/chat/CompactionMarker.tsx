import React from "react";
import { Scissors, Loader2 } from "lucide-react";
import type { CompactionTimelineItem } from "../../lib/paseo/types";

export interface CompactionMarkerProps {
  item: CompactionTimelineItem;
}

export function getCompactionMarkerLabel(
  item: Pick<CompactionTimelineItem, "status" | "trigger" | "preTokens">,
): string {
  if (item.status === "loading") {
    return "Compacting...";
  }
  if (item.trigger === "auto") {
    return "Context automatically compacted";
  }
  if (item.trigger === "manual") {
    return "Context manually compacted";
  }
  if (typeof item.preTokens === "number" && item.preTokens > 0) {
    const k = Math.round(item.preTokens / 1000);
    return `Context compacted (${k}k tokens)`;
  }
  return "Context compacted";
}

export const CompactionMarker = React.memo(function CompactionMarker({
  item,
}: CompactionMarkerProps) {
  const label = getCompactionMarkerLabel(item);
  const isLoading = item.status === "loading";

  return (
    <div
      className="flex items-center gap-3 my-6 px-2 select-none"
      data-testid="compaction-marker"
      role="separator"
      aria-label={label}
    >
      <div className="flex-1 h-px bg-border" />
      <div className="flex items-center gap-2 text-xs text-muted-foreground font-sans tracking-wide">
        {isLoading ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground shrink-0" />
        ) : (
          <Scissors className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        )}
        <span>{label}</span>
      </div>
      <div className="flex-1 h-px bg-border" />
    </div>
  );
});
