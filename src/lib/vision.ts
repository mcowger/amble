import type { AgentModel, ImageAttachment } from "./paseo/types";

// Maximum image size: 20MB
export const MAX_IMAGE_SIZE_BYTES = 20 * 1024 * 1024;

export const SUPPORTED_IMAGE_MIMES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
] as const;

/**
 * Known vision model patterns.
 * Modern multimodal models support image input.
 */
const VISION_MODEL_PATTERNS = [
  // Gemini: all 1.5, 2.0, 3.x Flash & Pro are natively multimodal
  /gemini/i,
  // Claude: all Claude 3, 3.5, 3.7, 4, 4.5, 5 models support vision
  /claude-(?:3|4|5|haiku|sonnet|opus|fable)/i,
  /claude-3/i,
  // OpenAI: GPT-4o, GPT-4-turbo, GPT-4.5, GPT-5, o1, o3
  /gpt-(?:4o|4-turbo|4\.5|5)/i,
  /\bo[13]\b/i,
  /\bo[13]-(?:mini|preview|full)\b/i,
  // Qwen VL
  /qwen.*(?:vl|vision)/i,
  /\bqvq\b/i,
  // Llama Vision
  /llama.*(?:vision|vl)/i,
  // Pixtral
  /pixtral/i,
  // Kimi K3 / VL
  /kimi-k3/i,
  /kimi.*(?:vl|vision)/i,
  // GLM Vision
  /glm-.*(?:v|vision)/i,
  // Generic keywords
  /vision/i,
  /multimodal/i,
  /\bvl\b/i,
];

/**
 * Known text-only model patterns that should NOT be considered vision capable,
 * even if their provider or name might otherwise match a looser rule.
 */
const TEXT_ONLY_MODEL_PATTERNS = [
  /deepseek-(?:v2|v3|v4|coder|chat)/i,
  /codellama/i,
  /text-embedding/i,
  /whisper/i,
  /glm-(?:5\.3|4|3)(?!.*(?:v|vision))/i,
  /muse-spark/i,
  /claude-(?:1|2|instant)/i,
  /gpt-3\.5/i,
  /gpt-4-(?!turbo|vision|o\b)/i,
];

/**
 * Determines whether a given model or model ID supports vision / image input.
 */
export function isModelVisionCapable(
  modelOrId: AgentModel | string | null | undefined,
  modelsList: AgentModel[] = [],
): boolean {
  if (!modelOrId) return false;

  let model: AgentModel | undefined;
  let modelIdStr = "";

  if (typeof modelOrId === "string") {
    modelIdStr = modelOrId;
    model =
      modelsList.find((m) => m.id === modelOrId) ||
      modelsList.find((m) => m.id.endsWith(`/${modelOrId}`)) ||
      modelsList.find((m) => m.name === modelOrId);
  } else {
    model = modelOrId;
    modelIdStr = model.id;
  }

  // 1. Explicit metadata checks if available
  if (model) {
    if (typeof model.supportsVision === "boolean") {
      return model.supportsVision;
    }

    const meta = model.metadata as Record<string, unknown> | undefined;
    if (meta) {
      if (typeof meta.supportsVision === "boolean") {
        return meta.supportsVision;
      }
      if (typeof meta.supportsAttachments === "boolean") {
        return meta.supportsAttachments;
      }
      if (Array.isArray(meta.input) && meta.input.includes("image")) {
        return true;
      }
      if (Array.isArray(meta.modalities) && meta.modalities.includes("image")) {
        return true;
      }
    }
  }

  // 2. Check if explicitly text-only pattern matches
  const targetString = `${modelIdStr} ${model?.displayName ?? ""} ${model?.name ?? ""}`.trim();
  for (const pattern of TEXT_ONLY_MODEL_PATTERNS) {
    if (pattern.test(targetString)) {
      return false;
    }
  }

  // 3. Check if vision pattern matches
  for (const pattern of VISION_MODEL_PATTERNS) {
    if (pattern.test(targetString)) {
      return true;
    }
  }

  return false;
}

/**
 * Validates whether a file is an acceptable image.
 */
export function isValidImageFile(file: File): { valid: boolean; error?: string } {
  if (!file.type.startsWith("image/")) {
    return { valid: false, error: "File must be an image (PNG, JPEG, WebP, GIF)" };
  }

  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
    return {
      valid: false,
      error: `Image size (${sizeMb}MB) exceeds maximum allowed (20MB)`,
    };
  }

  return { valid: true };
}

/**
 * Converts a browser File object to an ImageAttachment with base64 data.
 */
export async function fileToImageAttachment(file: File): Promise<ImageAttachment> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
  }
  const base64Data = btoa(binary);

  return {
    data: base64Data,
    mimeType: file.type || "image/png",
    name: file.name,
    size: file.size,
  };
}

/**
 * Extracts image files from a DragEvent.
 */
export function getImagesFromDragEvent(e: React.DragEvent): File[] {
  const files: File[] = [];
  if (e.dataTransfer.items) {
    for (let i = 0; i < e.dataTransfer.items.length; i++) {
      const item = e.dataTransfer.items[i];
      if (item && item.kind === "file" && item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) files.push(file);
      }
    }
  } else if (e.dataTransfer.files) {
    for (let i = 0; i < e.dataTransfer.files.length; i++) {
      const file = e.dataTransfer.files[i];
      if (file && file.type.startsWith("image/")) {
        files.push(file);
      }
    }
  }
  return files;
}

/**
 * Extracts image files from a ClipboardEvent.
 */
export function getImagesFromClipboard(e: React.ClipboardEvent): File[] {
  const files: File[] = [];
  if (e.clipboardData?.items) {
    for (let i = 0; i < e.clipboardData.items.length; i++) {
      const item = e.clipboardData.items[i];
      if (item && item.kind === "file" && item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) files.push(file);
      }
    }
  }
  return files;
}
