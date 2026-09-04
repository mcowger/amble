import React, { useEffect, useRef } from "react";
import { useWorkspace } from "../../context/WorkspaceContext";
import { usePaseo } from "../../context/PaseoContext";
import { useTheme } from "../../context/ThemeContext";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { encodeTerminalInput, encodeTerminalResize } from "../../lib/paseo/binary-codec";
import { Plus, Terminal as TerminalIcon } from "lucide-react";
import { PressButton } from "../ui/button";
import "@xterm/xterm/css/xterm.css";

const darkTheme = {
  background: "#181816",
  foreground: "#e5e5df",
  cursor: "#f59e0b",
  selectionBackground: "#33332d",
};

const lightTheme = {
  background: "#fdfcfa",
  foreground: "#393a34",
  cursor: "#d97706",
  selectionBackground: "#e8e4dc",
};

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

  const activeTerminal = terminals.find((t) => t.slot === activeTerminalSlot);
  const currentTerminalId = activeTerminal?.id;

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
        theme: isDark ? darkTheme : lightTheme,
      });

      fitAddon = new FitAddon();
      term.loadAddon(fitAddon);
      term.open(containerRef.current);
      term.blur();

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
        const slot =
          (currentTerminalId ? client.getTerminalSlot(currentTerminalId) : undefined) ??
          activeTerminalSlot ??
          0;
        const frame = encodeTerminalInput(slot, data);
        client.sendBinary(frame);
      });
    } catch (err) {
      console.warn("[TerminalDrawer] xterm init error:", err);
    }

    const handleResize = () => {
      try {
        if (
          fitAddon &&
          term &&
          containerRef.current &&
          containerRef.current.clientWidth > 0 &&
          containerRef.current.clientHeight > 0
        ) {
          fitAddon.fit();
          const slot =
            (currentTerminalId ? client.getTerminalSlot(currentTerminalId) : undefined) ??
            activeTerminalSlot ??
            0;
          const frame = encodeTerminalResize(slot, term.cols, term.rows);
          client.sendBinary(frame);
          if (currentTerminalId) {
            client.sendTerminalResize(currentTerminalId, term.cols, term.rows, "claim");
          }
        }
      } catch {
        // ignore
      }
    };

    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });

    resizeObserver.observe(containerRef.current);
    window.addEventListener("resize", handleResize);

    requestAnimationFrame(() => {
      handleResize();
    });

    return () => {
      onDataDisposable?.dispose();
      resizeObserver.disconnect();
      window.removeEventListener("resize", handleResize);
      if (term) {
        term.dispose();
      }
      xtermRef.current = null;
      fitAddonRef.current = null;
    };
  }, [activeTerminalSlot, currentTerminalId, client, drawerOpen]);

  // Dynamically update theme without recreation
  useEffect(() => {
    if (xtermRef.current) {
      xtermRef.current.options.theme = isDark ? darkTheme : lightTheme;
    }
  }, [isDark]);

  // Output stream and restore
  useEffect(() => {
    const slot = activeTerminalSlot ?? 0;
    const idOrSlot = currentTerminalId || slot;
    let isMounted = true;

    const unsub = client.onTerminalOutput(
      idOrSlot,
      (data: string) => {
        if (xtermRef.current && isMounted) {
          xtermRef.current.write(data);
        }
      },
      { replayBuffer: true },
    );

    const existingBuffer = client.getTerminalBuffer(idOrSlot);
    if (!existingBuffer && currentTerminalId) {
      const term = xtermRef.current;
      const size = term ? { cols: term.cols, rows: term.rows } : undefined;
      client
        .subscribeTerminalSession(currentTerminalId, {
          restore: true,
          mode: "full-snapshot",
          scrollbackLines: 500,
          size,
        })
        .catch((err) => {
          console.warn(`[TerminalDrawer] subscribeTerminalSession failed for ${currentTerminalId}:`, err);
        });
    }

    return () => {
      isMounted = false;
      unsub();
    };
  }, [client, activeTerminalSlot, currentTerminalId]);

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
                <PressButton
                  key={t.slot}
                  onPress={() => setActiveTerminalSlot(t.slot)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs cursor-pointer transition-colors ${
                    isActive
                      ? "bg-card text-foreground font-medium shadow-2xs border border-border/50"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  <TerminalIcon className="w-3 h-3 text-amber-500" />
                  <span>{t.title || `Terminal ${t.slot + 1}`}</span>
                </PressButton>
              );
            })
          )}

          <PressButton
            onPress={() => createTerminal()}
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
            title="Open New Terminal"
          >
            <Plus className="w-3.5 h-3.5" />
          </PressButton>
        </div>
      </div>

      {/* Terminal View Container */}
      <div className="flex-1 min-h-0 p-2 bg-background overflow-hidden" ref={containerRef} />
    </div>
  );
}
