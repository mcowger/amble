import React, { useState } from "react";
import { Sparkles, Copy, Check } from "lucide-react";
import { formatTime } from "../../lib/utils";
import { MarkdownRenderer } from "./MarkdownRenderer";
import type { AssistantMessageTimelineItem } from "../../lib/paseo/types";

export function AssistantMessage({ item }: { item: AssistantMessageTimelineItem }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(item.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="group relative my-3 px-1">
      {/* Header */}
      <div className="flex items-center justify-between mb-1.5 select-none">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold">
            <Sparkles className="w-3 h-3 text-amber-500" />
          </div>
          <span className="text-xs font-semibold text-foreground">Paseo</span>
          {item.model && (
            <span className="text-[10px] text-muted-foreground font-mono bg-muted/60 px-1.5 py-0.2 rounded-sm">
              {item.model}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {item.timestamp && (
            <span className="text-[11px] text-muted-foreground">
              {formatTime(item.timestamp)}
            </span>
          )}

          <button
            onClick={handleCopy}
            className="opacity-0 group-hover:opacity-100 p-1 rounded-sm text-muted-foreground hover:text-foreground hover:bg-accent cursor-pointer transition-opacity"
            title="Copy message"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
          </button>
        </div>
      </div>

      {/* Markdown Content */}
      <div className="pl-7 pr-2">
        <MarkdownRenderer content={item.text} />
      </div>
    </div>
  );
}
