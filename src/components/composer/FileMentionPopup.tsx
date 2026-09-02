import React from "react";
import { FileCode, FileText } from "lucide-react";

interface FileMentionPopupProps {
  filter: string;
  files: string[];
  onSelect: (filePath: string) => void;
}

export function FileMentionPopup({ filter, files, onSelect }: FileMentionPopupProps) {
  const filtered = files
    .filter((f) => f.toLowerCase().includes(filter.toLowerCase()))
    .slice(0, 10);

  if (filtered.length === 0) return null;

  return (
    <div className="absolute left-4 bottom-full mb-2 w-80 rounded-xl bg-card border border-border shadow-2xl p-1.5 z-50 text-xs">
      <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
        Mention File
      </div>
      <div className="max-h-52 overflow-y-auto space-y-0.5">
        {filtered.map((filePath) => (
          <button
            key={filePath}
            type="button"
            onClick={() => onSelect(filePath)}
            className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-left hover:bg-accent cursor-pointer transition-colors"
          >
            <FileCode className="w-3.5 h-3.5 text-primary shrink-0" />
            <span className="font-mono text-foreground truncate text-[11px]">{filePath}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
