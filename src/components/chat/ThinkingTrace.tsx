import React, { useState, useRef, useEffect } from "react";
import { Brain, ChevronDown, ChevronRight, Sparkles, Loader2 } from "lucide-react";
import { formatDuration } from "../../lib/utils";

interface ThinkingTraceProps {
  text: string;
  isStreaming?: boolean;
  durationMs?: number;
  isExpanded?: boolean;
  onToggle?: () => void;
}

export function ThinkingTrace({
  text,
  isStreaming,
  durationMs,
  isExpanded: controlledExpanded,
  onToggle,
}: ThinkingTraceProps) {
  const [internalExpanded, setInternalExpanded] = useState(false);
  const isExpanded = controlledExpanded !== undefined ? controlledExpanded : internalExpanded;
  const contentRef = useRef<HTMLDivElement>(null);

  const handleToggle = () => {
    if (onToggle) {
      onToggle();
    } else {
      setInternalExpanded(!internalExpanded);
    }
  };

  // Auto-scroll thought details to bottom as new tokens arrive while streaming & expanded
  useEffect(() => {
    if (isStreaming && isExpanded && contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [text, isStreaming, isExpanded]);

  return (
    <div className="my-2.5 rounded-lg border border-border/60 bg-muted/20 overflow-hidden text-xs">
      {/* Header */}
      <button
        onClick={handleToggle}
        className="w-full flex items-center justify-between px-3 py-2 text-muted-foreground hover:text-foreground hover:bg-muted/40 cursor-pointer select-none transition-colors"
      >
        <div className="flex items-center gap-2">
          {isStreaming ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-500" />
          ) : (
            <Sparkles className="w-3.5 h-3.5 text-blue-500" />
          )}
          <span className="font-medium">
            {isStreaming
              ? "Thinking..."
              : durationMs
              ? `Thought for ${formatDuration(durationMs)}`
              : "Thought Process"}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-muted-foreground/60">
            {isExpanded ? "Hide" : "Show"}
          </span>
          {isExpanded ? (
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
          )}
        </div>
      </button>

      {/* Expanded Thought Details */}
      {isExpanded && (
        <div
          ref={contentRef}
          className="p-3 border-t border-border/40 bg-background/50 font-mono text-[11px] text-muted-foreground leading-relaxed whitespace-pre-wrap max-h-80 overflow-y-auto"
        >
          {text || (isStreaming ? "Thinking..." : "No reasoning details available.")}
        </div>
      )}
    </div>
  );
}
