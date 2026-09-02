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
}

export function TerminalView({ slot }: TerminalViewProps) {
  const { client } = usePaseo();
  const { isDark } = useTheme();

  const containerRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

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

      term.focus();
      xtermRef.current = term;
      fitAddonRef.current = fitAddon;

      onDataDisposable = term.onData((data) => {
        const frame = encodeTerminalInput(slot, data);
        client.sendBinary(frame);
      });
    } catch (err) {
      console.warn("[TerminalView] xterm init error:", err);
    }

    const handleResize = () => {
      try {
        if (fitAddon && term && containerRef.current && containerRef.current.clientWidth > 0) {
          fitAddon.fit();
          const frame = encodeTerminalResize(slot, term.cols, term.rows);
          client.sendBinary(frame);
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
  }, [isDark, slot, client]);

  // Output stream
  useEffect(() => {
    const unsub = client.onTerminalOutput(slot, (data: string) => {
      if (xtermRef.current) {
        xtermRef.current.write(data);
      }
    });

    return () => {
      unsub();
    };
  }, [client, slot]);

  return (
    <div
      className="flex-1 w-full h-full min-h-0 bg-background overflow-hidden p-3"
      onClick={() => xtermRef.current?.focus()}
    >
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
}
