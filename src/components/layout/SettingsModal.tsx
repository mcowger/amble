import React, { useState } from "react";
import { usePaseo } from "../../context/PaseoContext";
import { useTheme, type Theme } from "../../context/ThemeContext";
import { X, Server, Key, Moon, Sun, Monitor, RefreshCw, CheckCircle2 } from "lucide-react";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { serverUrl, authToken, setServerUrl, setAuthToken, reconnect, connectionState, serverInfo } = usePaseo();
  const { theme, setTheme } = useTheme();

  const [urlInput, setUrlInput] = useState(serverUrl);
  const [tokenInput, setTokenInput] = useState(authToken);
  const [saved, setSaved] = useState(false);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setServerUrl(urlInput.trim());
    setAuthToken(tokenInput.trim());
    reconnect();
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      onClose();
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
      <div className="relative w-full max-w-md rounded-xl bg-card border border-border shadow-2xl p-6 text-card-foreground">
        <div className="flex items-center justify-between pb-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Server className="w-5 h-5 text-primary" />
            <h2 className="text-base font-semibold">Settings & Connection</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-5 pt-4">
          {/* Paseo Daemon URL */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Server className="w-3.5 h-3.5" />
              Paseo Daemon Endpoint
            </label>
            <input
              type="text"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="ws://127.0.0.1:6767/ws"
              className="w-full px-3 py-2 text-sm rounded-lg bg-background border border-border focus:outline-hidden focus:ring-1 focus:ring-ring"
            />
            <p className="text-[11px] text-muted-foreground">
              Direct WebSocket connection to the local Paseo daemon.
            </p>
          </div>

          {/* Bearer Token */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5" />
              Auth Bearer Token (Optional)
            </label>
            <input
              type="password"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              placeholder="paseo_live_..."
              className="w-full px-3 py-2 text-sm rounded-lg bg-background border border-border focus:outline-hidden focus:ring-1 focus:ring-ring"
            />
          </div>

          {/* Theme Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Appearance / Theme</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setTheme("light")}
                className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-medium border cursor-pointer ${
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
                className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-medium border cursor-pointer ${
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
                className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-medium border cursor-pointer ${
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

          {/* Connection Status Details */}
          <div className="p-3 rounded-lg bg-muted/50 border border-border/50 text-xs space-y-1">
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
                {serverInfo.daemonVersion && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Version:</span>
                    <span className="font-mono text-[11px]">{serverInfo.daemonVersion}</span>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium rounded-lg text-muted-foreground hover:bg-accent cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer shadow-xs"
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
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
