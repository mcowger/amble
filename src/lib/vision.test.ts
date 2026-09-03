import { describe, expect, test } from "bun:test";
import {
  isModelVisionCapable,
  isValidImageFile,
  fileToImageAttachment,
  MAX_IMAGE_SIZE_BYTES,
} from "./vision";
import type { AgentModel } from "./paseo/types";

describe("isModelVisionCapable", () => {
  test("identifies Gemini models as vision capable", () => {
    expect(isModelVisionCapable("plexus/gemini-3.1-pro-preview")).toBe(true);
    expect(isModelVisionCapable("plexus/gemini-3.8-flash")).toBe(true);
    expect(isModelVisionCapable("gemini-1.5-pro")).toBe(true);
  });

  test("identifies Claude modern models as vision capable", () => {
    expect(isModelVisionCapable("plexus/claude-haiku-4-5")).toBe(true);
    expect(isModelVisionCapable("plexus/claude-sonnet-5")).toBe(true);
    expect(isModelVisionCapable("claude-3-5-sonnet-20241022")).toBe(true);
    expect(isModelVisionCapable("plexus/claude-opus-5")).toBe(true);
  });

  test("identifies GPT-4o / GPT-5 models as vision capable", () => {
    expect(isModelVisionCapable("plexus/gpt-5.6-luna")).toBe(true);
    expect(isModelVisionCapable("gpt-4o")).toBe(true);
    expect(isModelVisionCapable("o1")).toBe(true);
  });

  test("identifies Kimi K3 as vision capable", () => {
    expect(isModelVisionCapable("plexus/kimi-k3")).toBe(true);
  });

  test("identifies text-only models as not vision capable", () => {
    expect(isModelVisionCapable("plexus/deepseek-v4-flash-0731")).toBe(false);
    expect(isModelVisionCapable("plexus/glm-5.3")).toBe(false);
    expect(isModelVisionCapable("plexus/muse-spark-1.3")).toBe(false);
    expect(isModelVisionCapable("deepseek-coder")).toBe(false);
    expect(isModelVisionCapable("claude-2.1")).toBe(false);
    expect(isModelVisionCapable("gpt-3.5-turbo")).toBe(false);
  });

  test("honors explicit metadata flags on model objects", () => {
    const customVision: AgentModel = {
      id: "custom/my-model",
      name: "My Model",
      provider: "custom",
      supportsVision: true,
    };
    expect(isModelVisionCapable(customVision)).toBe(true);

    const customTextOnly: AgentModel = {
      id: "custom/my-text-model",
      name: "My Text Model",
      provider: "custom",
      supportsVision: false,
    };
    expect(isModelVisionCapable(customTextOnly)).toBe(false);

    const withMetaAttachment: AgentModel = {
      id: "opencode/model-with-meta",
      name: "Model With Meta",
      provider: "opencode",
      metadata: {
        supportsAttachments: true,
      },
    };
    expect(isModelVisionCapable(withMetaAttachment)).toBe(true);
  });
});

describe("isValidImageFile", () => {
  test("accepts standard image types within size limit", () => {
    const pngFile = new File(["dummy content"], "test.png", { type: "image/png" });
    expect(isValidImageFile(pngFile)).toEqual({ valid: true });

    const jpegFile = new File(["dummy content"], "photo.jpg", { type: "image/jpeg" });
    expect(isValidImageFile(jpegFile)).toEqual({ valid: true });
  });

  test("rejects non-image files", () => {
    const textFile = new File(["hello world"], "notes.txt", { type: "text/plain" });
    const result = isValidImageFile(textFile);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("must be an image");
  });

  test("rejects files exceeding max size limit", () => {
    // Create a mock large file object
    const largeFile = {
      name: "huge.png",
      type: "image/png",
      size: MAX_IMAGE_SIZE_BYTES + 1024,
    } as File;

    const result = isValidImageFile(largeFile);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("exceeds maximum allowed");
  });
});

describe("fileToImageAttachment", () => {
  test("converts file to base64 attachment", async () => {
    const file = new File(["sample image bytes"], "sample.png", { type: "image/png" });
    const attachment = await fileToImageAttachment(file);

    expect(attachment.name).toBe("sample.png");
    expect(attachment.mimeType).toBe("image/png");
    expect(typeof attachment.data).toBe("string");
    expect(attachment.data.length).toBeGreaterThan(0);
    // Base64 without data URI prefix
    expect(attachment.data).not.toContain("data:image/png;base64,");
  });
});
