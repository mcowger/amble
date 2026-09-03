import React, { useState, useEffect } from "react";
import { usePaseo } from "../../context/PaseoContext";
import { useTheme, type Theme } from "../../context/ThemeContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../ui/dialog";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Button } from "../ui/button";
import { Server, Key, Moon, Sun, Monitor, RefreshCw, CheckCircle2, Sparkles } from "lucide-react";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const {
    serverUrl,
    authToken,
    setServerUrl,
    setAuthToken,
    reconnect,
    connectionState,
    serverInfo,
    client,
  } = usePaseo();
  const { theme, setTheme } = useTheme();

  const [urlInput, setUrlInput] = useState(serverUrl);
  const [tokenInput, setTokenInput] = useState(authToken);
  const [metaProvider, setMetaProvider] = useState("opencode");
  const [metaModel, setMetaModel] = useState("plexus/gemini-3.5-flash-lite");
  const [availableProfiles, setAvailableProfiles] = useState<
    Array<{ id: string; name?: string; provider: string; model: string }>
  >([]);
  const [autoSessionTitles, setAutoSessionTitles] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("amble-auto-session-titles") !== "false";
    }
    return true;
  });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;

    const loadConfig = async () => {
      try {
        const res = await client.getDaemonConfig();
        if (cancelled || !res?.config) return;
        const metaGen = res.config.metadataGeneration;
        if (metaGen?.providers && metaGen.providers.length > 0) {
          const first = metaGen.providers[0];
          if (first.provider) setMetaProvider(first.provider);
          if (first.model) setMetaModel(first.model);
        }
        if (Array.isArray(res.config.agentProfiles)) {
          setAvailableProfiles(res.config.agentProfiles);
        }
      } catch {
        // Fall back gracefully if disconnected
      }
    };

    void loadConfig();
    return () => {
      cancelled = true;
    };
  }, [isOpen, client]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerUrl(urlInput.trim());
    setAuthToken(tokenInput.trim());

    if (typeof window !== "undefined") {
      localStorage.setItem("amble-auto-session-titles", autoSessionTitles ? "true" : "false");
    }

    if (connectionState === "connected" && metaProvider && metaModel) {
      try {
        await client.patchDaemonConfig({
          metadataGeneration: {
            providers: [
              {
                provider: metaProvider.trim(),
                model: metaModel.trim(),
              },
            ],
          },
        });
      } catch (err) {
        console.error("[SettingsModal] Failed to patch metadata config:", err);
      }
    }

    reconnect();
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      onClose();
    }, 600);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Server className="w-5 h-5 text-primary" />
            <span>Settings & Connection</span>
          </DialogTitle>
          <DialogDescription>
            Configure your Paseo daemon connection and client preferences.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSave} className="space-y-4 pt-1">
          {/* Paseo Daemon URL */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Server className="w-3.5 h-3.5" />
              Paseo Daemon Endpoint
            </Label>
            <Input
              type="text"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="/api/paseo/ws"
              className="text-xs font-mono"
            />
            <p className="text-[11px] text-muted-foreground">
              Same-origin proxy (/api/paseo/ws) or direct WebSocket URL to Paseo daemon.
            </p>
          </div>

          {/* Bearer Token */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5" />
              Auth Bearer Token (Optional)
            </Label>
            <Input
              type="password"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              placeholder="paseo_live_..."
              className="text-xs font-mono"
            />
          </div>

          {/* Theme Selector */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Appearance / Theme</Label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setTheme("light")}
                className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-medium border cursor-pointer transition-colors ${
                  theme === "light"
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border hover:bg-accent text-muted-foreground"
                }`}
              >
                <Sun className="w-3.5 h-3.5" />
                Light
              </button>
              <button
                type="button"
                onClick={() => setTheme("dark")}
                className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-medium border cursor-pointer transition-colors ${
                  theme === "dark"
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border hover:bg-accent text-muted-foreground"
                }`}
              >
                <Moon className="w-3.5 h-3.5" />
                Dark
              </button>
              <button
                type="button"
                onClick={() => setTheme("system")}
                className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-medium border cursor-pointer transition-colors ${
                  theme === "system"
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border hover:bg-accent text-muted-foreground"
                }`}
              >
                <Monitor className="w-3.5 h-3.5" />
                System
              </button>
            </div>
          </div>

          {/* Metadata & Title Generation */}
          <div className="space-y-3 pt-2 border-t border-border">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <Label className="text-xs font-semibold text-foreground">
                AI Metadata & Title Generation
              </Label>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Configures Paseo daemon&apos;s metadata generation model for automatic feature, worktree branch, and session titling.
            </p>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-[11px] font-medium text-muted-foreground">Provider</Label>
                <Input
                  type="text"
                  value={metaProvider}
                  onChange={(e) => setMetaProvider(e.target.value)}
                  placeholder="opencode"
                  className="text-xs font-mono"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] font-medium text-muted-foreground">Model</Label>
                <Input
                  type="text"
                  value={metaModel}
                  onChange={(e) => setMetaModel(e.target.value)}
                  placeholder="plexus/gemini-3.5-flash-lite"
                  className="text-xs font-mono"
                />
              </div>
            </div>

            {availableProfiles.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-[10px] text-muted-foreground">Quick pick from daemon profiles:</Label>
                <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto pr-1">
                  {availableProfiles.map((p) => {
                    const isSelected = metaProvider === p.provider && metaModel === p.model;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setMetaProvider(p.provider);
                          setMetaModel(p.model);
                        }}
                        className={`text-[10px] px-2 py-0.5 rounded border transition-colors cursor-pointer truncate max-w-full ${
                          isSelected
                            ? "border-primary bg-primary/10 text-primary font-medium"
                            : "border-border hover:bg-accent text-muted-foreground"
                        }`}
                        title={`${p.provider}: ${p.model}`}
                      >
                        {p.name || p.model}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <label className="flex items-center gap-2 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={autoSessionTitles}
                onChange={(e) => setAutoSessionTitles(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-border text-primary focus:ring-primary accent-primary cursor-pointer"
              />
              <span className="text-xs text-foreground select-none">
                Auto-generate session title on first message
              </span>
            </label>
          </div>

          {/* Connection Status Details */}
          <div className="p-3 rounded-lg bg-muted/40 border border-border/50 text-xs space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Status:</span>
              <span className="font-medium capitalize">{connectionState}</span>
            </div>
            {serverInfo && (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Server ID:</span>
                  <span className="font-mono text-[11px] truncate max-w-[200px]">
                    {serverInfo.serverId || "local"}
                  </span>
                </div>
                {serverInfo.version && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Version:</span>
                    <span className="font-mono text-[11px]">{serverInfo.version}</span>
                  </div>
                )}
              </>
            )}
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              className="gap-1.5 text-xs font-medium"
            >
              {saved ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Saved
                </>
              ) : (
                <>
                  <RefreshCw className="w-3.5 h-3.5" />
                  Save & Connect
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
