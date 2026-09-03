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
    expect(isModelVisionCapable("plexus/gemini-3.5-flash-lite")).toBe(true);
    expect(isModelVisionCapable("plexus/gemini-3.8-flash")).toBe(true);
    expect(isModelVisionCapable("gemini-2.0-flash")).toBe(true);
    expect(isModelVisionCapable("google/gemini-1.5-pro")).toBe(true);
  });

  test("identifies Muse models as vision capable", () => {
    expect(isModelVisionCapable("plexus/muse-spark-1.3")).toBe(true);
    expect(isModelVisionCapable("plexus/muse-spark-1.2")).toBe(true);
    expect(isModelVisionCapable("meta/muse-image")).toBe(true);
    expect(isModelVisionCapable("muse-spark")).toBe(true);
  });

  test("identifies other multimodal families without metadata", () => {
    expect(isModelVisionCapable("gpt-4o")).toBe(true);
    expect(isModelVisionCapable("gpt-5.6-luna")).toBe(true);
    expect(isModelVisionCapable("claude-3-5-sonnet-20241022")).toBe(true);
    expect(isModelVisionCapable("claude-sonnet-5")).toBe(true);
    expect(isModelVisionCapable("claude-haiku-4-5")).toBe(true);
    expect(isModelVisionCapable("kimi-k3")).toBe(true);
    expect(isModelVisionCapable("qwen-vl-max")).toBe(true);
    expect(isModelVisionCapable("pixtral-12b")).toBe(true);
  });

  test("identifies known text-only models correctly", () => {
    expect(isModelVisionCapable("plexus/deepseek-v4-flash-0731")).toBe(false);
    expect(isModelVisionCapable("deepseek-coder")).toBe(false);
    expect(isModelVisionCapable("text-embedding-3-large")).toBe(false);
    expect(isModelVisionCapable("whisper-large-v3")).toBe(false);
    expect(isModelVisionCapable("gpt-3.5-turbo")).toBe(false);
    expect(isModelVisionCapable("claude-2.1")).toBe(false);
    expect(isModelVisionCapable("codellama-34b")).toBe(false);
  });

  test("handles null, undefined, and empty inputs", () => {
    expect(isModelVisionCapable(null)).toBe(false);
    expect(isModelVisionCapable(undefined)).toBe(false);
    expect(isModelVisionCapable("")).toBe(false);
    expect(isModelVisionCapable("unknown-model-xyz")).toBe(false);
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
      {
        id: "plexus/muse-spark-1.3",
        name: "Meta: Muse Spark 1.3",
        displayName: "Muse Spark 1.3",
        provider: "plexus",
      },
    ];
    expect(isModelVisionCapable("opencode/gpt-4o", models)).toBe(true);
    // suffix match: "gpt-4o" resolves to "opencode/gpt-4o"
    expect(isModelVisionCapable("gpt-4o", models)).toBe(true);
    // name match
    expect(isModelVisionCapable("DeepSeek", models)).toBe(false);
    // muse model in models list
    expect(isModelVisionCapable("plexus/muse-spark-1.3", models)).toBe(true);
    expect(isModelVisionCapable("Muse Spark 1.3", models)).toBe(true);
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
      id: "custom/gemini-model-disabled",
      name: "Gemini Disabled",
      provider: "custom",
      supportsVision: false,
    };
    // supportsVision: false explicitly overrides gemini name heuristic
    expect(isModelVisionCapable(customTextOnly)).toBe(false);
  });

  test("honors Paseo metadata signals and overrides", () => {
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

    const withTextOnlyInputModality: AgentModel = {
      id: "some/gemini-text-only",
      name: "Gemini Text Only",
      provider: "custom",
      metadata: { input: ["text"] },
    };
    // Explicit text-only input array overrides name heuristic
    expect(isModelVisionCapable(withTextOnlyInputModality)).toBe(false);

    const withModalities: AgentModel = {
      id: "some/other-model",
      name: "Other Model",
      provider: "custom",
      metadata: { modalities: ["text", "image"] },
    };
    expect(isModelVisionCapable(withModalities)).toBe(true);

    const withModalitiesObject: AgentModel = {
      id: "some/obj-modalities-model",
      name: "Obj Model",
      provider: "custom",
      metadata: { modalities: { input: ["text", "image"] } },
    };
    expect(isModelVisionCapable(withModalitiesObject)).toBe(true);

    const textOnlyMeta: AgentModel = {
      id: "opencode/gemini-disabled",
      name: "Gemini Disabled",
      provider: "opencode",
      metadata: { supportsAttachments: false },
    };
    // Explicit supportsAttachments: false overrides name heuristic
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
