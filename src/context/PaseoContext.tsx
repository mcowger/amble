import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { PaseoClient } from "../lib/paseo/client";
import type { ConnectionState, ServerInfoPayload } from "../lib/paseo/types";

export function getDefaultPaseoUrl(): string {
  if (typeof window !== "undefined") {
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host || "127.0.0.1:5555";
    return `${proto}//${host}/api/paseo/ws`;
  }
  return "ws://127.0.0.1:5555/api/paseo/ws";
}

const LEGACY_DEFAULT_PATTERNS = [
  /^wss?:\/\/(127\.0\.0\.1|localhost):6767\/ws$/,
];

function getInitialPaseoUrl(): string {
  if (typeof window === "undefined") {
    return getDefaultPaseoUrl();
  }
  const stored = localStorage.getItem("amble-paseo-url");
  if (!stored) {
    return getDefaultPaseoUrl();
  }
  const isLegacyDefault =
    LEGACY_DEFAULT_PATTERNS.some((p) => p.test(stored)) ||
    stored === `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.hostname}:6767/ws`;
  if (isLegacyDefault) {
    const updated = getDefaultPaseoUrl();
    localStorage.setItem("amble-paseo-url", updated);
    return updated;
  }
  return stored;
}

interface PaseoContextType {
  client: PaseoClient;
  connectionState: ConnectionState;
  serverInfo: ServerInfoPayload | null;
  serverUrl: string;
  authToken: string;
  setServerUrl: (url: string) => void;
  setAuthToken: (token: string) => void;
  reconnect: () => void;
}

const PaseoContext = createContext<PaseoContextType | undefined>(undefined);

export function PaseoProvider({ children }: { children: React.ReactNode }) {
  const [serverUrl, setServerUrlState] = useState<string>(() => getInitialPaseoUrl());

  const [authToken, setAuthTokenState] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("amble-paseo-token") || "";
    }
    return "";
  });

  const client = useMemo(() => {
    const c = new PaseoClient({
      url: serverUrl,
      token: authToken || undefined,
    });
    if (typeof window !== "undefined") {
      (window as any).__paseoClient = c;
    }
    return c;
  }, [serverUrl, authToken]);

  const [connectionState, setConnectionState] = useState<ConnectionState>(client.getState());
  const [serverInfo, setServerInfo] = useState<ServerInfoPayload | null>(null);
  const disconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (disconnectTimerRef.current) {
      clearTimeout(disconnectTimerRef.current);
      disconnectTimerRef.current = null;
    }

    const unsubState = client.on("state_change", (state: ConnectionState) => {
      setConnectionState(state);
    });

    const unsubServerInfo = client.on("server_info", (info: ServerInfoPayload) => {
      setServerInfo(info);
    });

    client.connect().catch((err) => {
      console.warn("[PaseoProvider] Initial connection error:", err);
    });

    return () => {
      unsubState();
      unsubServerInfo();
      // Debounce disconnect so React StrictMode's instant remount does not abort an in-flight socket handshake
      disconnectTimerRef.current = setTimeout(() => {
        client.disconnect();
        disconnectTimerRef.current = null;
      }, 150);
    };
  }, [client]);

  const setServerUrl = (url: string) => {
    let resolved = url.trim();
    if (typeof window !== "undefined" && resolved.startsWith("/")) {
      const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
      resolved = `${proto}//${window.location.host}${resolved}`;
    }
    setServerUrlState(resolved);
    client.setUrl(resolved);
    if (typeof window !== "undefined") {
      localStorage.setItem("amble-paseo-url", resolved);
    }
  };

  const setAuthToken = (token: string) => {
    setAuthTokenState(token);
    client.setToken(token);
    if (typeof window !== "undefined") {
      localStorage.setItem("amble-paseo-token", token);
    }
  };

  const reconnect = () => {
    client.connect(true).catch((err) => {
      console.error("[PaseoProvider] Manual reconnect failed:", err);
    });
  };

  return (
    <PaseoContext.Provider
      value={{
        client,
        connectionState,
        serverInfo,
        serverUrl,
        authToken,
        setServerUrl,
        setAuthToken,
        reconnect,
      }}
    >
      {children}
    </PaseoContext.Provider>
  );
}

export function usePaseo() {
  const context = useContext(PaseoContext);
  if (!context) {
    throw new Error("usePaseo must be used within a PaseoProvider");
  }
  return context;
}
