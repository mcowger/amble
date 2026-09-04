import React, { useState, useMemo, useCallback } from "react";
import { useWorkspace } from "../../context/WorkspaceContext";
import { usePaseo } from "../../context/PaseoContext";
import {
  resolveWorkspaceScriptRoutes,
  stripUrlProtocol,
} from "../../lib/paseo/workspace-scripts";
import type {
  WorkspaceScriptItem,
  WorkspaceScriptRoute,
  WorkspaceScriptRouteKind,
} from "../../lib/paseo/types";
import { cn } from "../../lib/utils";
import {
  Play,
  Square,
  RotateCw,
  Terminal,
  Globe,
  Eye,
  ExternalLink,
  Copy,
  Check,
  ChevronDown,
  Loader2,
  Sparkles,
} from "lucide-react";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "../ui/popover";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "../ui/tooltip";
import { PressButton, PressTarget } from "../ui/button";

export function WorkspaceScriptsTopRail() {
  const {
    scripts,
    refreshScripts,
    startWorkspaceScript,
    stopWorkspaceScript,
    restartWorkspaceScript,
    switchToScriptTerminal,
    terminals,
    activeWorkspace,
  } = useWorkspace();
  const { client, connectionState } = usePaseo();

  const [isOpen, setIsOpen] = useState(false);
  const [inFlightAction, setInFlightAction] = useState<
    Record<string, "start" | "stop" | "restart" | null>
  >({});
  const [selectedRouteKinds, setSelectedRouteKinds] = useState<
    Record<string, WorkspaceScriptRouteKind>
  >({});
  const [expandedRoutes, setExpandedRoutes] = useState<Record<string, boolean>>({});
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  const isConnected = connectionState === "connected";
  const daemonUrl = client?.getUrl?.();

  // Sort scripts: running first, then services, then alphabetical
  const sortedScripts = useMemo(() => {
    return [...scripts].sort((a, b) => {
      if (a.lifecycle === "running" && b.lifecycle !== "running") return -1;
      if (a.lifecycle !== "running" && b.lifecycle === "running") return 1;
      if (a.type === "service" && b.type !== "service") return -1;
      if (a.type !== "service" && b.type === "service") return 1;
      return a.scriptName.localeCompare(b.scriptName);
    });
  }, [scripts]);

  const runningCount = useMemo(() => {
    return scripts.filter((s) => s.lifecycle === "running").length;
  }, [scripts]);

  const hasRunning = runningCount > 0;

  const handleCopy = useCallback(async (url: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      await navigator.clipboard.writeText(url);
      setCopiedUrl(url);
      setTimeout(() => setCopiedUrl(null), 2000);
    } catch {
      // ignore clipboard failure
    }
  }, []);

  const handleStart = async (script: WorkspaceScriptItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setInFlightAction((prev) => ({ ...prev, [script.scriptName]: "start" }));
    try {
      const res = await startWorkspaceScript(script.scriptName, {
        switchToTerminal: true,
      });
      if (res.terminalId) {
        setIsOpen(false);
      }
    } finally {
      setInFlightAction((prev) => ({ ...prev, [script.scriptName]: null }));
    }
  };

  const handleStop = async (script: WorkspaceScriptItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setInFlightAction((prev) => ({ ...prev, [script.scriptName]: "stop" }));
    try {
      await stopWorkspaceScript(script.scriptName);
    } finally {
      setInFlightAction((prev) => ({ ...prev, [script.scriptName]: null }));
    }
  };

  const handleRestart = async (script: WorkspaceScriptItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setInFlightAction((prev) => ({ ...prev, [script.scriptName]: "restart" }));
    try {
      await restartWorkspaceScript(script.scriptName, {
        switchToTerminal: false,
      });
    } finally {
      setInFlightAction((prev) => ({ ...prev, [script.scriptName]: null }));
    }
  };

  const handleViewTerminal = async (script: WorkspaceScriptItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const terminalId =
      script.terminalId ||
      terminals.find((t) => t.title === script.scriptName)?.id;
    if (terminalId) {
      await switchToScriptTerminal(terminalId);
      setIsOpen(false);
    }
  };

  const handleOpenUrl = (url: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const toggleRoutesExpanded = (scriptName: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setExpandedRoutes((prev) => ({
      ...prev,
      [scriptName]: !prev[scriptName],
    }));
  };

  const selectRouteKind = (
    scriptName: string,
    kind: WorkspaceScriptRouteKind,
    e?: React.MouseEvent,
  ) => {
    if (e) e.stopPropagation();
    setSelectedRouteKinds((prev) => ({ ...prev, [scriptName]: kind }));
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <button
              type="button"
              disabled={!isConnected}
              className={cn(
                "h-7 sm:h-7.5 px-1.5 sm:px-2 rounded-md flex items-center gap-1 sm:gap-1.5 text-xs font-medium cursor-pointer transition-all duration-150 border select-none outline-none",
                hasRunning
                  ? "bg-primary/10 border-primary/30 text-primary hover:bg-primary/15 hover:border-primary/40 shadow-xs"
                  : "bg-muted/40 border-border/70 text-muted-foreground hover:text-foreground hover:bg-accent hover:border-border",
                !isConnected && "opacity-50 cursor-not-allowed",
              )}
              aria-label="Workspace tasks & services"
            >
              <Play
                className={cn(
                  "w-3.5 h-3.5 transition-colors",
                  hasRunning ? "text-primary fill-primary/20" : "text-muted-foreground",
                )}
              />
              <ChevronDown
                className={cn(
                  "w-3 h-3 transition-transform duration-200",
                  isOpen && "rotate-180",
                  hasRunning ? "text-primary" : "text-muted-foreground",
                )}
              />
            </button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom" align="start">
          {hasRunning
            ? `${runningCount} ${runningCount === 1 ? "task/service" : "tasks/services"} running`
            : "Tasks & services"}
        </TooltipContent>
      </Tooltip>

      <PopoverContent
        align="start"
        sideOffset={6}
        className="w-80 sm:w-88 p-2.5 rounded-xl border border-border bg-card text-card-foreground shadow-2xl z-50 flex flex-col gap-2"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-1 pt-0.5 pb-1 border-b border-border/60">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-foreground tracking-tight">
              Tasks & Services
            </span>
            {hasRunning && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-medium bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                {runningCount} running
              </span>
            )}
          </div>
          <PressButton
            type="button"
            onPress={() => refreshScripts()}
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent cursor-pointer transition-colors"
            title="Refresh scripts"
          >
            <RotateCw className="w-3 h-3" />
          </PressButton>
        </div>

        {/* Empty State */}
        {sortedScripts.length === 0 ? (
          <div className="py-6 px-3 text-center flex flex-col items-center justify-center gap-1.5 text-muted-foreground">
            <Terminal className="w-6 h-6 stroke-1 text-muted-foreground/60" />
            <p className="text-xs font-medium text-foreground">No scripts or services</p>
            <p className="text-[11px] leading-relaxed text-muted-foreground max-w-[220px]">
              Define tasks and services in your workspace configuration or package.json.
            </p>
          </div>
        ) : (
          /* Scripts & Services List */
          <div className="flex flex-col gap-1.5 max-h-[360px] overflow-y-auto pr-0.5">
            {sortedScripts.map((script) => {
              const isRunning = script.lifecycle === "running";
              const inFlight = inFlightAction[script.scriptName];
              const routes = isRunning
                ? resolveWorkspaceScriptRoutes(script, daemonUrl)
                : [];
              const selectedKind =
                selectedRouteKinds[script.scriptName] || routes[0]?.kind || "public";
              const activeRoute =
                routes.find((r) => r.kind === selectedKind) || routes[0] || null;
              const isRoutesOpen = !!expandedRoutes[script.scriptName];

              return (
                <div
                  key={script.scriptName}
                  className={cn(
                    "p-2 rounded-lg border transition-all duration-150 flex flex-col gap-1.5",
                    isRunning
                      ? "bg-muted/35 border-border/80 shadow-xs"
                      : "bg-muted/15 border-border/40 hover:bg-muted/25 hover:border-border/60",
                  )}
                >
                  {/* Top Row: Icon + Name + Actions */}
                  <div className="flex items-center justify-between gap-2">
                    {/* Left: Type Icon + Script Name + Status */}
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      {script.type === "service" ? (
                        <Globe
                          className={cn(
                            "w-3.5 h-3.5 shrink-0 transition-colors",
                            isRunning ? "text-blue-500" : "text-muted-foreground",
                          )}
                        />
                      ) : (
                        <Terminal
                          className={cn(
                            "w-3.5 h-3.5 shrink-0 transition-colors",
                            isRunning ? "text-amber-500" : "text-muted-foreground",
                          )}
                        />
                      )}

                      <span className="font-mono text-xs font-medium text-foreground truncate select-text">
                        {script.scriptName}
                      </span>

                      {/* Status indicator */}
                      {isRunning ? (
                        <span className="flex items-center gap-1 shrink-0">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          {script.health === "healthy" && (
                            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                              healthy
                            </span>
                          )}
                        </span>
                      ) : script.exitCode !== null && script.exitCode !== undefined ? (
                        <span className="text-[10px] font-mono text-muted-foreground/80 shrink-0">
                          exit {script.exitCode}
                        </span>
                      ) : null}
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-0.5 shrink-0">
                      {!isRunning ? (
                        /* Run / Start Button */
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <PressButton
                              type="button"
                              disabled={inFlight !== undefined && inFlight !== null}
                              onPress={() => handleStart(script)}
                              className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent cursor-pointer transition-colors"
                              aria-label={`Run ${script.scriptName}`}
                            >
                              {inFlight === "start" ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                              ) : (
                                <Play className="w-3.5 h-3.5 fill-current/10" />
                              )}
                            </PressButton>
                          </TooltipTrigger>
                          <TooltipContent side="top">Run task</TooltipContent>
                        </Tooltip>
                      ) : (
                        /* Running Action Buttons: Open, Terminal, Restart, Stop */
                        <>
                          {/* Open service URL in new tab */}
                          {activeRoute && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <PressButton
                                  type="button"
                                  onPress={() => handleOpenUrl(activeRoute.url)}
                                  className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent cursor-pointer transition-colors"
                                  aria-label="Open service in new tab"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </PressButton>
                              </TooltipTrigger>
                              <TooltipContent side="top">Open in browser</TooltipContent>
                            </Tooltip>
                          )}

                          {/* View Terminal */}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <PressButton
                                type="button"
                                onPress={() => handleViewTerminal(script)}
                                className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent cursor-pointer transition-colors"
                                aria-label="View terminal"
                              >
                                <Terminal className="w-3.5 h-3.5" />
                              </PressButton>
                            </TooltipTrigger>
                            <TooltipContent side="top">View terminal</TooltipContent>
                          </Tooltip>

                          {/* Restart */}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <PressButton
                                type="button"
                                disabled={inFlight !== undefined && inFlight !== null}
                                onPress={() => handleRestart(script)}
                                className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent cursor-pointer transition-colors"
                                aria-label="Restart"
                              >
                                {inFlight === "restart" ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                                ) : (
                                  <RotateCw className="w-3.5 h-3.5" />
                                )}
                              </PressButton>
                            </TooltipTrigger>
                            <TooltipContent side="top">Restart</TooltipContent>
                          </Tooltip>

                          {/* Stop */}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <PressButton
                                type="button"
                                disabled={inFlight !== undefined && inFlight !== null}
                                onPress={() => handleStop(script)}
                                className="p-1 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer transition-colors"
                                aria-label="Stop"
                              >
                                {inFlight === "stop" ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin text-destructive" />
                                ) : (
                                  <Square className="w-3.5 h-3.5 fill-current/15" />
                                )}
                              </PressButton>
                            </TooltipTrigger>
                            <TooltipContent side="top">Stop</TooltipContent>
                          </Tooltip>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Proxied Service URL Row (when running service has routes) */}
                  {isRunning && script.type === "service" && routes.length > 0 && activeRoute && (
                    <div className="flex flex-col gap-1 mt-0.5">
                      {/* Active Route Bar */}
                      <div className="flex items-center justify-between gap-1.5 px-2 py-1 rounded-md bg-card border border-border/60 text-[11px] font-mono">
                        <PressButton
                          type="button"
                          onPress={() => toggleRoutesExpanded(script.scriptName)}
                          className="flex items-center gap-1.5 min-w-0 flex-1 text-left text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                          title="Choose URL route"
                        >
                          <ChevronDown
                            className={cn(
                              "w-3 h-3 shrink-0 transition-transform duration-200",
                              isRoutesOpen && "rotate-180",
                            )}
                          />
                          <span className="truncate text-foreground select-text font-mono">
                            {activeRoute.displayUrl}
                          </span>
                        </PressButton>

                        <div className="flex items-center gap-0.5 shrink-0">
                          {/* Copy active URL button */}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <PressButton
                                type="button"
                                onPress={() => handleCopy(activeRoute.url)}
                                className="p-1 rounded-sm text-muted-foreground hover:text-foreground hover:bg-accent cursor-pointer transition-colors"
                                aria-label="Copy URL"
                              >
                                {copiedUrl === activeRoute.url ? (
                                  <Check className="w-3 h-3 text-emerald-500" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </PressButton>
                            </TooltipTrigger>
                            <TooltipContent side="top">
                              {copiedUrl === activeRoute.url ? "Copied!" : "Copy URL"}
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      </div>

                      {/* Route Selection Drawer / Dropdown */}
                      {isRoutesOpen && (
                        <div className="p-1 rounded-lg border border-border bg-sidebar/50 flex flex-col gap-1 animate-in fade-in-0 zoom-in-95">
                          {routes.map((route) => {
                            const isSelected = route.kind === activeRoute.kind;
                            return (
                              <PressTarget
                                key={route.kind}
                                onPress={() => {
                                  selectRouteKind(script.scriptName, route.kind);
                                  handleCopy(route.url);
                                }}
                                className={cn(
                                  "px-2 py-1.5 rounded-md cursor-pointer flex items-start justify-between gap-2 transition-colors",
                                  isSelected
                                    ? "bg-accent text-accent-foreground"
                                    : "hover:bg-accent/60 text-muted-foreground hover:text-foreground",
                                )}
                              >
                                <div className="flex items-start gap-1.5 min-w-0 flex-1">
                                  <div className="w-3.5 h-3.5 shrink-0 flex items-center justify-center mt-0.5">
                                    {isSelected ? (
                                      <Check className="w-3.5 h-3.5 text-primary" />
                                    ) : null}
                                  </div>
                                  <div className="flex flex-col min-w-0">
                                    <span className="text-[11px] font-semibold text-foreground leading-tight">
                                      {route.name}
                                    </span>
                                    <span className="text-[10px] font-mono text-muted-foreground truncate select-text leading-tight mt-0.5">
                                      {route.displayUrl}
                                    </span>
                                  </div>
                                </div>

                                <div className="flex items-center gap-0.5 shrink-0 pt-0.5">
                                  {/* Open directly */}
                                  <PressButton
                                    type="button"
                                    onPress={() => handleOpenUrl(route.url)}
                                    className="p-1 rounded-sm hover:bg-background/80 text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                                    title={`Open ${route.name}`}
                                  >
                                    <ExternalLink className="w-3 h-3" />
                                  </PressButton>

                                  {/* Copy directly */}
                                  <PressButton
                                    type="button"
                                    onPress={() => handleCopy(route.url)}
                                    className="p-1 rounded-sm hover:bg-background/80 text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                                    title={`Copy ${route.name} URL`}
                                  >
                                    {copiedUrl === route.url ? (
                                      <Check className="w-3 h-3 text-emerald-500" />
                                    ) : (
                                      <Copy className="w-3 h-3" />
                                    )}
                                  </PressButton>
                                </div>
                              </PressTarget>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
