import { describe, expect, it } from "bun:test";
import { resolveWorkspaceScriptRoutes, stripUrlProtocol } from "./workspace-scripts";
import type { WorkspaceScriptItem } from "./types";

describe("workspace-scripts helpers", () => {
  it("stripUrlProtocol removes http and https protocols", () => {
    expect(stripUrlProtocol("http://localhost:3000")).toBe("localhost:3000");
    expect(stripUrlProtocol("https://app.paseoapps.home.cowger.us")).toBe("app.paseoapps.home.cowger.us");
  });

  it("returns empty routes for script tasks", () => {
    const task: WorkspaceScriptItem = {
      scriptName: "build",
      type: "script",
      hostname: "localhost",
      port: null,
      lifecycle: "running",
      health: null,
    };
    expect(resolveWorkspaceScriptRoutes(task)).toEqual([]);
  });

  it("resolves all three routes for a service with full proxy information", () => {
    const service: WorkspaceScriptItem = {
      scriptName: "dev",
      type: "service",
      hostname: "dev--amble-7de10435.localhost",
      port: 35071,
      localProxyUrl: "http://dev--amble-7de10435.localhost:6767",
      publicProxyUrl: "https://dev--amble-7de10435.paseoapps.home.cowger.us",
      proxyUrl: "https://dev--amble-7de10435.paseoapps.home.cowger.us",
      lifecycle: "running",
      health: "healthy",
      exitCode: null,
      terminalId: "term-123",
    };

    const routes = resolveWorkspaceScriptRoutes(service, "ws://127.0.0.1:6767/ws");
    expect(routes).toHaveLength(3);

    expect(routes[0]).toEqual({
      kind: "public",
      name: "Reverse proxy",
      url: "https://dev--amble-7de10435.paseoapps.home.cowger.us",
      displayUrl: "dev--amble-7de10435.paseoapps.home.cowger.us",
    });

    expect(routes[1]).toEqual({
      kind: "paseo",
      name: "Memorable",
      url: "http://dev--amble-7de10435.localhost:6767",
      displayUrl: "dev--amble-7de10435.localhost:6767",
    });

    expect(routes[2]).toEqual({
      kind: "direct",
      name: "Direct",
      url: "http://127.0.0.1:35071",
      displayUrl: "127.0.0.1:35071",
    });
  });
});
