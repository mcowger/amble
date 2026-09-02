import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { PaseoClient } from "../lib/paseo/client";
import type { ConnectionState, ServerInfoPayload } from "../lib/paseo/types";

export function getDefaultPaseoUrl(): string {
  if (typeof window !== "undefined") {
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.hostname || "127.0.0.1";
    return `${proto}//${host}:6767/ws`;
  }
  return "ws://127.0.0.1:6767/ws";
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
  const [serverUrl, setServerUrlState] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("amble-paseo-url") || getDefaultPaseoUrl();
    }
    return "ws://127.0.0.1:6767/ws";
  });

  const [authToken, setAuthTokenState] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("amble-paseo-token") || "";
    }
    return "";
  });

  const client = useMemo(() => {
    return new PaseoClient({
      url: serverUrl,
      token: authToken || undefined,
    });
  }, [serverUrl, authToken]);

  const [connectionState, setConnectionState] = useState<ConnectionState>(client.getState());
  const [serverInfo, setServerInfo] = useState<ServerInfoPayload | null>(null);

  useEffect(() => {
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
      client.disconnect();
    };
  }, [client]);

  const setServerUrl = (url: string) => {
    setServerUrlState(url);
    if (typeof window !== "undefined") {
      localStorage.setItem("amble-paseo-url", url);
    }
  };

  const setAuthToken = (token: string) => {
    setAuthTokenState(token);
    if (typeof window !== "undefined") {
      localStorage.setItem("amble-paseo-token", token);
    }
  };

  const reconnect = () => {
    client.connect().catch((err) => {
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
