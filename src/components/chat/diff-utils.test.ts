import { describe, expect, test } from "bun:test";
import {
  countDiffStats,
  extractFilePathFromDiff,
  resolveDiffStats,
} from "./diff-utils";

describe("diff-utils", () => {
  test("counts unified diff additions and deletions without file headers", () => {
    expect(
      countDiffStats("--- a/src/file.ts\n+++ b/src/file.ts\n@@ -1 +1 @@\n-old\n+new"),
    ).toEqual({ additions: 1, deletions: 1 });
  });

  test("counts replacement strings as changed lines", () => {
    expect(resolveDiffStats({ oldString: "one\ntwo\n", newString: "three\n" })).toEqual({
      additions: 1,
      deletions: 2,
    });
  });

  test("counts lines in a newly written file", () => {
    expect(resolveDiffStats({ newString: "one\ntwo\n" })).toEqual({
      additions: 2,
      deletions: 0,
    });
  });

  test("prefers explicit stats when available", () => {
    expect(
      resolveDiffStats({
        diffText: "-old\n+new",
        additions: 166,
        deletions: 106,
      }),
    ).toEqual({ additions: 166, deletions: 106 });
  });

  test("extracts paths from apply_patch headers and unified diffs", () => {
    expect(extractFilePathFromDiff("*** Update File: src/app.ts\n@@")).toBe("src/app.ts");
    expect(extractFilePathFromDiff("--- a/src/app.ts\n+++ b/src/app.ts")).toBe("src/app.ts");
  });
});
