import React, { useState } from "react";
import { useWorkspace } from "../../context/WorkspaceContext";
import { Popover, PopoverTrigger, PopoverContent } from "../ui/popover";
import { Brain, ChevronDown, Check } from "lucide-react";

export function EffortSelector() {
  const { models, selectedModel, thinkingEffort, setThinkingEffort } = useWorkspace();
  const [isOpen, setIsOpen] = useState(false);

  const activeModel =
    models.find((m) => m.id === selectedModel) ||
    models.find((m) => m.id.endsWith(`/${selectedModel}`));

  const options =
    activeModel?.thinkingOptions && activeModel.thinkingOptions.length > 0
      ? activeModel.thinkingOptions
      : [
          { id: "off", label: "Off" },
          { id: "low", label: "Low" },
          { id: "medium", label: "Medium" },
          { id: "high", label: "High" },
          { id: "max", label: "Max" },
        ];

  const currentOption = options.find((o) => o.id === thinkingEffort) || options[0]!;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="h-8 sm:h-7 flex shrink-0 items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 rounded-lg text-xs font-medium bg-muted/60 hover:bg-muted text-foreground border border-border/40 cursor-pointer transition-colors touch-manipulation"
          title={`Reasoning Effort: ${currentOption.label}`}
          aria-label={`Reasoning Effort: ${currentOption.label}`}
        >
          <Brain className="w-3.5 h-3.5 text-blue-500 shrink-0" />
          <span className="hidden sm:inline min-w-0 truncate capitalize">{currentOption.label}</span>
          <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0" />
        </button>
      </PopoverTrigger>

      <PopoverContent
        side="top"
        align="start"
        sideOffset={6}
        className="w-48 p-1.5"
      >
        <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
          Thinking Effort
        </div>
        <div className="space-y-0.5">
          {options.map((opt) => {
            const isSelected = opt.id === thinkingEffort;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  setThinkingEffort(opt.id);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs cursor-pointer text-left transition-colors ${
                  isSelected
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-foreground hover:bg-accent"
                }`}
              >
                <div className="capitalize font-medium">{opt.label}</div>
                {isSelected && <Check className="w-3.5 h-3.5 text-primary shrink-0 ml-2" />}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
