import { describe, expect, test } from "bun:test";
import {
  isModelVisionCapable,
  isValidImageFile,
  fileToImageAttachment,
  MAX_IMAGE_SIZE_BYTES,
} from "./vision";
import type { AgentModel } from "./paseo/types";

describe("isModelVisionCapable", () => {
  test("returns false without Paseo metadata, even for vision-sounding ids", () => {
    expect(isModelVisionCapable("plexus/gemini-3.1-pro-preview")).toBe(false);
    expect(isModelVisionCapable("gpt-4o")).toBe(false);
    expect(isModelVisionCapable("claude-3-5-sonnet-20241022")).toBe(false);
    expect(isModelVisionCapable(null)).toBe(false);
    expect(isModelVisionCapable(undefined)).toBe(false);
    expect(isModelVisionCapable("unknown-model-id")).toBe(false);
  });

  test("returns false for unknown string ids not present in the models list", () => {
    const models: AgentModel[] = [
      { id: "opencode/gemini", name: "Gemini", provider: "opencode" },
    ];
    expect(isModelVisionCapable("plexus/gemini-3.1-pro-preview", models)).toBe(false);
  });

  test("resolves string ids against the models list", () => {
    const models: AgentModel[] = [
      {
        id: "opencode/gpt-4o",
        name: "GPT-4o",
        provider: "opencode",
        metadata: { supportsAttachments: true },
      },
      {
        id: "opencode/deepseek-chat",
        name: "DeepSeek",
        provider: "opencode",
        metadata: { supportsAttachments: false },
      },
    ];
    expect(isModelVisionCapable("opencode/gpt-4o", models)).toBe(true);
    // suffix match: "gpt-4o" resolves to "opencode/gpt-4o"
    expect(isModelVisionCapable("gpt-4o", models)).toBe(true);
    // name match
    expect(isModelVisionCapable("DeepSeek", models)).toBe(false);
  });

  test("honors explicit supportsVision flag on model objects", () => {
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
  });

  test("honors Paseo metadata signals", () => {
    const withMetaAttachment: AgentModel = {
      id: "opencode/model-with-meta",
      name: "Model With Meta",
      provider: "opencode",
      metadata: {
        supportsAttachments: true,
      },
    };
    expect(isModelVisionCapable(withMetaAttachment)).toBe(true);

    const withMetaVision: AgentModel = {
      id: "opencode/vision-model",
      name: "Vision Model",
      provider: "opencode",
      metadata: { supportsVision: true },
    };
    expect(isModelVisionCapable(withMetaVision)).toBe(true);

    const withInputModality: AgentModel = {
      id: "some/image-model",
      name: "Image Model",
      provider: "custom",
      metadata: { input: ["text", "image"] },
    };
    expect(isModelVisionCapable(withInputModality)).toBe(true);

    const withModalities: AgentModel = {
      id: "some/other-model",
      name: "Other Model",
      provider: "custom",
      metadata: { modalities: ["text", "image"] },
    };
    expect(isModelVisionCapable(withModalities)).toBe(true);
  });

  test("treats models as text-only when Paseo declares no image support", () => {
    const noMeta: AgentModel = {
      id: "plexus/muse-spark-1.3",
      name: "Muse Spark",
      provider: "plexus",
    };
    expect(isModelVisionCapable(noMeta)).toBe(false);

    const textOnlyMeta: AgentModel = {
      id: "opencode/text-model",
      name: "Text Model",
      provider: "opencode",
      metadata: { supportsAttachments: false },
    };
    expect(isModelVisionCapable(textOnlyMeta)).toBe(false);
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
