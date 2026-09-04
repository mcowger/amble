import React, { useState } from "react";
import { Copy, Check, User, ZoomIn, Navigation, Zap, Clock, ChevronDown, ChevronUp } from "lucide-react";
import { formatTime } from "../../lib/utils";
import type { UserMessageTimelineItem, ImageAttachment } from "../../lib/paseo/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { PressButton } from "../ui/button";

export function UserCard({ item }: { item: UserMessageTimelineItem }) {
  const [copied, setCopied] = useState(false);
  const [previewImage, setPreviewImage] = useState<ImageAttachment | null>(null);
  const [isMobileExpanded, setIsMobileExpanded] = useState(false);

  const displayText =
    item.images && item.images.length > 0
      ? item.text.replace(/\n?\[image\]/gi, "").trim()
      : item.text;
  const compactText = displayText.replace(/\s+/g, " ").trim();
  const canExpandMobile = compactText.length > 110 || compactText !== displayText;

  const handleCopy = () => {
    navigator.clipboard.writeText(displayText || item.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="group relative my-2 md:my-4 rounded-xl border border-border/70 bg-card p-3 md:p-4 text-card-foreground shadow-xs">
      {/* Header */}
      <div className="flex items-center justify-between mb-1.5 md:mb-2 select-none">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold">
            <User className="w-3 h-3" />
          </div>
          <span className="text-xs font-semibold text-foreground">You</span>
          {item.activeTurnBehavior === "steer" && (
            <span
              className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
              title="Message injected into ongoing turn"
            >
              <Navigation className="w-2.5 h-2.5" />
              Steered
            </span>
          )}
          {item.activeTurnBehavior === "interrupt" && (
            <span
              className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
              title="Turn interrupted and restarted with this message"
            >
              <Zap className="w-2.5 h-2.5" />
              Interrupted
            </span>
          )}
          {item.activeTurnBehavior === "followup" && (
            <span
              className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20"
              title="Message sent after previous turn finished"
            >
              <Clock className="w-2.5 h-2.5" />
              Follow-up
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {item.timestamp && (
            <span className="text-[11px] text-muted-foreground">
              {formatTime(item.timestamp)}
            </span>
          )}

          <PressButton
            onPress={handleCopy}
            className="md:opacity-0 md:group-hover:opacity-100 p-1 rounded-sm text-muted-foreground hover:text-foreground hover:bg-accent cursor-pointer transition-opacity"
            title="Copy message"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
          </PressButton>
        </div>
      </div>

      {/* Message Text */}
      {displayText ? (
        <>
          <div className="md:hidden flex items-start gap-1.5 min-w-0 max-w-full text-xs leading-5 text-foreground">
            <span
              className={`min-w-0 flex-1 break-words [overflow-wrap:anywhere] ${
                isMobileExpanded ? "whitespace-pre-wrap" : "truncate whitespace-nowrap"
              }`}
            >
              {isMobileExpanded ? displayText : compactText}
            </span>
            {canExpandMobile && (
              <PressButton
                type="button"
                onPress={() => setIsMobileExpanded((expanded) => !expanded)}
                className="inline-flex min-h-8 shrink-0 items-center gap-0.5 rounded-md px-1 text-[11px] font-medium text-primary touch-manipulation"
                aria-expanded={isMobileExpanded}
                aria-label={isMobileExpanded ? "Show less of prompt" : "Show full prompt"}
              >
                <span>{isMobileExpanded ? "Less" : "More"}</span>
                {isMobileExpanded ? (
                  <ChevronUp className="pointer-events-none h-3 w-3" />
                ) : (
                  <ChevronDown className="pointer-events-none h-3 w-3" />
                )}
              </PressButton>
            )}
          </div>
          <div className="hidden md:block text-sm leading-relaxed whitespace-pre-wrap text-foreground break-words [overflow-wrap:anywhere] min-w-0 max-w-full">
            {displayText}
          </div>
        </>
      ) : null}

      {/* Uploaded Images */}
      {item.images && item.images.length > 0 && (
        <div className="flex flex-wrap gap-2 md:gap-3 mt-2 md:mt-3 pt-2.5 border-t border-border/40">
          {item.images.map((img, idx) => (
            <PressButton
              key={idx}
              onPress={() => setPreviewImage(img)}
              className="group/img relative block overflow-hidden rounded-xl border border-border/80 bg-muted/40 text-left hover:border-primary/50 cursor-pointer transition-all shadow-xs"
            >
              <img
                src={`data:${img.mimeType};base64,${img.data}`}
                alt={img.name || `Image attachment ${idx + 1}`}
                className="max-h-24 md:max-h-48 max-w-full md:max-w-xs object-cover rounded-lg group-hover/img:scale-[1.02] transition-transform"
              />
              <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/20 flex items-center justify-center transition-colors">
                <ZoomIn className="w-5 h-5 text-white opacity-0 group-hover/img:opacity-100 transition-opacity drop-shadow-md" />
              </div>
              {img.name && (
                <div className="p-1.5 px-2 bg-card/90 border-t border-border/40 text-[11px] font-mono text-muted-foreground truncate max-w-xs">
                  {img.name}
                </div>
              )}
            </PressButton>
          ))}
        </div>
      )}

      {/* Attachments if any */}
      {item.attachments && item.attachments.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2 pt-2 border-t border-border/40">
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

      {/* Image Preview Modal */}
      {previewImage && (
        <Dialog open={!!previewImage} onOpenChange={(open) => !open && setPreviewImage(null)}>
          <DialogContent className="max-w-3xl p-4 sm:rounded-2xl">
            <DialogHeader className="mb-2">
              <DialogTitle className="text-sm font-semibold truncate">
                {previewImage.name || "Image Preview"}
              </DialogTitle>
            </DialogHeader>
            <div className="flex items-center justify-center max-h-[75vh] overflow-auto rounded-xl bg-muted/30 p-2">
              <img
                src={`data:${previewImage.mimeType};base64,${previewImage.data}`}
                alt={previewImage.name || "Attachment"}
                className="max-h-[70vh] w-auto max-w-full object-contain rounded-lg shadow-md"
              />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
