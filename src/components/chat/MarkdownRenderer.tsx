import React, { useState, useMemo } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import Prism from "prismjs";
import { Copy, Check } from "lucide-react";
import { clsx } from "clsx";

// Prism language components
import "prismjs/components/prism-bash";
import "prismjs/components/prism-typescript";
import "prismjs/components/prism-jsx";
import "prismjs/components/prism-tsx";
import "prismjs/components/prism-json";
import "prismjs/components/prism-yaml";
import "prismjs/components/prism-python";
import "prismjs/components/prism-markdown";
import "prismjs/components/prism-diff";
import "prismjs/components/prism-sql";
import "prismjs/components/prism-rust";
import "prismjs/components/prism-go";

interface CodeBlockProps {
  code: string;
  language?: string;
  compact?: boolean;
}

export function CodeBlock({ code, language, compact }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const highlightedHtml = useMemo(() => {
    const lang = (language || "").toLowerCase().trim();
    if (lang && Prism.languages[lang]) {
      try {
        return Prism.highlight(code, Prism.languages[lang], lang);
      } catch (err) {
        console.warn("Prism highlight error:", err);
      }
    }
    return null;
  }, [code, language]);

  return (
    <div
      className={clsx(
        "rounded-lg border border-border bg-muted/30 overflow-hidden font-mono",
        compact ? "my-2 text-[11px]" : "my-3 text-xs",
      )}
    >
      <div
        className={clsx(
          "flex items-center justify-between bg-muted/60 border-b border-border/50 text-muted-foreground select-none",
          compact ? "px-2.5 py-1 text-[10px]" : "px-3 py-1.5 text-[11px]",
        )}
      >
        <span className="font-mono uppercase tracking-wider font-semibold">
          {language || "code"}
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 px-1.5 py-0.5 rounded-sm hover:text-foreground hover:bg-accent cursor-pointer transition-colors"
          title="Copy code"
        >
          {copied ? (
            <>
              <Check className="w-3 h-3 text-emerald-500" />
              <span className="text-emerald-500 text-[10px]">Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3 h-3" />
              <span className="text-[10px]">Copy</span>
            </>
          )}
        </button>
      </div>
      <pre
        className={clsx(
          "overflow-x-auto text-foreground font-mono leading-relaxed",
          compact ? "p-2.5 text-[11px]" : "p-3.5 text-xs",
        )}
      >
        {highlightedHtml ? (
          <code dangerouslySetInnerHTML={{ __html: highlightedHtml }} />
        ) : (
          <code>{code}</code>
        )}
      </pre>
    </div>
  );
}

/**
 * Pre-processes markdown to repair edge cases common in streamed LLM outputs:
 * 1. Squished markdown tables where multiple rows are concatenated on one line (`| |`)
 * 2. Missing empty line before a table starting immediately after text
 * 3. Missing empty line after a table preceding normal text
 */
function normalizeMarkdown(content: string): string {
  if (!content || typeof content !== "string") return "";

  // Split by code blocks to avoid mutating anything inside fenced code
  const parts = content.split(/(```[\s\S]*?```)/g);

  return parts
    .map((part, index) => {
      // Odd indices are inside fenced code blocks
      if (index % 2 === 1) return part;

      let text = part;

      // Fix squished markdown table rows concatenated on the same line (| | -> |\n| )
      text = text.replace(/\|\s*\|\s*/g, "|\n| ");

      // Ensure newline before table if preceded by normal text without blank line
      text = text.replace(/([^\n|])\n+(\|[\s\S]*?\|)/g, "$1\n\n$2");

      // Ensure newline after table if followed by normal text without blank line
      text = text.replace(/(\|[^\n]*\|)\n+([^|\n\s])/g, "$1\n\n$2");

      return text;
    })
    .join("");
}

interface MarkdownRendererProps {
  content: string;
  className?: string;
  variant?: "default" | "thought";
}

