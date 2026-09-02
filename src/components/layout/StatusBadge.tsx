import React from "react";
import { usePaseo } from "../../context/PaseoContext";
import { useWorkspace } from "../../context/WorkspaceContext";
import { cn } from "../../lib/utils";
import { Activity, AlertCircle, CheckCircle2, Loader2, Wifi, WifiOff } from "lucide-react";

export function StatusBadge({ onClick }: { onClick?: () => void }) {
  const { connectionState } = usePaseo();
  const { isTurnRunning } = useWorkspace();

  const getStatusDisplay = () => {
    if (connectionState === "connected") {
      if (isTurnRunning) {
        return {
          label: "Running",
          dotClass: "bg-amber-500 animate-pulse",
          textClass: "text-amber-600 dark:text-amber-400",
          icon: <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-500" />,
        };
      }
      return {
        label: "Ready",
        dotClass: "bg-emerald-500",
        textClass: "text-muted-foreground",
        icon: <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />,
      };
    }

    if (connectionState === "connecting" || connectionState === "reconnecting") {
      return {
        label: connectionState === "connecting" ? "Connecting..." : "Reconnecting...",
        dotClass: "bg-amber-500 animate-pulse",
        textClass: "text-amber-600 dark:text-amber-400",
        icon: <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-500" />,
      };
    }

    if (connectionState === "error") {
      return {
        label: "Offline",
        dotClass: "bg-destructive",
        textClass: "text-destructive",
        icon: <WifiOff className="w-3.5 h-3.5 text-destructive" />,
      };
    }

    return {
      label: "Disconnected",
      dotClass: "bg-muted-foreground",
      textClass: "text-muted-foreground",
      icon: <span className="inline-block w-2 h-2 rounded-full bg-muted-foreground" />,
    };
  };

  const status = getStatusDisplay();

  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium",
        "bg-secondary/60 hover:bg-secondary border border-border/40 transition-colors cursor-pointer",
        status.textClass,
      )}
      title={`Paseo Daemon: ${connectionState}`}
    >
      {status.icon}
      <span>{status.label}</span>
    </button>
  );
}
