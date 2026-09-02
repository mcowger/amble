import React, { useState } from "react";
import { Copy, Check, User } from "lucide-react";
import { formatTime } from "../../lib/utils";
import type { UserMessageTimelineItem } from "../../lib/paseo/types";

export function UserCard({ item }: { item: UserMessageTimelineItem }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(item.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="group relative my-4 rounded-xl border border-border/70 bg-card p-4 text-card-foreground shadow-xs">
      {/* Header */}
      <div className="flex items-center justify-between mb-2 select-none">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold">
            <User className="w-3 h-3" />
          </div>
          <span className="text-xs font-semibold text-foreground">You</span>
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

      {/* Message Text */}
      <div className="text-sm leading-relaxed whitespace-pre-wrap text-foreground">
        {item.text}
      </div>

      {/* Attachments if any */}
      {item.attachments && item.attachments.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2.5 pt-2 border-t border-border/40">
          {item.attachments.map((att, idx) => (
            <span
              key={idx}
              className="px-2 py-0.5 rounded-md bg-muted text-muted-foreground text-[11px] font-mono"
            >
              {att}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
