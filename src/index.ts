import { serve } from "bun";
import index from "./index.html";

const port = Number(process.env.PORT || 5173);
const hostname = process.env.HOST || "0.0.0.0";

const server = serve({
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
  },

  development: process.env.NODE_ENV !== "production" && {
    // Enable browser hot reloading in development
    hmr: true,

    // Echo console logs from the browser to the server
    console: true,
  },
});

console.log(`🚀 Amble dev server running at ${server.url}`);

