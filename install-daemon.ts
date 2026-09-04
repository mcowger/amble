import { mkdir, rm, stat, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";

// 1. Verify platform and systemd presence
async function checkLinuxSystemd(): Promise<{ ok: boolean; reason?: string }> {
  if (process.platform !== "linux") {
    return {
      ok: false,
      reason: `Platform is "${process.platform}". Amble daemon installation requires Linux with systemd.`,
    };
  }

  const hasSystemdDir = await stat("/run/systemd/system")
    .then((s) => s.isDirectory())
    .catch(() => false);

  if (!hasSystemdDir) {
    return {
      ok: false,
      reason: "systemd is not the active init system on this machine (/run/systemd/system not found).",
    };
  }

  const whichProc = Bun.spawn(["which", "systemctl"], {
    stdout: "ignore",
    stderr: "ignore",
  });
  if ((await whichProc.exited) !== 0) {
    return {
      ok: false,
      reason: "'systemctl' command was not found in PATH.",
    };
  }

  const userBusProc = Bun.spawn(["systemctl", "--user", "status"], {
    stdout: "ignore",
    stderr: "ignore",
  });
  if ((await userBusProc.exited) !== 0) {
    return {
      ok: false,
      reason: "systemd user manager is not accessible. Verify user session or XDG_RUNTIME_DIR.",
    };
  }

  return { ok: true };
}

// 2. Parse CLI arguments
const rawArgs = process.argv.slice(2);
let port = process.env.PORT || "5555";
let host = process.env.HOST || "0.0.0.0";
let binPath = path.join(homedir(), ".local/bin", "amble");
let shouldStart = true;
let shouldEnable = true;
let isUninstall = false;

for (let i = 0; i < rawArgs.length; i++) {
  const arg = rawArgs[i];
  if (arg === "--port" || arg === "-p") {
    const val = rawArgs[++i];
    if (val) port = val;
  } else if (arg?.startsWith("--port=")) {
    port = arg.split("=")[1] || port;
  } else if (arg === "--host" || arg === "-h") {
    const val = rawArgs[++i];
    if (val) host = val;
  } else if (arg?.startsWith("--host=")) {
    host = arg.split("=")[1] || host;
  } else if (arg === "--bin") {
    const val = rawArgs[++i];
    if (val) binPath = path.resolve(process.cwd(), val);
  } else if (arg?.startsWith("--bin=")) {
    binPath = path.resolve(process.cwd(), arg.split("=")[1] || "");
  } else if (arg === "--no-start") {
    shouldStart = false;
  } else if (arg === "--no-enable") {
    shouldEnable = false;
  } else if (arg === "--uninstall") {
    isUninstall = true;
  } else if (arg === "--help") {
    console.log("Install or manage Amble systemd user service");
    console.log("");
    console.log("Usage: bun run install-daemon.ts [options]");
    console.log("");
    console.log("Options:");
    console.log("  -p, --port <number>  Port for Amble service (default: 5555, env: PORT)");
    console.log("  -h, --host <string>  Host address to bind (default: 0.0.0.0, env: HOST)");
    console.log("      --bin <path>     Path to amble binary (default: ~/.local/bin/amble)");
    console.log("      --no-start       Do not start/restart the service after installing");
    console.log("      --no-enable      Do not enable the service at login/boot");
    console.log("      --uninstall      Remove the amble systemd user service");
    console.log("      --help           Show this help message");
    process.exit(0);
  }
}

// 3. Perform platform and systemd validation
console.log("🔍 Checking platform and systemd compatibility...");
const check = await checkLinuxSystemd();
if (!check.ok) {
  console.error("");
  console.error("❌ System verification failed:");
  console.error(`   ${check.reason}`);
  console.error("");
  process.exit(1);
}
console.log("✓ Linux platform with active systemd verified.");

const userSystemdDir = path.join(homedir(), ".config/systemd/user");
const serviceFile = path.join(userSystemdDir, "amble.service");

// Handle uninstall
if (isUninstall) {
  console.log("🛑 Removing Amble user systemd service...");
  await Bun.spawn(["systemctl", "--user", "stop", "amble.service"]).exited;
  await Bun.spawn(["systemctl", "--user", "disable", "amble.service"]).exited;
  await rm(serviceFile, { force: true });
  await Bun.spawn(["systemctl", "--user", "daemon-reload"]).exited;
  await Bun.spawn(["systemctl", "--user", "reset-failed"]).exited;
  console.log("✓ Amble user service uninstalled successfully.");
  process.exit(0);
}

// 4. Ensure the binary is present at binPath
const binExists = await stat(binPath)
  .then((s) => s.isFile())
  .catch(() => false);

if (!binExists) {
  console.log(`⚠️  Binary not found at ${binPath}. Running deploy script first...`);
  const deployProc = Bun.spawn(["bun", "run", "deploy.ts"], {
    stdout: "inherit",
    stderr: "inherit",
  });
  const deployExit = await deployProc.exited;
  if (deployExit !== 0) {
    console.error(`❌ Deployment failed with exit code ${deployExit}`);
    process.exit(deployExit);
  }
}

// 5. Ensure systemd user directory exists
await mkdir(userSystemdDir, { recursive: true });

// 6. Write amble.service unit file
const unitContent = `[Unit]
Description=Amble - Paseo Web UI
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
ExecStart=${binPath} --host ${host} --port ${port}
WorkingDirectory=%h
Restart=always
RestartSec=3
Environment=PORT=${port}
Environment=HOST=${host}
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=default.target
`;

console.log(`📝 Writing service unit to ${serviceFile}...`);
await writeFile(serviceFile, unitContent, "utf8");

// 7. Reload systemd daemon
console.log("🔄 Reloading systemd user daemon...");
const reloadProc = Bun.spawn(["systemctl", "--user", "daemon-reload"], {
  stdout: "inherit",
  stderr: "inherit",
});
await reloadProc.exited;

// 8. Enable and start if requested
if (shouldEnable) {
  console.log("⚡ Enabling amble.service...");
  const enableProc = Bun.spawn(["systemctl", "--user", "enable", "amble.service"], {
    stdout: "inherit",
    stderr: "inherit",
  });
  await enableProc.exited;
}

if (shouldStart) {
  console.log("🚀 Starting amble.service...");
  const restartProc = Bun.spawn(["systemctl", "--user", "restart", "amble.service"], {
    stdout: "inherit",
    stderr: "inherit",
  });
  await restartProc.exited;

  console.log("");
  console.log("📊 Service Status:");
  const statusProc = Bun.spawn(
    ["systemctl", "--user", "status", "amble.service", "--no-pager", "--lines=10"],
    {
      stdout: "inherit",
      stderr: "inherit",
    }
  );
  await statusProc.exited;
}

console.log("");
console.log("✨ Amble daemon setup complete!");
console.log(`   Service File: ${serviceFile}`);
console.log(`   Binary:       ${binPath}`);
console.log(`   Listen:       http://0.0.0.0:${port} (all interfaces)`);
console.log(`   URL:          http://${host === "0.0.0.0" ? "localhost" : host}:${port}`);
console.log("");
console.log("Useful commands:");
console.log("   Check status:  systemctl --user status amble");
console.log("   View logs:     journalctl --user -u amble -f");
console.log("   Restart:       systemctl --user restart amble");
console.log("   Stop:          systemctl --user stop amble");
console.log("");
