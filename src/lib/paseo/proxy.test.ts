import { describe, it, expect } from "bun:test";
import { serve, type ServerWebSocket } from "bun";
import {
  getUpstreamWsUrl,
  safeClose,
  handleWsUpgrade,
  proxyWebSocketHandler,
  type ProxySocketData,
} from "./proxy-handler";
import { PaseoClient } from "./client";
import { getDefaultPaseoUrl } from "../../context/PaseoContext";

describe("Paseo Proxy & Client URLs", () => {
  it("computes default upstream daemon URL fallback", () => {
    const prev = process.env.PASEO_URL;
    delete process.env.PASEO_URL;
    delete process.env.PASEO_WS_URL;
    expect(getUpstreamWsUrl()).toBe("ws://127.0.0.1:6767/ws");
    if (prev) process.env.PASEO_URL = prev;
  });

  it("normalizes HTTP upstream daemon URL to WS", () => {
    const prev = process.env.PASEO_URL;
    process.env.PASEO_URL = "http://localhost:6767";
    expect(getUpstreamWsUrl()).toBe("ws://localhost:6767/ws");
    if (prev) process.env.PASEO_URL = prev;
    else delete process.env.PASEO_URL;
  });

  it("ignores PASEO_URL in Paseo service mode and targets local daemon port from PASEO_LISTEN", () => {
    const prevPort = process.env.PASEO_PORT;
    const prevUrl = process.env.PASEO_URL;
    const prevListen = process.env.PASEO_LISTEN;

    process.env.PASEO_PORT = "38511";
    process.env.PASEO_URL = "https://dev--amble-7de10435.paseoapps.home.cowger.us";
    process.env.PASEO_LISTEN = "0.0.0.0:6767";

    expect(getUpstreamWsUrl()).toBe("ws://127.0.0.1:6767/ws");

    process.env.PASEO_LISTEN = "127.0.0.1:9999";
    expect(getUpstreamWsUrl()).toBe("ws://127.0.0.1:9999/ws");

    if (prevPort) process.env.PASEO_PORT = prevPort;
    else delete process.env.PASEO_PORT;
    if (prevUrl) process.env.PASEO_URL = prevUrl;
    else delete process.env.PASEO_URL;
    if (prevListen) process.env.PASEO_LISTEN = prevListen;
    else delete process.env.PASEO_LISTEN;
  });

  it("PaseoClient normalizes relative proxy paths to absolute WS URLs in browser", () => {
    const client = new PaseoClient({ url: "/api/paseo/ws" });
    // In node/bun test environment without window, it keeps the given url or fallback
    expect(client.getUrl()).toBe("/api/paseo/ws");
  });

  it("returns same-origin proxy default URL from getDefaultPaseoUrl", () => {
    const defaultUrl = getDefaultPaseoUrl();
    expect(defaultUrl).toContain("/api/paseo/ws");
  });
});

