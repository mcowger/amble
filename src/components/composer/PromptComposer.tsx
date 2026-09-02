import React, { useState, useRef, useEffect } from "react";
import { useWorkspace } from "../../context/WorkspaceContext";
import { ModelSelector } from "./ModelSelector";
import { EffortSelector } from "./EffortSelector";
import { SlashCommands, type SlashCommandItem } from "./SlashCommands";
import { FileMentionPopup } from "./FileMentionPopup";
import {
  ArrowUp,
  Square,
  Paperclip,
  Hammer,
  Brain,
  HelpCircle,
  Terminal,
  Eraser,
  RotateCcw,
  GitCommit,
  Layers,
  Sparkles,
} from "lucide-react";

export function PromptComposer({ initialValue = "" }: { initialValue?: string }) {
  const {
    sendMessage,
    isTurnRunning,
    cancelTurn,
    modes,
    selectedMode,
    setSelectedMode,
    toggleDrawer,
    refreshTimeline,
    gitStatus,
  } = useWorkspace();

  const [prompt, setPrompt] = useState(initialValue);
  const [slashFilter, setSlashFilter] = useState<string | null>(null);
  const [mentionFilter, setMentionFilter] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (initialValue) {
      setPrompt(initialValue);
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
    }
  }, [initialValue]);

  // Autosize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(
        textareaRef.current.scrollHeight,
        220,
      )}px`;
    }
  }, [prompt]);

  const handleSend = async () => {
    const trimmed = prompt.trim();
    if (!trimmed || isTurnRunning) return;
    setPrompt("");
    setSlashFilter(null);
    setMentionFilter(null);
    try {
      await sendMessage(trimmed);
    } catch (err) {
      console.error("[PromptComposer] Send failed:", err);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    } else if (e.key === "Escape") {
      setSlashFilter(null);
      setMentionFilter(null);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setPrompt(val);

    // Check for slash command trigger
    const cursor = e.target.selectionStart || val.length;
    const textBeforeCursor = val.slice(0, cursor);
    const slashMatch = textBeforeCursor.match(/(?:^|\n)\/([a-zA-Z0-9_-]*)$/);
    if (slashMatch) {
      setSlashFilter(slashMatch[1] ?? "");
    } else {
      setSlashFilter(null);
    }

    // Check for file mention trigger
    const mentionMatch = textBeforeCursor.match(/@([a-zA-Z0-9_./-]*)$/);
    if (mentionMatch) {
      setMentionFilter(mentionMatch[1] ?? "");
    } else {
      setMentionFilter(null);
    }
  };

  const slashCommands: SlashCommandItem[] = [
    {
      name: "terminal",
      description: "Open integrated terminal drawer",
      icon: <Terminal className="w-3.5 h-3.5 text-amber-500" />,
      action: () => {
        toggleDrawer("terminal");
        setPrompt("");
        setSlashFilter(null);
      },
    },
    {
      name: "git",
      description: "Open git changes and diff inspector",
      icon: <GitCommit className="w-3.5 h-3.5 text-blue-500" />,
      action: () => {
        toggleDrawer("changes");
        setPrompt("");
        setSlashFilter(null);
      },
    },
    {
      name: "clear",
      description: "Refresh and reset session view",
      icon: <Eraser className="w-3.5 h-3.5 text-rose-500" />,
      action: () => {
        refreshTimeline();
        setPrompt("");
        setSlashFilter(null);
      },
    },
    {
      name: "plan",
      description: "Switch agent mode to Plan",
      icon: <Brain className="w-3.5 h-3.5 text-purple-500" />,
      action: () => {
        setSelectedMode("plan");
        setPrompt("");
        setSlashFilter(null);
      },
    },
    {
      name: "build",
      description: "Switch agent mode to Build",
      icon: <Hammer className="w-3.5 h-3.5 text-emerald-500" />,
      action: () => {
        setSelectedMode("build");
        setPrompt("");
        setSlashFilter(null);
      },
    },
  ];

  const handleSlashSelect = (cmd: SlashCommandItem) => {
    cmd.action();
  };

  const sampleFiles = [
    ...(gitStatus?.stagedFiles.map((f) => f.path) || []),
    ...(gitStatus?.unstagedFiles.map((f) => f.path) || []),
    "package.json",
    "src/index.ts",
    "src/App.tsx",
    "src/frontend.tsx",
    "docs/PLAN.md",
  ];

  const handleMentionSelect = (filePath: string) => {
    if (textareaRef.current) {
      const cursor = textareaRef.current.selectionStart || prompt.length;
      const textBeforeCursor = prompt.slice(0, cursor).replace(/@[a-zA-Z0-9_./-]*$/, `@${filePath} `);
      const textAfterCursor = prompt.slice(cursor);
      setPrompt(`${textBeforeCursor}${textAfterCursor}`);
      setMentionFilter(null);
    }
  };

  const getModeIcon = (modeId: string) => {
    switch (modeId) {
      case "plan":
        return <Brain className="w-3 h-3 text-purple-500" />;
      case "ask":
        return <HelpCircle className="w-3 h-3 text-blue-500" />;
      default:
        return <Hammer className="w-3 h-3 text-emerald-500" />;
    }
  };

  return (
    <div className="relative max-w-4xl w-full mx-auto p-4 pt-0">
      {/* Popups */}
      {slashFilter !== null && (
        <SlashCommands
          filter={slashFilter}
          onSelect={handleSlashSelect}
          commands={slashCommands}
        />
      )}

      {mentionFilter !== null && (
        <FileMentionPopup
          filter={mentionFilter}
          files={sampleFiles}
          onSelect={handleMentionSelect}
        />
      )}

      {/* Main Composer Box */}
      <div className="rounded-2xl border border-border bg-card shadow-lg p-3 space-y-2 text-card-foreground">
        {/* Text Input Area */}
        <textarea
          ref={textareaRef}
          value={prompt}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder="Ask Paseo to write code, debug issues, or execute commands... (type / for commands, @ for files)"
          rows={2}
          className="w-full resize-none bg-transparent border-0 p-1 text-base sm:text-sm text-foreground placeholder:text-muted-foreground focus:outline-hidden leading-relaxed max-h-56 touch-manipulation"
        />

        {/* Controls Row */}
        <div className="flex items-center justify-between pt-1 border-t border-border/40 select-none">
          {/* Left: Mode selector & Model / Effort */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Mode Pills */}
            <div className="flex items-center gap-0.5 bg-muted/60 p-0.5 rounded-lg border border-border/30">
              {modes.map((m) => {
                const isActive = m.id === selectedMode;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setSelectedMode(m.id)}
                    className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium cursor-pointer transition-colors ${
                      isActive
                        ? "bg-background text-foreground shadow-2xs font-semibold"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                    title={m.description}
                  >
                    {getModeIcon(m.id)}
                    <span className="capitalize">{m.name}</span>
                  </button>
                );
              })}
            </div>

            {/* Model & Effort */}
            <ModelSelector />
            <EffortSelector />
          </div>

          {/* Right: Submit / Interrupt Action */}
          <div className="flex items-center gap-2">
            {isTurnRunning ? (
              <button
                type="button"
                onClick={cancelTurn}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-destructive text-destructive-foreground hover:bg-destructive/90 cursor-pointer shadow-xs transition-colors"
                title="Interrupt Agent Execution"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>Stop</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSend}
                disabled={!prompt.trim()}
                className={`p-2 rounded-xl text-xs font-medium cursor-pointer transition-all shadow-xs ${
                  prompt.trim()
                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                    : "bg-muted text-muted-foreground opacity-50 cursor-not-allowed"
                }`}
                title="Send Message (Enter)"
              >
                <ArrowUp className="w-4 h-4 stroke-[2.5]" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
