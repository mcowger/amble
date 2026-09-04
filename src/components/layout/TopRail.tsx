import React from "react";
import { useWorkspace } from "../../context/WorkspaceContext";
import { cn } from "../../lib/utils";
import { StatusBadge } from "./StatusBadge";
import { ContextUsagePill } from "./ContextUsagePill";
import { SessionTokenDetailPill } from "./SessionTokenDetailPill";
import { WorkspaceScriptsTopRail } from "./WorkspaceScriptsTopRail";
import { WorkspaceGitActionsTopRail } from "./WorkspaceGitActionsTopRail";
import {
  Settings,
  LayoutList,
  ListCollapse,
} from "lucide-react";
import { PressButton } from "../ui/button";

interface TopRailProps {
  onOpenSettings: () => void;
  onToggleSidebar?: () => void;
}

export function TopRail({ onOpenSettings }: TopRailProps) {
  const {
    summaryMode,
    setSummaryMode,
  } = useWorkspace();

  return (
    <header className="h-10 sm:h-11 border-b border-border bg-sidebar/70 backdrop-blur-md px-2 sm:px-3.5 flex items-center justify-between select-none z-20 shrink-0 overflow-hidden">
      {/* Left: Tasks & Services */}
      <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
        <WorkspaceScriptsTopRail />
        <WorkspaceGitActionsTopRail />
      </div>

      {/* Right: Controls & Badges */}
      <div className="flex items-center gap-1 sm:gap-1.5 md:gap-2 shrink-0">
        {/* Context Window Meter Pill */}
        <ContextUsagePill />

        {/* Session Token Detail Pill (Uploaded, Downloaded, Cache Hit Rate) */}
        <SessionTokenDetailPill />

        {/* Status Badge */}
        <StatusBadge onClick={onOpenSettings} />

        {/* Action icons */}
        <div className="flex items-center gap-0.5 border-l border-border/60 pl-1 sm:pl-2">
          <PressButton
            type="button"
            onPress={() => setSummaryMode((prev) => !prev)}
            className={cn(
              "h-7 w-7 flex items-center justify-center rounded-md cursor-pointer transition-colors touch-manipulation",
              summaryMode
                ? "bg-primary/10 text-primary hover:bg-primary/15"
                : "text-muted-foreground hover:text-foreground hover:bg-accent",
            )}
            title={summaryMode ? "Switch to Detailed View" : "Switch to Summary Mode"}
            aria-label={summaryMode ? "Switch to Detailed View" : "Switch to Summary Mode"}
          >
            {summaryMode ? (
              <ListCollapse className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            ) : (
              <LayoutList className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            )}
          </PressButton>

          <PressButton
            type="button"
            onPress={onOpenSettings}
            className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent cursor-pointer transition-colors touch-manipulation"
            title="Open Settings"
            aria-label="Open Settings"
          >
            <Settings className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </PressButton>
        </div>
      </div>
    </header>
  );
}
