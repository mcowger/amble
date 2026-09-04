import React, { useState, useRef, useEffect } from "react";
import { Brain, ChevronDown, ChevronRight, Sparkles, Loader2 } from "lucide-react";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { PressButton } from "../ui/button";

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
      <PressButton
        type="button"
        onPress={handleToggle}
        className="w-full flex items-center justify-between px-3 sm:px-3 py-2.5 sm:py-2 min-h-[44px] sm:min-h-[36px] text-muted-foreground hover:text-foreground hover:bg-muted/40 cursor-pointer select-none transition-colors touch-manipulation"
      >
        <div className="flex items-center gap-2">
          {isStreaming ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-500" />
          ) : (
            <Sparkles className="w-3.5 h-3.5 text-blue-500" />
          )}
          <span className="font-medium">Thought Process</span>
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
      </PressButton>

      {/* Expanded Thought Details */}
      {isExpanded && (
        <div
          ref={contentRef}
          className="p-3 border-t border-border/40 bg-background/50 text-xs text-muted-foreground leading-relaxed max-h-80 overflow-y-auto overflow-x-hidden min-w-0 max-w-full"
        >
          {text ? (
            <MarkdownRenderer content={text} variant="thought" />
          ) : isStreaming ? (
            <div className="flex items-center gap-2 text-muted-foreground italic">
              <Loader2 className="w-3 h-3 animate-spin text-amber-500" />
              <span>Thinking...</span>
            </div>
          ) : (
            <span className="italic text-muted-foreground">No reasoning details available.</span>
          )}
        </div>
      )}
    </div>
  );
}
