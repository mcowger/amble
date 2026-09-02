import React, { useState, useMemo } from "react";
import { useWorkspace } from "../../context/WorkspaceContext";
import { Sparkles, ChevronDown, Check, Brain, Search, Cpu, Zap } from "lucide-react";
import { formatTokens } from "../../lib/utils";

export function ModelSelector() {
  const { models, selectedModel, setSelectedModel } = useWorkspace();
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const current = models.find((m) => m.id === selectedModel) || {
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
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-muted/60 hover:bg-muted text-foreground border border-border/40 cursor-pointer transition-colors"
        title="Select Model"
      >
        <Sparkles className="w-3.5 h-3.5 text-amber-500" />
        <span className="max-w-[140px] truncate">{current.displayName || current.name}</span>
        <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0" />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute left-0 bottom-full mb-1.5 w-80 sm:w-96 rounded-xl bg-card border border-border shadow-2xl p-2 z-50 text-card-foreground">
            {/* Header & Search */}
            <div className="p-1 pb-2 space-y-1.5">
              <div className="flex items-center justify-between px-1">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Available Models ({models.length})
                </span>
              </div>

              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search models..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg bg-background border border-border focus:outline-hidden focus:ring-1 focus:ring-ring"
                  autoFocus
                />
              </div>
            </div>

            {/* Model List */}
            <div className="max-h-72 overflow-y-auto space-y-1 pt-1">
              {filteredModels.length === 0 ? (
                <div className="p-4 text-center text-xs text-muted-foreground">
                  No models found matching "{searchQuery}"
                </div>
              ) : (
                filteredModels.map((model) => {
                  const isSelected = model.id === selectedModel;
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
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-semibold truncate text-foreground">
                            {model.displayName || model.name}
                          </span>
                          {model.reasoningSupported && (
                            <span title="Reasoning supported">
                              <Brain className="w-3 h-3 text-blue-500 shrink-0" />
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground flex-wrap">
                          <span className={`px-1.5 py-0.2 rounded-xs font-medium uppercase font-mono ${badge.bg}`}>
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
          </div>
        </>
      )}
    </div>
  );
}
