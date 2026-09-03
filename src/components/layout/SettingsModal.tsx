import React, { useState } from "react";
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
import { Server, Key, Moon, Sun, Monitor, RefreshCw, CheckCircle2 } from "lucide-react";

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
  } = usePaseo();
  const { theme, setTheme } = useTheme();

  const [urlInput, setUrlInput] = useState(serverUrl);
  const [tokenInput, setTokenInput] = useState(authToken);
  const [saved, setSaved] = useState(false);

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
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
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
