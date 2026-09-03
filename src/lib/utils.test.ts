import { describe, expect, test } from "bun:test";
import { formatRelativePath, stripCwdFromText } from "./utils";

describe("formatRelativePath", () => {
  test("strips cwd prefix from file path within cwd", () => {
    const cwd = "/home/matt.cowger/workspace/amble";
    const path = "/home/matt.cowger/workspace/amble/src/index.ts";
    expect(formatRelativePath(path, cwd)).toBe("src/index.ts");
  });

  test("handles path with line numbers", () => {
    const cwd = "/home/matt.cowger/workspace/amble";
    const path = "/home/matt.cowger/workspace/amble/src/context/WorkspaceContext.tsx (lines 1-50)";
    expect(formatRelativePath(path, cwd)).toBe("src/context/WorkspaceContext.tsx (lines 1-50)");
  });

  test("returns dot if path is identical to cwd", () => {
    const cwd = "/home/matt.cowger/workspace/amble";
    expect(formatRelativePath(cwd, cwd)).toBe(".");
  });

  test("leaves paths outside cwd unchanged", () => {
    const cwd = "/home/matt.cowger/workspace/amble";
    const path = "/tmp/opencode/screenshot.png";
    expect(formatRelativePath(path, cwd)).toBe("/tmp/opencode/screenshot.png");
  });

  test("handles empty cwd or path gracefully", () => {
    expect(formatRelativePath("src/index.ts")).toBe("src/index.ts");
    expect(formatRelativePath(undefined)).toBe("");
  });
});

describe("stripCwdFromText", () => {
  test("replaces all occurrences of cwd path with relative path", () => {
    const cwd = "/home/matt.cowger/workspace/amble";
    const text = "Found matches in /home/matt.cowger/workspace/amble/src/index.ts and /home/matt.cowger/workspace/amble/src/App.tsx";
    expect(stripCwdFromText(text, cwd)).toBe("Found matches in src/index.ts and src/App.tsx");
  });
});
