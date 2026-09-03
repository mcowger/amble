import { serve } from "bun";
import index from "./index.html";
import {
  handleWsUpgrade,
  proxyWebSocketHandler,
  getUpstreamWsUrl,
  type ProxySocketData,
} from "./lib/paseo/proxy-handler";

const port = Number(process.env.PORT || 5173);
const hostname = process.env.HOST || "0.0.0.0";

// Behind the Paseo service proxy the public Host (e.g.
// dev--amble-*.paseoapps.home.cowger.us) is forwarded verbatim. Stable Bun
// (1.4.0) has no `development.allowedHosts` yet (oven-sh/bun#40733 is still
// open), so its dev-server DNS-rebinding check answers 403 for proxied
// hosts. Serve the production bundle behind the proxy; local `bun run dev`
// keeps HMR. Re-enable HMR behind the proxy once stable Bun supports
// `development.allowedHosts`.
const isPaseoService = Boolean(process.env.PASEO_PORT);

const server = serve<ProxySocketData>({
  port,
  hostname,
  routes: {
    // Serve index.html for all unmatched routes.
    "/*": index,

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
  },

  websocket: proxyWebSocketHandler,

  development: !isPaseoService && process.env.NODE_ENV !== "production" && {
    // Enable browser hot reloading in development
    hmr: true,

    // Echo console logs from the browser to the server
    console: true,
  },
});

console.log(`🚀 Amble dev server running at ${server.url}`);
console.log(`🔌 Paseo WebSocket proxy active at /api/paseo/ws -> ${getUpstreamWsUrl()}`);

