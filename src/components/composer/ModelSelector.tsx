import React, { useState, useMemo } from "react";
import { useWorkspace } from "../../context/WorkspaceContext";
import { Popover, PopoverTrigger, PopoverContent } from "../ui/popover";
import { ScrollArea } from "../ui/scroll-area";
import { Input } from "../ui/input";
import { Sparkles, ChevronDown, Check, Brain, Search, Eye } from "lucide-react";
import { formatTokens } from "../../lib/utils";

export function ModelSelector() {
  const { models, selectedModel, setSelectedModel } = useWorkspace();
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const current =
    models.find((m) => m.id === selectedModel) ||
    models.find((m) => m.id.endsWith(`/${selectedModel}`)) || {
      id: selectedModel,
      name: selectedModel.replace(/^plexus\//, ""),
      displayName: selectedModel.replace(/^plexus\//, ""),
      provider: "custom",
      providerName: "Plexus",
    };

  const filteredModels = useMemo(() => {
    if (!searchQuery.trim()) return models;
    const q = searchQuery.toLowerCase();
    return models.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.id.toLowerCase().includes(q) ||
        (m.providerName && m.providerName.toLowerCase().includes(q)) ||
        (m.provider && m.provider.toLowerCase().includes(q)),
    );
  }, [models, searchQuery]);

  const getProviderBadge = (provider: string) => {
    const p = provider.toLowerCase();
    if (p.includes("anthropic") || p.includes("claude")) {
      return { label: "Anthropic", bg: "bg-orange-500/10 text-orange-600 dark:text-orange-400" };
    }
    if (p.includes("openai") || p.includes("gpt") || p.includes("o3")) {
      return { label: "OpenAI", bg: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" };
    }
    if (p.includes("google") || p.includes("gemini")) {
      return { label: "Google", bg: "bg-blue-500/10 text-blue-600 dark:text-blue-400" };
    }
    if (p.includes("deepseek")) {
      return { label: "DeepSeek", bg: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400" };
    }
    if (p.includes("kimi") || p.includes("moonshot")) {
      return { label: "Kimi", bg: "bg-pink-500/10 text-pink-600 dark:text-pink-400" };
    }
    return { label: provider, bg: "bg-purple-500/10 text-purple-600 dark:text-purple-400" };
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex min-w-0 w-[116px] max-[380px]:w-8 max-[380px]:shrink-0 max-[380px]:justify-center max-[380px]:px-1.5 md:w-auto items-center gap-1.5 px-2 py-1 md:px-2.5 rounded-lg text-xs font-medium bg-muted/60 hover:bg-muted text-foreground border border-border/40 cursor-pointer transition-colors"
          title="Select Model"
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          <span className="min-w-0 flex-1 truncate max-[380px]:hidden md:max-w-[140px]">{current.displayName || current.name}</span>
          <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0 max-[380px]:hidden" />
        </button>
      </PopoverTrigger>

      <PopoverContent
        side="top"
        align="start"
        sideOffset={6}
        className="w-80 sm:w-96 p-2"
      >
        {/* Header & Search */}
        <div className="p-1 pb-2 space-y-1.5">
          <div className="flex items-center justify-between px-1">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              Available Models ({models.length})
            </span>
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search models..."
              className="pl-8 h-8 text-xs font-normal"
              autoFocus
            />
          </div>
        </div>

        {/* Model List in Shadcn ScrollArea */}
        <ScrollArea className="max-h-72">
          <div className="space-y-1 pt-1 pr-2">
            {filteredModels.length === 0 ? (
              <div className="p-4 text-center text-xs text-muted-foreground">
                No models found matching "{searchQuery}"
              </div>
            ) : (
              filteredModels.map((model) => {
                const isSelected =
                  model.id === selectedModel ||
                  selectedModel.endsWith(`/${model.id}`) ||
                  model.id.endsWith(`/${selectedModel}`);
                const badge = getProviderBadge(model.providerName || model.provider);

                return (
                  <button
                    key={model.id}
                    type="button"
                    onClick={() => {
                      setSelectedModel(model.id);
                      setIsOpen(false);
                    }}
                    className={`w-full flex items-center justify-between p-2 rounded-lg text-left cursor-pointer transition-colors ${
                      isSelected
                        ? "bg-primary/10 text-primary border border-primary/20 font-medium"
                        : "text-foreground hover:bg-accent border border-transparent"
                    }`}
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold truncate text-foreground">
                          {model.displayName || model.name}
                        </span>
                        {model.reasoningSupported && (
                          <span title="Reasoning supported">
                            <Brain className="w-3 h-3 text-blue-500 shrink-0" />
                          </span>
                        )}
                        {model.supportsVision && (
                          <span title="Vision / Image input supported">
                            <Eye className="w-3 h-3 text-emerald-500 shrink-0" />
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground flex-wrap">
                        <span
                          className={`px-1.5 py-0.2 rounded-xs font-medium uppercase font-mono ${badge.bg}`}
                        >
                          {badge.label}
                        </span>

                        {model.contextWindow && (
                          <span className="font-mono bg-muted/60 px-1 py-0.2 rounded-xs">
                            {formatTokens(model.contextWindow)} ctx
                          </span>
                        )}

                        {model.cost && (
                          <span className="font-mono text-muted-foreground/80">
                            ${model.cost.input}/${model.cost.output}
                          </span>
                        )}
                      </div>
                    </div>

                    {isSelected && <Check className="w-4 h-4 text-primary shrink-0 ml-2" />}
                  </button>
                );
              })
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
