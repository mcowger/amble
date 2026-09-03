import { describe, expect, test } from "bun:test";
import { normalizeThoughtMarkdown } from "./MarkdownRenderer";

describe("normalizeThoughtMarkdown", () => {
  test("separates sequential bold thought chunks", () => {
    expect(normalizeThoughtMarkdown("**first thought****second thought**")).toBe(
      "**first thought**\n\n**second thought**",
    );
  });

  test("leaves ordinary thought text and code blocks unchanged", () => {
    const content = "Step by step\n```md\n**keep adjacent**\n```";

    expect(normalizeThoughtMarkdown(content)).toBe(content);
  });
});
