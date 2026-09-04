import React, { useEffect, useRef } from "react";
import { Terminal, Eraser, GitCommit, Layers, Sparkles, FileText, Search } from "lucide-react";
import { PressButton } from "../ui/button";

export interface SlashCommandItem {
  name: string;
  description: string;
  argumentHint?: string;
  kind?: "command" | "skill" | "mode" | "action";
  icon?: React.ReactNode;
  action: () => void;
}

interface SlashCommandsProps {
  filter: string;
  onSelect: (command: SlashCommandItem) => void;
  commands: SlashCommandItem[];
  selectedIndex?: number;
}

export function SlashCommands({
  filter,
  onSelect,
  commands,
  selectedIndex = 0,
}: SlashCommandsProps) {
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = commands.filter(
    (c) =>
      c.name.toLowerCase().includes(filter.toLowerCase()) ||
      c.description.toLowerCase().includes(filter.toLowerCase()),
  );

  useEffect(() => {
    if (!listRef.current) return;
    const activeEl = listRef.current.children[selectedIndex] as HTMLElement | undefined;
    if (activeEl) {
      activeEl.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  if (filtered.length === 0) return null;

  return (
    <div className="absolute left-2 sm:left-4 bottom-full mb-2 w-80 sm:w-96 max-w-[calc(100vw-2rem)] rounded-xl bg-card border border-border shadow-2xl p-1.5 z-50 text-xs select-none">
      <div className="flex items-center justify-between px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider border-b border-border/40 mb-1">
        <span>Slash Commands</span>
        <span>{filtered.length} available</span>
      </div>
      <div ref={listRef} className="max-h-60 overflow-y-auto space-y-0.5">
        {filtered.map((cmd, idx) => {
          const isSelected = idx === selectedIndex;
          return (
            <PressButton
              key={cmd.name}
              type="button"
              onPress={() => onSelect(cmd)}
              className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-left cursor-pointer transition-colors ${
                isSelected
                  ? "bg-accent text-accent-foreground shadow-2xs"
                  : "hover:bg-accent/60 text-foreground"
              }`}
            >
              <div className="p-1 rounded-md bg-muted text-foreground shrink-0">
                {cmd.icon || <Terminal className="w-3.5 h-3.5 text-primary" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-semibold font-mono text-foreground">
                    /{cmd.name}
                  </span>
                  {cmd.argumentHint && (
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {cmd.argumentHint}
                    </span>
                  )}
                  {cmd.kind === "skill" && (
                    <span className="px-1 py-0.2 rounded text-[9px] font-semibold uppercase bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                      Skill
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-muted-foreground truncate">
                  {cmd.description}
                </div>
              </div>
            </PressButton>
          );
        })}
      </div>
    </div>
  );
}
