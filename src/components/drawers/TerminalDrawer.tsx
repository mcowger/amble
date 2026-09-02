import React, { useEffect, useRef } from "react";
import { useWorkspace } from "../../context/WorkspaceContext";
import { usePaseo } from "../../context/PaseoContext";
import { useTheme } from "../../context/ThemeContext";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { encodeTerminalInput, encodeTerminalResize } from "../../lib/paseo/binary-codec";
import { Plus, Terminal as TerminalIcon } from "lucide-react";
import "@xterm/xterm/css/xterm.css";

export function TerminalDrawer() {
  const { client } = usePaseo();
  const {
    terminals,
    activeTerminalSlot,
    setActiveTerminalSlot,
    createTerminal,
    drawerOpen,
  } = useWorkspace();
  const { isDark } = useTheme();

  const containerRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  useEffect(() => {
    if (!containerRef.current || !drawerOpen) return;

    let term: XTerm | null = null;
    let fitAddon: FitAddon | null = null;
    let onDataDisposable: { dispose: () => void } | null = null;

    try {
      term = new XTerm({
        cursorBlink: true,
        fontSize: 12,
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
        theme: isDark
          ? {
              background: "#181816",
              foreground: "#e5e5df",
              cursor: "#f59e0b",
              selectionBackground: "#33332d",
            }
          : {
              background: "#fdfcfa",
              foreground: "#393a34",
              cursor: "#d97706",
              selectionBackground: "#e8e4dc",
            },
      });

      fitAddon = new FitAddon();
      term.loadAddon(fitAddon);
      term.open(containerRef.current);

      try {
        if (containerRef.current.clientWidth > 0 && containerRef.current.clientHeight > 0) {
          fitAddon.fit();
        }
      } catch {
        // ignore dimension errors on hidden/transitioning tabs
      }

      xtermRef.current = term;
      fitAddonRef.current = fitAddon;

      onDataDisposable = term.onData((data) => {
        const slot = activeTerminalSlot ?? 0;
        const frame = encodeTerminalInput(slot, data);
        client.sendBinary(frame);
      });
    } catch (err) {
      console.warn("[TerminalDrawer] xterm init error:", err);
    }

    const handleResize = () => {
      try {
        if (fitAddon && term && containerRef.current && containerRef.current.clientWidth > 0) {
          fitAddon.fit();
          const slot = activeTerminalSlot ?? 0;
          const frame = encodeTerminalResize(slot, term.cols, term.rows);
          client.sendBinary(frame);
        }
      } catch {
        // ignore
      }
    };

    window.addEventListener("resize", handleResize);

    return () => {
      onDataDisposable?.dispose();
      window.removeEventListener("resize", handleResize);
      if (term) {
        term.dispose();
      }
      xtermRef.current = null;
      fitAddonRef.current = null;
    };
  }, [isDark, activeTerminalSlot, client, drawerOpen]);

  useEffect(() => {
    const slot = activeTerminalSlot ?? 0;
    const unsub = client.onTerminalOutput(slot, (data: string) => {
      if (xtermRef.current) {
        xtermRef.current.write(data);
      }
    });

    return () => {
      unsub();
    };
  }, [client, activeTerminalSlot]);

  return (
    <div className="flex flex-col h-full bg-background select-none">
      {/* Tab bar for multiple terminals */}
      <div className="h-8 bg-muted/40 border-b border-border px-3 flex items-center justify-between text-xs">
        <div className="flex items-center gap-1 overflow-x-auto">
          {terminals.length === 0 ? (
            <div className="flex items-center gap-1.5 text-muted-foreground px-2 py-0.5">
              <TerminalIcon className="w-3.5 h-3.5" />
              <span>Terminal 1</span>
            </div>
          ) : (
            terminals.map((t) => {
              const isActive = t.slot === activeTerminalSlot;
              return (
                <button
                  key={t.slot}
                  onClick={() => setActiveTerminalSlot(t.slot)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs cursor-pointer transition-colors ${
                    isActive
                      ? "bg-card text-foreground font-medium shadow-2xs border border-border/50"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  <TerminalIcon className="w-3 h-3 text-amber-500" />
                  <span>{t.title || `Terminal ${t.slot + 1}`}</span>
                </button>
              );
            })
          )}

          <button
            onClick={() => createTerminal()}
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
            title="Open New Terminal"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Terminal View Container */}
      <div className="flex-1 min-h-0 p-2 bg-background overflow-hidden" ref={containerRef} />
    </div>
  );
}
