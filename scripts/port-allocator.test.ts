import { describe, expect, it } from "bun:test";
import { spawnSync } from "node:child_process";
import path from "node:path";

const scriptPath = path.resolve(__dirname, "port-allocator.sh");

function runAllocator(args: string[] = [], env: Record<string, string> = {}) {
  const result = spawnSync(scriptPath, args, {
    env: { ...process.env, ...env },
    encoding: "utf8",
  });
  if (result.status !== 0) {
    throw new Error(`Script failed: ${result.stderr}`);
  }
  return result.stdout.trim();
}

describe("port-allocator", () => {
  it("outputs a valid TCP port number", () => {
    const portStr = runAllocator();
    expect(portStr).toMatch(/^\d+$/);
    const port = Number(portStr);
    expect(port).toBeGreaterThanOrEqual(1024);
    expect(port).toBeLessThanOrEqual(65535);
  });

  it("is deterministic for the same path", () => {
    const first = runAllocator(["dev", "ws-1", "branch", "/test/worktree/alpha"]);
    const second = runAllocator(["dev", "ws-1", "branch", "/test/worktree/alpha"]);
    expect(first).toBe(second);
  });

  it("produces different ports for different worktree paths", () => {
    const portA = runAllocator(["dev", "ws-1", "branch", "/test/worktree/alpha"]);
    const portB = runAllocator(["dev", "ws-2", "branch", "/test/worktree/beta"]);
    expect(portA).not.toBe(portB);
  });

  it("supports PASEO_WORKTREE_PATH environment variable", () => {
    const viaArg = runAllocator(["dev", "ws-1", "branch", "/test/worktree/gamma"]);
    const viaEnv = runAllocator([], { PASEO_WORKTREE_PATH: "/test/worktree/gamma" });
    expect(viaEnv).toBe(viaArg);
  });
});
