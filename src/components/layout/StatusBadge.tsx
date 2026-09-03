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
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium",
        "bg-secondary/60 hover:bg-secondary border border-border/40 transition-colors cursor-pointer text-muted-foreground",
      )}
      title={`Paseo Daemon: ${connectionState}`}
    >
      <span
        className={cn(
          "inline-block w-2 h-2 rounded-full",
          isConnected ? "bg-emerald-500" : "bg-muted-foreground",
        )}
      />
      <span>{isConnected ? "Ready" : "Disconnected"}</span>
    </button>
  );
}