export function MarkdownRenderer({
  content,
  className,
  variant = "default",
}: MarkdownRendererProps) {
  const normalized = useMemo(() => normalizeMarkdown(content), [content]);
  const isThought = variant === "thought";

  return (
    <div
      className={clsx(
        isThought
          ? "text-xs leading-relaxed text-muted-foreground"
          : "text-sm leading-relaxed text-foreground",
        className,
      )}
    >
      <Markdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        components={{
          table({ children, ...props }) {
            return (
              <div
                className={clsx(
                  "w-full overflow-x-auto rounded-lg border border-border bg-card/40 shadow-2xs",
                  isThought ? "my-2" : "my-3",
                )}
              >
                <table
                  className={clsx(
                    "w-full min-w-full divide-y divide-border text-left border-collapse",
                    isThought ? "text-[11px]" : "text-xs",
                  )}
                  {...props}
                >
                  {children}
                </table>
              </div>
            );
          },
          thead({ children, ...props }) {
            return (
              <thead
                className="bg-muted/70 text-muted-foreground border-b border-border text-[11px] font-semibold uppercase tracking-wider select-none"
                {...props}
              >
                {children}
              </thead>
            );
          },
          tbody({ children, ...props }) {
            return (
              <tbody className="divide-y divide-border/60" {...props}>
                {children}
              </tbody>
            );
          },
          tr({ children, ...props }) {
            return (
              <tr className="hover:bg-muted/20 transition-colors" {...props}>
                {children}
              </tr>
            );
          },
          th({ children, style, ...props }) {
            return (
              <th
                style={style}
                className={clsx(
                  "font-medium text-muted-foreground whitespace-nowrap",
                  isThought ? "px-2.5 py-1.5 text-[10px]" : "px-3.5 py-2",
                )}
                {...props}
              >
                {children}
              </th>
            );
          },
          td({ children, style, ...props }) {
            return (
              <td
                style={style}
                className={clsx(
                  "text-foreground leading-relaxed align-top",
                  isThought ? "px-2.5 py-1.5 text-[11px]" : "px-3.5 py-2.5",
                )}
                {...props}
              >
                {children}
              </td>
            );
          },
          pre({ children, ...props }) {
            const codeChild =
              React.isValidElement(children) &&
              (children.type === "code" ||
                (typeof children.props === "object" &&
                  children.props !== null &&
                  "children" in children.props))
                ? children
                : null;

            if (codeChild) {
              const codeProps = codeChild.props as any;
              const codeClassName = codeProps?.className || "";
              const language = codeClassName.replace(/^language-/, "").trim();
              const codeText = String(codeProps?.children || "").replace(/\n$/, "");
              return <CodeBlock code={codeText} language={language} compact={isThought} />;
            }

            return (
              <pre
                className={clsx(
                  "rounded-lg border border-border bg-muted/40 font-mono overflow-x-auto leading-relaxed text-foreground",
                  isThought ? "my-2 p-2.5 text-[11px]" : "my-3 p-3.5 text-xs",
                )}
                {...props}
              >
                {children}
              </pre>
            );
          },
          code({ className: codeClassName, children, ...props }) {
            if (codeClassName?.startsWith("language-")) {
              const language = codeClassName.replace(/^language-/, "").trim();
              const codeText = String(children || "").replace(/\n$/, "");
              return <CodeBlock code={codeText} language={language} compact={isThought} />;
            }
            return (
              <code
                className={clsx(
                  "font-mono font-medium border",
                  isThought
                    ? "px-1.5 py-0.5 rounded bg-muted/60 text-[11px] text-foreground border-border/30"
                    : "px-1.5 py-0.5 rounded-md bg-muted text-[12px] text-foreground border-border/40",
                )}
                {...props}
              >
                {children}
              </code>
            );
          },
          h1({ children, ...props }) {
            return (
              <h1
                className={clsx(
                  isThought
                    ? "text-sm font-bold text-foreground mt-3 mb-1"
                    : "text-xl font-bold text-foreground mt-5 mb-2",
                  "first:mt-0 leading-tight",
                )}
                {...props}
              >
                {children}
              </h1>
            );
          },
          h2({ children, ...props }) {
            return (
              <h2
                className={clsx(
                  isThought
                    ? "text-xs font-semibold text-foreground mt-2.5 mb-1"
                    : "text-lg font-semibold text-foreground mt-4 mb-2",
                  "first:mt-0 leading-snug",
                )}
                {...props}
              >
                {children}
              </h2>
            );
          },
          h3({ children, ...props }) {
            return (
              <h3
                className={clsx(
                  isThought
                    ? "text-xs font-semibold text-foreground mt-2 mb-1"
                    : "text-base font-semibold text-foreground mt-3 mb-1.5",
                  "first:mt-0 leading-normal",
                )}
                {...props}
              >
                {children}
              </h3>
            );
          },
          h4({ children, ...props }) {
            return (
              <h4
                className={clsx(
                  isThought
                    ? "text-xs font-medium text-foreground mt-1.5 mb-0.5"
                    : "text-sm font-semibold text-foreground mt-2.5 mb-1",
                  "first:mt-0",
                )}
                {...props}
              >
                {children}
              </h4>
            );
          },
          h5({ children, ...props }) {
            return (
              <h5
                className={clsx(
                  isThought
                    ? "text-[10px] text-muted-foreground/80 mt-1 mb-0.5"
                    : "text-xs text-muted-foreground mt-2 mb-1",
                  "font-semibold uppercase tracking-wider first:mt-0",
                )}
                {...props}
              >
                {children}
              </h5>
            );
          },
          h6({ children, ...props }) {
            return (
              <h6
                className={clsx(
                  isThought
                    ? "text-[10px] text-muted-foreground/80 mt-1 mb-0.5"
                    : "text-xs text-muted-foreground mt-2 mb-1",
                  "font-semibold uppercase tracking-wider first:mt-0",
                )}
                {...props}
              >
                {children}
              </h6>
            );
          },
          p({ children, ...props }) {
            return (
              <p
                className={clsx(
                  isThought
                    ? "my-1.5 leading-relaxed text-muted-foreground"
                    : "my-2 leading-relaxed text-foreground",
                  "first:mt-0 last:mb-0",
                )}
                {...props}
              >
                {children}
              </p>
            );
          },
          ul({ className: ulClassName, children, ...props }) {
            const isTaskList = ulClassName?.includes("contains-task-list");
            return (
              <ul
                className={clsx(
                  isThought
                    ? "my-1.5 space-y-0.5 text-xs text-muted-foreground"
                    : "my-2 space-y-1 text-sm text-foreground",
                  isTaskList ? "list-none pl-1" : "list-disc pl-5 marker:text-muted-foreground",
                )}
                {...props}
              >
                {children}
              </ul>
            );
          },
          ol({ children, ...props }) {
            return (
              <ol
                className={clsx(
                  isThought
                    ? "my-1.5 space-y-0.5 text-xs text-muted-foreground"
                    : "my-2 space-y-1 text-sm text-foreground",
                  "list-decimal pl-5 marker:text-muted-foreground",
                )}
                {...props}
              >
                {children}
              </ol>
            );
          },
          li({ className: liClassName, children, ...props }) {
            const isTaskList = liClassName?.includes("task-list-item");
            return (
              <li
                className={clsx(
                  "leading-relaxed",
                  isTaskList && "flex items-start gap-2 list-none",
                )}
                {...props}
              >
                {children}
              </li>
            );
          },
          input({ type, checked, disabled, ...props }) {
            if (type === "checkbox") {
              return (
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={disabled}
                  readOnly
                  className="mt-1 h-3.5 w-3.5 rounded border-border accent-primary cursor-default pointer-events-none"
                  {...props}
                />
              );
            }
            return <input type={type} {...props} />;
          },
          blockquote({ children, ...props }) {
            return (
              <blockquote
                className={clsx(
                  isThought
                    ? "my-2 pl-3 text-xs space-y-0.5 text-muted-foreground/90"
                    : "my-3 pl-3.5 text-sm space-y-1 text-muted-foreground",
                  "border-l-2 border-primary/40 italic",
                )}
                {...props}
              >
                {children}
              </blockquote>
            );
          },
          hr({ ...props }) {
            return (
              <hr
                className={clsx(
                  isThought ? "my-2 border-t border-border/40" : "my-4 border-t border-border",
                )}
                {...props}
              />
            );
          },
          a({ href, children, ...props }) {
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary font-medium underline underline-offset-3 hover:opacity-80 transition-opacity"
                {...props}
              >
                {children}
              </a>
            );
          },
          img({ ...props }) {
            return (
              <img
                className="my-3 max-w-full rounded-lg border border-border object-contain max-h-96"
                loading="lazy"
                {...props}
              />
            );
          },
          strong({ children, ...props }) {
            return (
              <strong className="font-semibold text-foreground" {...props}>
                {children}
              </strong>
            );
          },
          em({ children, ...props }) {
            return (
              <em
                className={clsx("italic", isThought ? "text-muted-foreground/90" : "text-foreground")}
                {...props}
              >
                {children}
              </em>
            );
          },
          del({ children, ...props }) {
            return (
              <del className="line-through text-muted-foreground" {...props}>
                {children}
              </del>
            );
          },
        }}
      >
        {normalized}
      </Markdown>
    </div>
  );
}
