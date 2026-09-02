import React from "react";
import { Terminal, Eraser, RotateCcw, HelpCircle, GitCommit, Layers, Sparkles } from "lucide-react";

export interface SlashCommandItem {
  name: string;
  description: string;
  icon: React.ReactNode;
  action: () => void;
}

interface SlashCommandsProps {
  filter: string;
  onSelect: (command: SlashCommandItem) => void;
  commands: SlashCommandItem[];
}

export function SlashCommands({ filter, onSelect, commands }: SlashCommandsProps) {
  const filtered = commands.filter(
    (c) =>
      c.name.toLowerCase().includes(filter.toLowerCase()) ||
      c.description.toLowerCase().includes(filter.toLowerCase()),
  );

  if (filtered.length === 0) return null;

  return (
    <div className="absolute left-4 bottom-full mb-2 w-72 rounded-xl bg-card border border-border shadow-2xl p-1.5 z-50 text-xs">
      <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
        Slash Commands
      </div>
      <div className="max-h-52 overflow-y-auto space-y-0.5">
        {filtered.map((cmd) => (
          <button
            key={cmd.name}
            type="button"
            onClick={() => onSelect(cmd)}
            className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-left hover:bg-accent cursor-pointer transition-colors"
          >
            <div className="p-1 rounded-md bg-muted text-foreground shrink-0">{cmd.icon}</div>
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-foreground font-mono">/{cmd.name}</div>
              <div className="text-[11px] text-muted-foreground truncate">{cmd.description}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
