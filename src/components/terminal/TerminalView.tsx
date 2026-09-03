import React, { useEffect, useRef } from "react";
import { usePaseo } from "../../context/PaseoContext";
import { useTheme } from "../../context/ThemeContext";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { encodeTerminalInput, encodeTerminalResize } from "../../lib/paseo/binary-codec";
import "@xterm/xterm/css/xterm.css";

interface TerminalViewProps {
  slot: number;
  terminalId: string;
  isActive?: boolean;
}

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

export function TerminalView({ slot, terminalId, isActive = true }: TerminalViewProps) {
  const { client } = usePaseo();
  const { isDark } = useTheme();

  const containerRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  // Initialize xterm instance
  useEffect(() => {
    if (!containerRef.current) return;

    let term: XTerm | null = null;
    let fitAddon: FitAddon | null = null;
    let onDataDisposable: { dispose: () => void } | null = null;

    try {
      term = new XTerm({
        cursorBlink: true,
        fontSize: 13,
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
        theme: isDark ? darkTheme : lightTheme,
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

      term.focus();
      xtermRef.current = term;
      fitAddonRef.current = fitAddon;

      onDataDisposable = term.onData((data) => {
        const currentSlot = client.getTerminalSlot(terminalId) ?? slot;
        const frame = encodeTerminalInput(currentSlot, data);
        client.sendBinary(frame);
      });
    } catch (err) {
      console.warn("[TerminalView] xterm init error:", err);
    }

    const handleResize = () => {
      try {
        if (fitAddon && term && containerRef.current && containerRef.current.clientWidth > 0 && containerRef.current.clientHeight > 0) {
          fitAddon.fit();
          const currentSlot = client.getTerminalSlot(terminalId) ?? slot;
          const frame = encodeTerminalResize(currentSlot, term.cols, term.rows);
          client.sendBinary(frame);
          client.sendTerminalResize(terminalId, term.cols, term.rows, "claim");
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

    // Initial fit after next paint
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
  }, [slot, terminalId, client]);

  // Dynamically update theme on theme change without disposing xterm
  useEffect(() => {
    if (xtermRef.current) {
      xtermRef.current.options.theme = isDark ? darkTheme : lightTheme;
    }
  }, [isDark]);

  // Output stream & restore subscription
  useEffect(() => {
    let isMounted = true;

    // Register listener using terminalId (or slot fallback)
    // replayBuffer: true immediately writes any existing in-memory buffer
    const unsub = client.onTerminalOutput(
      terminalId || slot,
      (data: string) => {
        if (xtermRef.current && isMounted) {
          xtermRef.current.write(data);
        }
      },
      { replayBuffer: true },
    );

    // If no buffer is recorded yet in client, request fresh full-snapshot from daemon
    const existingBuffer = client.getTerminalBuffer(terminalId || slot);
    if (!existingBuffer && terminalId) {
      const term = xtermRef.current;
      const size = term ? { cols: term.cols, rows: term.rows } : undefined;
      client
        .subscribeTerminalSession(terminalId, {
          restore: true,
          mode: "full-snapshot",
          scrollbackLines: 500,
          size,
        })
        .catch((err) => {
          console.warn(`[TerminalView] subscribeTerminalSession failed for ${terminalId}:`, err);
        });
    }

    return () => {
      isMounted = false;
      unsub();
    };
  }, [client, terminalId, slot]);

  // Visibility / activation handling
  useEffect(() => {
    if (!isActive) return;

    const timer = requestAnimationFrame(() => {
      try {
        const term = xtermRef.current;
        const fitAddon = fitAddonRef.current;
        const container = containerRef.current;
        if (fitAddon && term && container && container.clientWidth > 0 && container.clientHeight > 0) {
          fitAddon.fit();
          const currentSlot = client.getTerminalSlot(terminalId) ?? slot;
          const frame = encodeTerminalResize(currentSlot, term.cols, term.rows);
          client.sendBinary(frame);
          client.sendTerminalResize(terminalId, term.cols, term.rows, "claim");
          term.refresh(0, (term.rows || 1) - 1);
        }
        term?.focus();
      } catch {
        // ignore
      }
    });

    return () => cancelAnimationFrame(timer);
  }, [isActive, client, terminalId, slot]);

  return (
    <div
      className="flex-1 w-full h-full min-h-0 bg-background overflow-hidden p-3"
      onClick={() => xtermRef.current?.focus()}
    >
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
}
