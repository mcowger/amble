import { chmod, copyFile, mkdir, rename, stat, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";

const rawArgs = process.argv.slice(2);
let destDir = path.join(homedir(), ".local/bin");
let binName = "amble";
let port = process.env.PORT || "5555";
let host = process.env.HOST || "0.0.0.0";
let shouldCompile = true;
let shouldRestart = true;

for (let i = 0; i < rawArgs.length; i++) {
  const arg = rawArgs[i];
  if (arg === "--dest" || arg === "-d") {
    const val = rawArgs[++i];
    if (val) destDir = path.resolve(process.cwd(), val);
  } else if (arg?.startsWith("--dest=")) {
    destDir = path.resolve(process.cwd(), arg.split("=")[1] || "");
  } else if (arg === "--name" || arg === "-n") {
    const val = rawArgs[++i];
    if (val) binName = val;
  } else if (arg?.startsWith("--name=")) {
    binName = arg.split("=")[1] || binName;
  } else if (arg === "--port" || arg === "-p") {
    const val = rawArgs[++i];
    if (val) port = val;
  } else if (arg?.startsWith("--port=")) {
    port = arg.split("=")[1] || port;
  } else if (arg === "--host" || arg === "-h") {
    const val = rawArgs[++i];
    if (val) host = val;
  } else if (arg?.startsWith("--host=")) {
    host = arg.split("=")[1] || host;
  } else if (arg === "--no-compile" || arg === "--skip-compile") {
    shouldCompile = false;
  } else if (arg === "--no-restart") {
    shouldRestart = false;
  } else if (arg === "--help") {
    console.log("Deploy Amble binary and manage daemon service");
    console.log("");
    console.log("Usage: bun run deploy.ts [options]");
    console.log("");
    console.log("Options:");
    console.log("  -d, --dest <dir>      Destination directory (default: ~/.local/bin)");
    console.log("  -n, --name <name>     Target binary name (default: amble)");
    console.log("  -p, --port <number>   Port if installing new service (default: 5555)");
    console.log("  -h, --host <string>   Host if installing new service (default: 0.0.0.0)");
    console.log("      --no-compile      Skip compiling and deploy existing dist/amble");
    console.log("      --no-restart      Skip restarting the service/binary");
    console.log("      --help            Show this help message");
    process.exit(0);
  }
}

const sourcePath = path.resolve(process.cwd(), "dist/amble");
const targetPath = path.join(destDir, binName);

console.log("🚀 Starting Amble deployment workflow...");
console.log(`   Target binary: ${targetPath}`);

// ==========================================
// Step 1: Compile
// ==========================================
console.log("");
console.log("⚡ [1/4] Compiling Amble executable...");
if (shouldCompile) {
  const compileProc = Bun.spawn(["bun", "run", "compile.ts"], {
    stdout: "inherit",
    stderr: "inherit",
  });
  const exitCode = await compileProc.exited;
  if (exitCode !== 0) {
    console.error(`❌ Compilation failed with exit code ${exitCode}`);
    process.exit(exitCode);
  }
} else {
  try {
    await stat(sourcePath);
    console.log(`✓ Using existing compiled binary at ${sourcePath}`);
  } catch {
    console.error(`❌ Source binary not found at ${sourcePath}. Run with compilation enabled.`);
    process.exit(1);
  }
}

// ==========================================
// Step 2: Ensure systemd service is installed (do not overwrite existing)
// ==========================================
console.log("");
console.log("⚡ [2/4] Ensuring systemd service is installed...");
const userSystemdDir = path.join(homedir(), ".config/systemd/user");
const serviceFile = path.join(userSystemdDir, "amble.service");

let systemdAvailable = false;
if (process.platform === "linux") {
  const hasSystemdDir = await stat("/run/systemd/system")
    .then((s) => s.isDirectory())
    .catch(() => false);
  const whichProc = Bun.spawn(["which", "systemctl"], { stdout: "ignore", stderr: "ignore" });
  const hasSystemctl = (await whichProc.exited) === 0;
  systemdAvailable = hasSystemdDir && hasSystemctl;
}

const serviceExists = await stat(serviceFile)
  .then((s) => s.isFile())
  .catch(() => false);

if (serviceExists) {
  console.log(`✓ systemd unit already installed at ${serviceFile} (preserving existing unit)`);
} else if (systemdAvailable) {
  console.log(`📝 Installing systemd user unit to ${serviceFile}...`);
  await mkdir(userSystemdDir, { recursive: true });

  const unitContent = `[Unit]
Description=Amble - Paseo Web UI
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
ExecStart=${targetPath} --host ${host} --port ${port}
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

  await writeFile(serviceFile, unitContent, "utf8");
  await Bun.spawn(["systemctl", "--user", "daemon-reload"], {
    stdout: "inherit",
    stderr: "inherit",
  }).exited;
  await Bun.spawn(["systemctl", "--user", "enable", "amble.service"], {
    stdout: "inherit",
    stderr: "inherit",
  }).exited;
  console.log("✓ systemd unit created and enabled");
} else {
  console.log("ℹ️  systemd not detected or not Linux; skipping systemd unit installation");
}

// ==========================================
// Step 3: Copy the binary to the destination
// ==========================================
console.log("");
console.log(`⚡ [3/4] Copying binary to ${targetPath}...`);
await mkdir(destDir, { recursive: true });

const tempTarget = path.join(destDir, `.${binName}.tmp.${process.pid}`);
await copyFile(sourcePath, tempTarget);
await chmod(tempTarget, 0o755);
await rename(tempTarget, targetPath);

const targetStat = await stat(targetPath);
const sizeMb = (targetStat.size / (1024 * 1024)).toFixed(2);
console.log(`✓ Binary installed successfully (${sizeMb} MB)`);

// ==========================================
// Step 4: Restart the binary
// ==========================================
console.log("");
console.log("⚡ [4/4] Restarting binary...");
if (shouldRestart) {
  if (systemdAvailable) {
    console.log("🔄 Restarting amble.service...");
    const restartProc = Bun.spawn(["systemctl", "--user", "restart", "amble.service"], {
      stdout: "inherit",
      stderr: "inherit",
    });
    const exitCode = await restartProc.exited;
    if (exitCode === 0) {
      console.log("✓ amble.service restarted successfully");
      const statusProc = Bun.spawn(
        ["systemctl", "--user", "status", "amble.service", "--no-pager", "--lines=5"],
        { stdout: "inherit", stderr: "inherit" }
      );
      await statusProc.exited;
    } else {
      console.warn(`⚠️ Failed to restart amble.service (exit code ${exitCode})`);
    }
  } else {
    console.log("ℹ️  systemd not active; restart the binary directly:");
    console.log(`   ${targetPath}`);
  }
} else {
  console.log("ℹ️  Restart skipped (--no-restart passed)");
}

console.log("");
console.log("🎉 Deployment complete!");
console.log(`   Binary:   ${targetPath}`);
if (systemdAvailable) {
  console.log("   Service:  systemctl --user status amble");
}
console.log("");
