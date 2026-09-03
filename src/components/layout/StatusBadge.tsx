import React from "react";
import { usePaseo } from "../../context/PaseoContext";
import { cn } from "../../lib/utils";

export function StatusBadge({ onClick }: { onClick?: () => void }) {
  const { connectionState } = usePaseo();
  const isConnected = connectionState === "connected";

  return (
    <button
      onClick={onClick}
      className={cn(
        "h-6 w-6 sm:h-auto sm:w-auto p-1 sm:px-2.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-medium",
        "flex items-center justify-center sm:inline-flex sm:gap-1.5",
        "bg-secondary/60 hover:bg-secondary border border-border/40 transition-colors cursor-pointer text-muted-foreground shrink-0",
      )}
      title={`Paseo Daemon: ${connectionState} (${isConnected ? "Ready" : "Disconnected"})`}
      aria-label={`Paseo Daemon: ${isConnected ? "Ready" : "Disconnected"}`}
    >
      <span
        className={cn(
          "inline-block w-2 h-2 rounded-full shrink-0",
          isConnected ? "bg-emerald-500" : "bg-destructive",
        )}
      />
      <span className="hidden sm:inline">{isConnected ? "Ready" : "Disconnected"}</span>
    </button>
  );
}
