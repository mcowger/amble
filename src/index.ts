import { serve } from "bun";
import index from "./index.html";
import manifest from "./manifest.json";
import logo from "./logo.svg" with { type: "text" };
import {
  handleWsUpgrade,
  proxyWebSocketHandler,
  getUpstreamWsUrl,
  type ProxySocketData,
} from "./lib/paseo/proxy-handler";

const port = Number(process.env.PORT || 5555);
const hostname = process.env.HOST || "0.0.0.0";

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

