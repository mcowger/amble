import React, { useEffect, useRef, useState, useLayoutEffect, useMemo } from "react";
import { useWorkspace } from "../../context/WorkspaceContext";
import { ScrollArea } from "../ui/scroll-area";
import { UserCard } from "./UserCard";
import { AssistantMessage } from "./AssistantMessage";
import { ThinkingTrace } from "./ThinkingTrace";
import { ToolCallItem } from "./ToolCallItem";
import { TodoBlock } from "./TodoBlock";
import { CompactionMarker } from "./CompactionMarker";
import { PendingPermissionCard } from "./PendingPermissionCard";
import {
  Sparkles,
  ArrowDown,
  AlertCircle,
  Terminal,
  FileCode,
  Search,
  Loader2,
} from "lucide-react";
import type { TimelineItem } from "../../lib/paseo/types";

export function ChatTimeline({ onSelectPrompt }: { onSelectPrompt?: (prompt: string) => void }) {
  const {
    timeline,
    isTimelineLoading,
    isTurnRunning,
    activeAgent,
    activeWorkspace,
    activeAgentId,
    pendingPermissions,
    respondToPermission,
  } = useWorkspace();

  const agentPendingPermissions = useMemo(() => {
    if (!activeAgentId) return [];
    return pendingPermissions.filter((p) => p.agentId === activeAgentId);
  }, [pendingPermissions, activeAgentId]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const initialScrollDoneRef = useRef<string | null>(null);
  const prevTimelineLengthRef = useRef<number>(0);
  const isPinnedToBottomRef = useRef<boolean>(true);
  const prevIsTurnRunningRef = useRef<boolean>(isTurnRunning);

  // Track user manual expansion overrides per reasoning item index
  const [userReasoningOverrides, setUserReasoningOverrides] = useState<Record<number, boolean>>({});
  const prevLatestReasoningIdxRef = useRef<number>(-1);
  const isSwitchingSessionRef = useRef(false);
  const switchSettleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Find the index of the latest reasoning item in the timeline
  const latestReasoningIndex = useMemo(() => {
    for (let i = timeline.length - 1; i >= 0; i--) {
      if (timeline[i]?.type === "reasoning") {
        return i;
      }
    }
    return -1;
  }, [timeline]);

  // When a new thought section begins, reset user overrides so previous collapses and new one expands
  useEffect(() => {
    if (latestReasoningIndex !== -1 && latestReasoningIndex !== prevLatestReasoningIdxRef.current) {
      setUserReasoningOverrides({});
      prevLatestReasoningIdxRef.current = latestReasoningIndex;
    }
  }, [latestReasoningIndex]);

  // Reset overrides and trigger session switch pinning when switching active agent / session
  useEffect(() => {
    setUserReasoningOverrides({});
    prevLatestReasoningIdxRef.current = -1;
    isSwitchingSessionRef.current = true;
    initialScrollDoneRef.current = null;
    isPinnedToBottomRef.current = true;
  }, [activeAgentId]);

  // Observe inner content container resizes to keep bottom pinned when code blocks,
  // images, syntax highlighting, or new streaming tokens expand the timeline height
  useEffect(() => {
    const el = contentRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(() => {
      if (isSwitchingSessionRef.current) return;

      if (isPinnedToBottomRef.current && scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Instant scroll to bottom on initial load / session switch (no animation)
  useLayoutEffect(() => {
    if (!scrollRef.current || timeline.length === 0) return;

    const currentAgentKey = activeAgentId || "default";
    const isNewSession = initialScrollDoneRef.current !== currentAgentKey;

    if (isNewSession) {
      initialScrollDoneRef.current = currentAgentKey;
      isSwitchingSessionRef.current = true;
      isPinnedToBottomRef.current = true;
      setShowScrollBottom(false);
      if (switchSettleTimeoutRef.current) {
        clearTimeout(switchSettleTimeoutRef.current);
      }

      // Immediately pin to bottom before paint
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      prevTimelineLengthRef.current = timeline.length;

      // Keep pinned to bottom on consecutive animation frames as markdown & syntax highlighters expand
      const frame1 = requestAnimationFrame(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
        const frame2 = requestAnimationFrame(() => {
          if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
          }
        });
      });

      switchSettleTimeoutRef.current = setTimeout(() => {
        isSwitchingSessionRef.current = false;
      }, 250);

      return () => {
        cancelAnimationFrame(frame1);
      };
    }

    // If still in the session switch settlement window, keep pinned instantly without animation
    if (isSwitchingSessionRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      prevTimelineLengthRef.current = timeline.length;
      return;
    }

    const wasRunning = prevIsTurnRunningRef.current;
    prevIsTurnRunningRef.current = isTurnRunning;
    const isTurnCompleted = wasRunning && !isTurnRunning;

    const lastItem = timeline[timeline.length - 1];
    if (lastItem?.type === "user_message" || agentPendingPermissions.length > 0) {
      isPinnedToBottomRef.current = true;
    }

    // If user is pinned to bottom OR a turn has just completed:
    if (isPinnedToBottomRef.current || isTurnCompleted) {
      if (isTurnCompleted) {
        isPinnedToBottomRef.current = true;
      }

      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;

      // Consecutive frame settling to ensure code blocks and syntax-highlighted blocks are fully scrolled
      const frame1 = requestAnimationFrame(() => {
        if (scrollRef.current && isPinnedToBottomRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
        const frame2 = requestAnimationFrame(() => {
          if (scrollRef.current && isPinnedToBottomRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
          }
        });
      });

      return () => {
        cancelAnimationFrame(frame1);
      };
    }

    prevTimelineLengthRef.current = timeline.length;
  }, [timeline, activeAgentId, isTurnRunning, agentPendingPermissions.length]);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    const isUp = distanceFromBottom > 100;
    setShowScrollBottom(isUp);

    // If user is near the bottom, keep them pinned.
    // If they scrolled up > 100px, respect their position and don't auto-scroll.
    if (distanceFromBottom <= 50) {
      isPinnedToBottomRef.current = true;
    } else if (distanceFromBottom > 100) {
      isPinnedToBottomRef.current = false;
    }
  };

  const scrollToBottomSmooth = () => {
    isPinnedToBottomRef.current = true;
    setShowScrollBottom(false);
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  };

  const samplePrompts = [
    { label: "Analyze project structure", icon: <Search className="w-3.5 h-3.5 text-purple-500" />, prompt: "Explore the codebase and explain the main architectural patterns and directory layout." },
    { label: "Run tests and inspect failures", icon: <Terminal className="w-3.5 h-3.5 text-amber-500" />, prompt: "Run the test suite and summarize any failing tests with proposed fixes." },
    { label: "Review recent Git changes", icon: <FileCode className="w-3.5 h-3.5 text-blue-500" />, prompt: "Inspect the current git status, recent commits, and summarize open modifications." },
  ];

  return (
    <div className="relative flex-1 h-full min-h-0 overflow-hidden flex flex-col">
      {/* Scrollable Container with Shadcn ScrollArea */}
      <ScrollArea
        type="always"
        viewportRef={scrollRef}
        onScroll={handleScroll}
        className="flex-1 h-full min-h-0 w-full"
        viewportClassName="px-3 sm:px-4 md:px-8 py-4 sm:py-6"
      >
        <div ref={contentRef} className="space-y-4 max-w-4xl w-full mx-auto min-w-0">
          {isTimelineLoading && timeline.length === 0 ? (
            <div className="flex items-center justify-center h-64 text-muted-foreground gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
              <span className="text-xs">Loading session history...</span>
            </div>
          ) : timeline.length === 0 ? (
            /* Empty State */
            <div className="flex flex-col items-center justify-center min-h-[50vh] text-center max-w-md mx-auto space-y-6 select-none">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-xs">
                <Sparkles className="w-6 h-6 text-amber-500" />
              </div>

              <div className="space-y-1.5">
                <h2 className="text-base font-semibold text-foreground">
                  How can Paseo help you today?
                </h2>
                <p className="text-xs text-muted-foreground">
                  Working in <span className="font-semibold text-foreground">{activeWorkspace?.name || "current workspace"}</span>.
                  Ask questions, edit code, run terminal commands, or review diffs.
                </p>
              </div>

              {/* Prompt suggestions */}
              <div className="w-full space-y-2 pt-2">
                {samplePrompts.map((item, idx) => (
                  <button
                    key={idx}
                    onClick={() => onSelectPrompt?.(item.prompt)}
                    className="w-full flex items-center gap-3 p-3 rounded-xl border border-border bg-card hover:bg-accent/60 text-left cursor-pointer transition-all hover:shadow-2xs group"
                  >
                    <div className="p-1.5 rounded-lg bg-muted group-hover:bg-background shrink-0">
                      {item.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-medium text-foreground">{item.label}</div>
                      <div className="text-[11px] text-muted-foreground truncate">{item.prompt}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* Timeline items */
            timeline.map((item, index) => {
              switch (item.type) {
                case "user_message":
                  return <UserCard key={index} item={item} />;
                case "assistant_message":
                  return <AssistantMessage key={index} item={item} />;
                case "reasoning": {
                  const isLatest = index === latestReasoningIndex;
                  const defaultExpanded = isLatest || Boolean(item.isStreaming);
                  const isExpanded =
                    userReasoningOverrides[index] !== undefined
                      ? userReasoningOverrides[index]
                      : defaultExpanded;

                  return (
                    <ThinkingTrace
                      key={index}
                      text={item.text}
                      isStreaming={item.isStreaming}
                      durationMs={item.durationMs}
                      isExpanded={isExpanded}
                      onToggle={() =>
                        setUserReasoningOverrides((prev) => ({
                          ...prev,
                          [index]: !isExpanded,
                        }))
                      }
                    />
                  );
                }
                case "tool_call":
                  return <ToolCallItem key={index} item={item} />;
                case "todo":
                  return <TodoBlock key={index} item={item} />;
                case "compaction":
                  return <CompactionMarker key={index} item={item} />;
                case "error":
                  return (
                    <div
                      key={index}
                      className="my-3 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2 font-mono"
                    >
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{item.message}</span>
                    </div>
                  );
                default:
                  return null;
              }
            })
          )}

          {/* Pending Permission Requests / Question Prompts */}
          {agentPendingPermissions.map((permission) => (
            <PendingPermissionCard
              key={permission.key}
              permission={permission}
              onRespond={(response) =>
                respondToPermission(permission.agentId, permission.request.id, response)
              }
            />
          ))}
        </div>
      </ScrollArea>

      {/* Scroll to bottom button */}
      {showScrollBottom && (
        <button
          onClick={scrollToBottomSmooth}
          className="absolute bottom-3 right-4 sm:bottom-4 sm:right-8 p-2 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 cursor-pointer transition-all z-20"
          title="Scroll to bottom"
        >
          <ArrowDown className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
