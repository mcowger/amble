import type { WorkspaceScriptItem, WorkspaceScriptRoute } from "./types";

function isLoopbackHost(host: string): boolean {
  const normalized = host.trim().toLowerCase();
  return (
    normalized === "localhost" ||
    normalized === "127.0.0.1" ||
    normalized === "::1" ||
    normalized.endsWith(".localhost")
  );
}

function isLocalOnlyUrl(url: string | null | undefined): boolean {
  if (!url) return true;
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return isLoopbackHost(hostname);
  } catch {
    return true;
  }
}

export function stripUrlProtocol(url: string): string {
  return url.replace(/^https?:\/\//, "");
}

export function resolveWorkspaceScriptRoutes(
  script: WorkspaceScriptItem,
  daemonUrl?: string,
): WorkspaceScriptRoute[] {
  if (script.type !== "service") {
    return [];
  }

  const routes: WorkspaceScriptRoute[] = [];

  // 1. Reverse proxy (public route)
  const publicUrl =
    script.publicProxyUrl ||
    (script.proxyUrl && !isLocalOnlyUrl(script.proxyUrl) ? script.proxyUrl : null);

  if (publicUrl) {
    routes.push({
      kind: "public",
      name: "Reverse proxy",
      url: publicUrl,
      displayUrl: stripUrlProtocol(publicUrl),
    });
  }

  // 2. Memorable (local proxy route)
  const localUrl =
    script.localProxyUrl ||
    (script.proxyUrl && isLocalOnlyUrl(script.proxyUrl) ? script.proxyUrl : null);

  if (localUrl) {
    routes.push({
      kind: "paseo",
      name: "Memorable",
      url: localUrl,
      displayUrl: stripUrlProtocol(localUrl),
    });
  }

  // 3. Direct route
  if (script.port !== null && script.port !== undefined && script.port > 0) {
    let host = "localhost";
    if (typeof window !== "undefined" && window.location?.hostname) {
      host = window.location.hostname;
    } else if (daemonUrl) {
      try {
        const parsed = new URL(daemonUrl);
        host = parsed.hostname;
      } catch {
        // keep default
      }
    }
    const directUrl = `http://${host}:${script.port}`;
    routes.push({
      kind: "direct",
      name: "Direct",
      url: directUrl,
      displayUrl: `${host}:${script.port}`,
    });
  }

  return routes;
}
