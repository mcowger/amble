import { describe, it, expect } from "bun:test";
import {
  cleanUserMessageText,
  matchesUserMessageItem,
  findMatchingAttachment,
  saveUserMessageAttachments,
  getCachedAgentAttachments,
  type PersistedUserAttachment,
} from "./attachmentStore";

describe("attachmentStore", () => {
  describe("cleanUserMessageText", () => {
    it("strips [Image] markers and trims whitespace", () => {
      expect(cleanUserMessageText("Hello world\n[Image]")).toBe("Hello world");
      expect(cleanUserMessageText("[image]")).toBe("");
      expect(cleanUserMessageText("  Prompt text   \n[IMAGE]\n  ")).toBe("Prompt text");
      expect(cleanUserMessageText(undefined)).toBe("");
    });
  });

  describe("matchesUserMessageItem", () => {
    it("matches identical messageId", () => {
      expect(
        matchesUserMessageItem(
          { messageId: "msg-123", text: "foo" },
          { messageId: "msg-123", text: "bar" },
        ),
      ).toBe(true);
    });

    it("matches clientMessageId with messageId", () => {
      expect(
        matchesUserMessageItem(
          { clientMessageId: "msg-123", text: "foo" },
          { messageId: "msg-123", text: "bar" },
        ),
      ).toBe(true);
    });

    it("matches text even when server appends [Image]", () => {
      expect(
        matchesUserMessageItem(
          { text: "Describe this photo" },
          { text: "Describe this photo\n[Image]" },
        ),
      ).toBe(true);
    });

    it("matches text with prefix/substring relationships", () => {
      expect(
        matchesUserMessageItem(
          { text: "Hello there" },
          { text: "Hello there!" },
        ),
      ).toBe(true);
    });

    it("does not match completely different text", () => {
      expect(
        matchesUserMessageItem(
          { text: "Fix this issue" },
          { text: "Run the build" },
        ),
      ).toBe(false);
    });
  });

  describe("findMatchingAttachment and saveUserMessageAttachments", () => {
    it("saves and retrieves from cache", async () => {
      const images = [{ data: "base64...", mimeType: "image/png", name: "test.png" }];
      await saveUserMessageAttachments("agent-1", "msg-abc", "Check this layout", images);

      const cached = getCachedAgentAttachments("agent-1");
      expect(cached.length).toBe(1);
      expect(cached[0]?.images).toEqual(images);

      const found = findMatchingAttachment(cached, {
        type: "user_message",
        text: "Check this layout\n[Image]",
      });
      expect(found).toBeDefined();
      expect(found?.images).toEqual(images);
    });
  });
});
