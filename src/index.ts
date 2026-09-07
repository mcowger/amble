import { serve } from "bun";
import index from "./index.html";
import manifest from "./manifest.json";
import favicon from "./favicon.ico" with { type: "file" };
import favicon16 from "./favicon-16.png" with { type: "file" };
import favicon32 from "./favicon-32.png" with { type: "file" };
import favicon48 from "./favicon-48.png" with { type: "file" };
import appleTouchIcon from "./apple-touch-icon.png" with { type: "file" };
import icon192 from "./icon-192.png" with { type: "file" };
import icon512 from "./icon-512.png" with { type: "file" };
import logo from "./logo.svg" with { type: "text" };
import {
  handleWsUpgrade,
  proxyWebSocketHandler,
  getUpstreamWsUrl,
  type ProxySocketData,
} from "./lib/paseo/proxy-handler";

const port = Number(process.env.PORT || 5555);
const hostname = process.env.HOST || "0.0.0.0";
const touchTelemetryRevision = "touch-v6-react-aria";
const imageResponse = (asset: string, contentType: string) =>
  new Response(Bun.file(asset), {
    headers: {
      "content-type": contentType,
      "cache-control": "public, max-age=86400",
    },
  });

// Disable Bun's internal dev server Host header / DNS-rebinding check so it
// never blocks proxied requests (e.g. "Blocked: Host header does not match the dev server").
// Host enforcement is handled upstream by reverse proxies.
const server = serve<ProxySocketData>({
  port,
  hostname,
  // 255s (Bun maximum) prevents idle HTTP keep-alive connections from being
  // closed prematurely when behind reverse proxies like Nginx.
  idleTimeout: 255,
  routes: {
    "/manifest.json": {
      GET() {
        return Response.json(manifest, {
          headers: {
            "content-type": "application/manifest+json; charset=utf-8",
            "cache-control": "public, max-age=86400",
          },
        });
      },
    },

    "/logo.svg": {
      GET() {
        return new Response(logo, {
          headers: {
            "content-type": "image/svg+xml; charset=utf-8",
            "cache-control": "public, max-age=86400",
          },
        });
      },
    },

    "/favicon.ico": {
      GET() {
        return imageResponse(favicon, "image/x-icon");
      },
    },

    "/favicon-16.png": {
      GET() {
        return imageResponse(favicon16, "image/png");
      },
    },

    "/favicon-32.png": {
      GET() {
        return imageResponse(favicon32, "image/png");
      },
    },

    "/favicon-48.png": {
      GET() {
        return imageResponse(favicon48, "image/png");
      },
    },

    "/apple-touch-icon.png": {
      GET() {
        return imageResponse(appleTouchIcon, "image/png");
      },
    },

    "/icon-192.png": {
      GET() {
        return imageResponse(icon192, "image/png");
      },
    },

    "/icon-512.png": {
      GET() {
        return imageResponse(icon512, "image/png");
      },
    },

    "/api/debug/event": {
      async POST(req: Request) {
        try {
          const body = await req.json();
          const items = Array.isArray(body) ? body : [body];
          const requestId = crypto.randomUUID();
          const requestContext = {
            requestId,
            receivedAt: new Date().toISOString(),
            serverRevision: touchTelemetryRevision,
            serverPort: port,
            requestUrl: req.url,
            host: req.headers.get("host"),
            forwardedHost: req.headers.get("x-forwarded-host"),
            forwardedProto: req.headers.get("x-forwarded-proto"),
            origin: req.headers.get("origin"),
            referer: req.headers.get("referer"),
            userAgent: req.headers.get("user-agent"),
          };
          const lines = items.map((e: any) => {
            const time = new Date(e.t || Date.now()).toISOString().slice(11, 23);
            const target = e.target ? (typeof e.target === "string" ? e.target : `${e.target.tag || ""}${e.target.id ? "#" + e.target.id : ""}${e.target.class ? "." + e.target.class : ""}`) : "none";
            const pt = e.pt ? `pt:(${Math.round(e.pt.x)},${Math.round(e.pt.y)})` : "";
            const rect = e.rect ? `rect:(${Math.round(e.rect.x)},${Math.round(e.rect.y)},${Math.round(e.rect.w)}x${Math.round(e.rect.h)})` : "";
            const active = e.active ? `active:${typeof e.active === "string" ? e.active : (e.active.tag || "") + (e.active.id ? "#" + e.active.id : "")}` : "";
            const prev = e.prevented ? " [PREVENTED]" : "";
            const trusted = e.trusted !== undefined ? ` [${e.trusted ? "trusted" : "synthetic"}]` : "";
            const dt = e.dt !== undefined ? ` dt:${e.dt}ms` : "";
            const dxy = e.dxy ? ` dxy:(${e.dxy.x},${e.dxy.y})` : "";
            const stack = e.stack ? ` stack:[${e.stack.join(" > ")}]` : "";
            const clickTarget = e.clickTarget ? ` clickTarget:${e.clickTarget}` : "";
            const computed = e.computed ? ` style:${JSON.stringify(e.computed)}` : "";
            const delta = e.delta ? ` delta:${JSON.stringify(e.delta)}` : "";
            const path = e.path ? ` path:[${e.path.join(" > ")}]` : "";
            const vp = e.vp ? ` vp:${JSON.stringify(e.vp)}` : "";
            const info = e.info ? ` | info:${e.info}` : "";
            const err = e.err ? ` [ERROR: ${e.err}]` : "";
            const identity = ` rev:${e.revision || "legacy"} session:${e.session || "unknown"} seq:${e.seq ?? "?"}`;
            return `[${time}] ${String(e.type || "unknown").padEnd(15)} | target:${target.padEnd(30)} | ${pt} | ${rect} | ${active}${trusted}${dt}${dxy}${delta}${clickTarget}${computed}${stack}${path}${vp}${prev}${identity}${info}${err}`;
          }).join("\n") + "\n";

          const fs = await import("node:fs/promises");
          const requestLine = `\n--- ${requestContext.receivedAt} request:${requestId} server:${touchTelemetryRevision} port:${port} host:${requestContext.host || ""} forwarded-host:${requestContext.forwardedHost || ""} origin:${requestContext.origin || ""} referer:${requestContext.referer || ""} ua:${requestContext.userAgent || ""} ---\n`;
          const rawLines = items
            .map((event: unknown) => JSON.stringify({ ...requestContext, event }))
            .join("\n") + "\n";
          await Promise.all([
            fs.appendFile("/tmp/touch-events.log", requestLine + lines, "utf8"),
            fs.appendFile("/tmp/touch-events.ndjson", rawLines, "utf8"),
          ]);
          return Response.json(
            { status: "ok", count: items.length, requestId, serverRevision: touchTelemetryRevision },
            { headers: { "cache-control": "no-store" } },
          );
        } catch (err: any) {
          return Response.json({ error: String(err) }, { status: 400 });
        }
      },
      async GET(req: Request) {
        const url = new URL(req.url);
        const fs = await import("node:fs/promises");
        if (url.searchParams.has("clear")) {
          await Promise.all([
            fs.writeFile("/tmp/touch-events.log", "", "utf8"),
            fs.writeFile("/tmp/touch-events.ndjson", "", "utf8"),
          ]);
          return new Response("Cleared touch telemetry logs\n", {
            headers: { "cache-control": "no-store" },
          });
        }
        try {
          const content = await fs.readFile("/tmp/touch-events.log", "utf8");
          return new Response(content, {
            headers: {
              "content-type": "text/plain; charset=utf-8",
              "cache-control": "no-store",
              "x-touch-telemetry-revision": touchTelemetryRevision,
            },
          });
        } catch {
          return new Response("(No events logged yet)\n", { headers: { "content-type": "text/plain; charset=utf-8" } });
        }
      },
    },

    "/api/health": {
      GET() {
        return Response.json({ status: "ok", service: "amble" });
      },
    },

    "/api/paseo/ws": {
      GET(req: Request, s: any) {
        return handleWsUpgrade(req, s);
      },
    },

    "/ws": {
      GET(req: Request, s: any) {
        return handleWsUpgrade(req, s);
      },
    },

    // Serve index.html for all unmatched routes.
    "/*": index,
  },

  websocket: proxyWebSocketHandler,

  // Never enforce dev server host checking
  development: false,
});

console.log(`🚀 Amble dev server running at ${server.url}`);
console.log(`🔌 Paseo WebSocket proxy active at /api/paseo/ws -> ${getUpstreamWsUrl()}`);
