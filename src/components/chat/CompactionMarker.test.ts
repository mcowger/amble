import { describe, expect, test } from "bun:test";
import { getCompactionMarkerLabel } from "./CompactionMarker";

describe("getCompactionMarkerLabel", () => {
  test("returns loading label when status is loading", () => {
    expect(getCompactionMarkerLabel({ status: "loading" })).toBe("Compacting...");
  });

  test("returns auto compaction label when trigger is auto", () => {
    expect(
      getCompactionMarkerLabel({ status: "completed", trigger: "auto" }),
    ).toBe("Context automatically compacted");
  });

  test("returns manual compaction label when trigger is manual", () => {
    expect(
      getCompactionMarkerLabel({ status: "completed", trigger: "manual" }),
    ).toBe("Context manually compacted");
  });

  test("formats preTokens in thousands", () => {
    expect(
      getCompactionMarkerLabel({ status: "completed", preTokens: 12345 }),
    ).toBe("Context compacted (12k tokens)");
  });

  test("returns default completed label when no trigger or tokens specified", () => {
    expect(getCompactionMarkerLabel({ status: "completed" })).toBe(
      "Context compacted",
    );
  });
});