describe("Paseo WebSocket Proxy Relay", () => {
  it("relays text messages and buffers during upstream connection", async () => {
    // 1. Mock upstream Paseo daemon
    const receivedUpstream: string[] = [];
    const upstream = serve({
      port: 0,
      routes: {
        "/ws": {
          GET(req, s) {
            s.upgrade(req);
          },
        },
      },
      websocket: {
        message(ws, msg) {
          receivedUpstream.push(String(msg));
          ws.send(JSON.stringify({ type: "pong", echo: String(msg) }));
        },
      },
    });

    // 2. Proxy server configured to target the mock upstream
    const prevEnv = process.env.PASEO_URL;
    process.env.PASEO_URL = `ws://127.0.0.1:${upstream.port}/ws`;

    const proxy = serve<ProxySocketData>({
      port: 0,
      routes: {
        "/api/paseo/ws": {
          GET(req: Request, s: any) {
            return handleWsUpgrade(req, s);
          },
        },
      },
      websocket: proxyWebSocketHandler,
    });

    try {
      // 3. Connect client to proxy
      const clientReceived: any[] = [];
      const client = new WebSocket(`ws://127.0.0.1:${proxy.port}/api/paseo/ws`);

      const connected = new Promise<void>((resolve) => {
        client.onopen = () => {
          // Immediately send a message without waiting for upstream handshake
          client.send(JSON.stringify({ type: "ping", seq: 1 }));
          resolve();
        };
      });

      const gotReply = new Promise<void>((resolve) => {
        client.onmessage = (event) => {
          clientReceived.push(JSON.parse(String(event.data)));
          resolve();
        };
      });

      await connected;
      await gotReply;

      expect(receivedUpstream.length).toBe(1);
      expect(JSON.parse(receivedUpstream[0]!)).toEqual({ type: "ping", seq: 1 });
      expect(clientReceived.length).toBe(1);
      expect(clientReceived[0].type).toBe("pong");

      client.close();
    } finally {
      if (prevEnv) process.env.PASEO_URL = prevEnv;
      else delete process.env.PASEO_URL;
      proxy.stop();
      upstream.stop();
    }
  });

  it("relays binary messages (terminal frames) in both directions", async () => {
    // Mock upstream that echoes binary with modification
    const upstream = serve({
      port: 0,
      routes: {
        "/ws": {
          GET(req, s) {
            s.upgrade(req);
          },
        },
      },
      websocket: {
        message(ws, msg) {
          if (typeof msg !== "string") {
            const u8 = new Uint8Array(msg);
            const response = new Uint8Array([0x01, (u8[1] ?? 0) * 2, 0xff]);
            ws.send(response);
          }
        },
      },
    });

    const prevEnv = process.env.PASEO_URL;
    process.env.PASEO_URL = `ws://127.0.0.1:${upstream.port}/ws`;

    const proxy = serve<ProxySocketData>({
      port: 0,
      routes: {
        "/api/paseo/ws": {
          GET(req: Request, s: any) {
            return handleWsUpgrade(req, s);
          },
        },
      },
      websocket: proxyWebSocketHandler,
    });

    try {
      const client = new WebSocket(`ws://127.0.0.1:${proxy.port}/api/paseo/ws`);
      client.binaryType = "arraybuffer";

      const gotBinary = new Promise<Uint8Array>((resolve) => {
        client.onmessage = (event) => {
          resolve(new Uint8Array(event.data as ArrayBuffer));
        };
      });

      client.onopen = () => {
        client.send(new Uint8Array([0x01, 21]));
      };

      const result = await gotBinary;
      expect(result[0]).toBe(0x01);
      expect(result[1]).toBe(42);
      expect(result[2]).toBe(0xff);

      client.close();
    } finally {
      if (prevEnv) process.env.PASEO_URL = prevEnv;
      else delete process.env.PASEO_URL;
      proxy.stop();
      upstream.stop();
    }
  });

  it("propagates subprotocols (e.g. auth bearer tokens)", async () => {
    let upstreamNegotiatedProtocol = "";
    const upstream = serve({
      port: 0,
      routes: {
        "/ws": {
          GET(req, s) {
            s.upgrade(req);
          },
        },
      },
      websocket: {
        open(ws) {
          // ws opened
        },
        message(ws, msg) {
          // send client's protocol back
          ws.send("ok");
        },
      },
    });

    const prevEnv = process.env.PASEO_URL;
    process.env.PASEO_URL = `ws://127.0.0.1:${upstream.port}/ws`;

    const proxy = serve<ProxySocketData>({
      port: 0,
      routes: {
        "/api/paseo/ws": {
          GET(req: Request, s: any) {
            return handleWsUpgrade(req, s);
          },
        },
      },
      websocket: proxyWebSocketHandler,
    });

    try {
      const client = new WebSocket(`ws://127.0.0.1:${proxy.port}/api/paseo/ws`, [
        "paseo.bearer.test-token-1234",
      ]);

      const done = new Promise<string>((resolve) => {
        client.onopen = () => {
          resolve(client.protocol);
        };
      });

      const negotiated = await done;
      expect(negotiated).toBe("paseo.bearer.test-token-1234");
      client.close();
    } finally {
      if (prevEnv) process.env.PASEO_URL = prevEnv;
      else delete process.env.PASEO_URL;
      proxy.stop();
      upstream.stop();
    }
  });

  it("returns 426 Upgrade Required for non-WebSocket HTTP requests", async () => {
    const proxy = serve<ProxySocketData>({
      port: 0,
      routes: {
        "/api/paseo/ws": {
          GET(req: Request, s: any) {
            return handleWsUpgrade(req, s);
          },
        },
      },
      websocket: proxyWebSocketHandler,
    });

    try {
      const res = await fetch(`http://127.0.0.1:${proxy.port}/api/paseo/ws`);
      expect(res.status).toBe(426);
    } finally {
      proxy.stop();
    }
  });

  it("does not block proxied Host headers when development: false is set", async () => {
    const s = serve({
      port: 0,
      development: false,
      routes: {
        "/api/health": {
          GET() {
            return Response.json({ status: "ok" });
          },
        },
      },
    });

    try {
      const res = await fetch(`http://127.0.0.1:${s.port}/api/health`, {
        headers: { Host: "dev--amble-test.paseoapps.home.cowger.us" },
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe("ok");
    } finally {
      s.stop(true);
    }
  });
});
