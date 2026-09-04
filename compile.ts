import tailwind from "bun-plugin-tailwind";
import { chmod, mkdir, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { paseoRelayExportWorkaround } from "./src/lib/paseo/relay-export-workaround";

// Target is strictly linux x64 as specified
const TARGET = "bun-linux-x64";

// Parse CLI arguments
const rawArgs = process.argv.slice(2);
let outfile = path.resolve(process.cwd(), "dist/amble");

for (let i = 0; i < rawArgs.length; i++) {
  const arg = rawArgs[i];
  if (arg === "-o" || arg === "--outfile") {
    const val = rawArgs[++i];
    if (val) outfile = path.resolve(process.cwd(), val);
  } else if (arg?.startsWith("--outfile=")) {
    const val = arg.split("=")[1];
    if (val) outfile = path.resolve(process.cwd(), val);
  } else if (arg === "--help" || arg === "-h") {
    console.log("Compile Amble into a single Linux x64 standalone executable");
    console.log("");
    console.log("Usage: bun run compile.ts [options] [outfile]");
    console.log("");
    console.log("Options:");
    console.log("  -o, --outfile <path>  Output path for executable (default: dist/amble)");
    console.log("  -h, --help            Show this help message");
    process.exit(0);
  } else if (arg && !arg.startsWith("-")) {
    outfile = path.resolve(process.cwd(), arg);
  }
}

console.log(`📦 Compiling Amble into a single executable [${TARGET}]...`);
console.log(`   Output: ${outfile}`);

// Step 1: Build the frontend bundle
console.log("⚡ [1/3] Building self-contained frontend bundle...");
const frontendResult = await Bun.build({
  entrypoints: [path.resolve(process.cwd(), "src/index.html")],
  plugins: [tailwind, paseoRelayExportWorkaround],
  target: "browser",
  compile: true,
  minify: true,
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
  },
});

if (!frontendResult.success) {
  console.error("❌ Frontend bundling failed:");
  for (const log of frontendResult.logs) {
    console.error(log);
  }
  process.exit(1);
}

const bundledHtml = await frontendResult.outputs[0]?.text();
if (!bundledHtml) {
  console.error("❌ Frontend build produced empty output");
  process.exit(1);
}

const bundleSizeMb = ((frontendResult.outputs[0]?.size || 0) / (1024 * 1024)).toFixed(2);
console.log(`✓ Frontend bundle created (${bundleSizeMb} MB)`);

// Step 2: Prepare standalone server code in a temporary directory
console.log("⚡ [2/3] Preparing standalone server entrypoint...");
const tempDir = await mkdtemp(path.join(tmpdir(), "amble-compile-"));
const proxyHandlerPath = path.resolve(process.cwd(), "src/lib/paseo/proxy-handler.ts");

const serverCode = `import { serve } from "bun";
import html from "./index.html" with { type: "text" };
import manifest from "./manifest.json" with { type: "text" };
import logo from "./logo.svg" with { type: "text" };
import {
  handleWsUpgrade,
  proxyWebSocketHandler,
  getUpstreamWsUrl,
  type ProxySocketData,
} from ${JSON.stringify(proxyHandlerPath)};

const args = process.argv.slice(2);
let port = Number(process.env.PORT || 5555);
let hostname = process.env.HOST || "0.0.0.0";

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === "--port" || arg === "-p") {
    const val = args[++i];
    if (val && !isNaN(Number(val))) port = Number(val);
  } else if (arg?.startsWith("--port=")) {
    const val = arg.split("=")[1];
    if (val && !isNaN(Number(val))) port = Number(val);
  } else if (arg === "--host" || arg === "-h") {
    const val = args[++i];
    if (val) hostname = val;
  } else if (arg?.startsWith("--host=")) {
    const val = arg.split("=")[1];
    if (val) hostname = val;
  } else if (arg === "--help") {
    console.log("Amble - Paseo Web UI");
    console.log("");
    console.log("Usage: amble [options]");
    console.log("");
    console.log("Options:");
    console.log("  -p, --port <number>  Port to listen on (default: 5555, env: PORT)");
    console.log("  -h, --host <string>  Host address to bind (default: 0.0.0.0, env: HOST)");
    console.log("      --help           Show this help message");
    process.exit(0);
  }
}

const server = serve<ProxySocketData>({
  port,
  hostname,
  // 255s (Bun maximum) prevents idle keep-alive connections from being
  // closed prematurely when behind reverse proxies like Nginx.
  idleTimeout: 255,
  routes: {
    "/manifest.json": {
      GET() {
        return new Response(manifest, {
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

    "/*": {
      GET() {
        return new Response(html, {
          headers: {
            "content-type": "text/html; charset=utf-8",
            "cache-control": "no-cache",
            "x-accel-buffering": "no",
          },
        });
      },
    },
  },

  websocket: proxyWebSocketHandler,
  development: false,
});

console.log(\`🚀 Amble server running at \${server.url}\`);
console.log(\`🔌 Paseo WebSocket proxy active at /api/paseo/ws -> \${getUpstreamWsUrl()}\`);

process.on("SIGINT", () => {
  server.stop(true);
  process.exit(0);
});

process.on("SIGTERM", () => {
  server.stop(true);
  process.exit(0);
});
`;

try {
  await writeFile(path.join(tempDir, "index.html"), bundledHtml, "utf8");
  await writeFile(
    path.join(tempDir, "manifest.json"),
    await Bun.file(path.resolve(process.cwd(), "src/manifest.json")).text(),
    "utf8",
  );
  await writeFile(
    path.join(tempDir, "logo.svg"),
    await Bun.file(path.resolve(process.cwd(), "src/logo.svg")).text(),
    "utf8",
  );
  await writeFile(path.join(tempDir, "entry.ts"), serverCode, "utf8");

  // Step 3: Compile into standalone executable
  console.log(`⚡ [3/3] Compiling standalone executable [${TARGET}]...`);
  await mkdir(path.dirname(outfile), { recursive: true });

  const buildProc = Bun.spawn(
    [
      "bun",
      "build",
      "--compile",
      "--minify",
      "--bytecode",
      `--target=${TARGET}`,
      path.join(tempDir, "entry.ts"),
      `--outfile=${outfile}`,
    ],
    {
      stdout: "inherit",
      stderr: "inherit",
    }
  );

  const exitCode = await buildProc.exited;
  if (exitCode !== 0) {
    console.error(`❌ Compilation failed with exit code ${exitCode}`);
    process.exit(exitCode);
  }

  await chmod(outfile, 0o755);

  const fileStat = await stat(outfile);
  const sizeMb = (fileStat.size / (1024 * 1024)).toFixed(2);

  console.log("");
  console.log("✨ Successfully compiled Amble into a single executable!");
  console.log(`   Binary:  ${path.relative(process.cwd(), outfile) || outfile}`);
  console.log(`   Size:    ${sizeMb} MB`);
  console.log(`   Target:  Linux x64 (${TARGET})`);
  console.log("");
  console.log("   Run with:");
  console.log(`     ${outfile}`);
  console.log(`     PORT=8080 ${outfile}`);
  console.log("");
} finally {
  await rm(tempDir, { recursive: true, force: true });
}
