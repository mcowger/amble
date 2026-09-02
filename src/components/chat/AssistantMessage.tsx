import React, { useState } from "react";
import { Sparkles, Copy, Check } from "lucide-react";
import { formatTime } from "../../lib/utils";
import type { AssistantMessageTimelineItem } from "../../lib/paseo/types";

export function AssistantMessage({ item }: { item: AssistantMessageTimelineItem }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(item.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  // Basic Markdown Renderer for text, code blocks, lists, bold, inline code
  const renderMarkdown = (content?: string) => {
    if (!content || typeof content !== "string") return null;

    // Split by code fences
    const parts = content.split(/(```[\s\S]*?```)/g);

    return parts.map((part, index) => {
      if (part.startsWith("```") && part.endsWith("```")) {
        const lines = part.slice(3, -3).split("\n");
        const language = lines[0]?.trim() || "";
        const code = lines.slice(1).join("\n");

        return (
          <div key={index} className="my-3 rounded-lg border border-border bg-muted/40 overflow-hidden font-mono text-xs">
            {language && (
              <div className="flex items-center justify-between px-3 py-1.5 bg-muted/60 border-b border-border/50 text-[11px] text-muted-foreground">
                <span>{language}</span>
                <button
                  onClick={() => navigator.clipboard.writeText(code)}
                  className="hover:text-foreground cursor-pointer"
                >
                  Copy
                </button>
              </div>
            )}
            <pre className="p-3 overflow-x-auto text-foreground font-mono leading-relaxed">
              <code>{code}</code>
            </pre>
          </div>
        );
      }

      // Render regular markdown paragraphs & lists
      return (
        <div key={index} className="space-y-2 text-sm leading-relaxed text-foreground">
          {part.split("\n\n").map((para, pIdx) => {
            if (!para.trim()) return null;

            // Bullet list
            if (para.split("\n").every((l) => l.trim().startsWith("- ") || l.trim().startsWith("* "))) {
              return (
                <ul key={pIdx} className="list-disc pl-5 space-y-1 my-2">
                  {para.split("\n").map((line, lIdx) => (
                    <li key={lIdx} dangerouslySetInnerHTML={{ __html: formatInlineMarkdown(line.replace(/^[-*]\s+/, "")) }} />
                  ))}
                </ul>
              );
            }

            // Headings
            if (para.startsWith("### ")) {
              return <h3 key={pIdx} className="text-base font-semibold text-foreground mt-3 mb-1" dangerouslySetInnerHTML={{ __html: formatInlineMarkdown(para.slice(4)) }} />;
            }
            if (para.startsWith("## ")) {
              return <h2 key={pIdx} className="text-lg font-bold text-foreground mt-4 mb-1.5" dangerouslySetInnerHTML={{ __html: formatInlineMarkdown(para.slice(3)) }} />;
            }
            if (para.startsWith("# ")) {
              return <h1 key={pIdx} className="text-xl font-bold text-foreground mt-5 mb-2" dangerouslySetInnerHTML={{ __html: formatInlineMarkdown(para.slice(2)) }} />;
            }

            return (
              <p
                key={pIdx}
                className="my-1.5"
                dangerouslySetInnerHTML={{ __html: formatInlineMarkdown(para) }}
              />
            );
          })}
        </div>
      );
    });
  };

  const formatInlineMarkdown = (text: string): string => {
    return text
      .replace(/`([^`]+)`/g, '<code class="px-1.5 py-0.5 rounded-md bg-muted font-mono text-[12px] text-foreground font-medium">$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong class="font-semibold text-foreground">$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em class="italic">$1</em>');
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
      <div className="pl-7 pr-2">{renderMarkdown(item.text)}</div>
    </div>
  );
}
