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
 * Known vision / multimodal model patterns.
 * Modern multimodal models support image input.
 */
const VISION_MODEL_PATTERNS = [
  // Gemini: all 1.5, 2.0, 2.5, 3.x Flash, Pro, Ultra, Preview models are multimodal
  /gemini/i,
  // Meta Muse: multimodal models including muse-spark and muse-image
  /muse/i,
  // Claude: all Claude 3, 3.5, 3.7, 4, 4.5, 5 models (Haiku, Sonnet, Opus, Fable)
  /claude-(?:3|4|5|haiku|sonnet|opus|fable)/i,
  /claude-3/i,
  /claude/i,
  // OpenAI: GPT-4o, GPT-4-turbo, GPT-4.5, GPT-5, GPT-5.6 (luna, terra, sol), o1, o3
  /gpt-(?:4o|4-turbo|4\.5|5|5\.6)/i,
  /\bo[13]\b/i,
  /\bo[13]-(?:mini|preview|full)\b/i,
  // Qwen VL / QVQ
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
  // Other vision / multimodal models
  /internvl/i,
  /cogvlm/i,
  /minicpm-v/i,
  /llava/i,
  // Generic keywords
  /\bvision\b/i,
  /\bmultimodal\b/i,
  /\bvl\b/i,
];

/**
 * Known text-only model patterns that should NOT be considered vision capable,
 * unless explicit metadata indicates otherwise.
 * NOTE: muse is multimodal and MUST NOT be included here.
 */
const TEXT_ONLY_MODEL_PATTERNS = [
  /deepseek-(?:v2|v3|v4|coder|chat)(?!.*(?:vl|vision))/i,
  /codellama/i,
  /text-embedding/i,
  /\bembedding\b/i,
  /whisper/i,
  /glm-(?:5\.3|4|3)(?!.*(?:v|vision))/i,
  /claude-(?:1|2|instant)/i,
  /gpt-3\.5/i,
  /gpt-4-(?!turbo|vision|o\b)/i,
];

/**
 * Determines whether a given model supports vision / image input.
 *
 * Signals checked in order:
 * 1. Explicit model / Paseo metadata (`supportsVision`, `supportsAttachments`, `input`, `modalities`)
 * 2. When metadata is absent or unspecified (as with Plexus and custom Paseo providers):
 *    Intelligent detection based on model family, ID, and name (e.g. Gemini, Muse, Claude 3+, GPT-4o/5, etc.)
 */
export function isModelVisionCapable(
  modelOrId: AgentModel | string | null | undefined,
  modelsList: AgentModel[] = [],
): boolean {
  if (!modelOrId) return false;

  let model: AgentModel | undefined;
  let rawId = "";

  if (typeof modelOrId === "string") {
    rawId = modelOrId;
    model =
      modelsList.find((m) => m.id === modelOrId) ||
      modelsList.find((m) => m.id.endsWith(`/${modelOrId}`)) ||
      modelsList.find((m) => m.name === modelOrId) ||
      modelsList.find((m) => m.displayName === modelOrId);
  } else {
    model = modelOrId;
    rawId = model.id;
  }

  // 1. Explicit metadata checks
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
      if (Array.isArray(meta.input)) {
        if (meta.input.includes("image")) {
          return true;
        }
        if (meta.input.length > 0 && !meta.input.includes("image")) {
          return false;
        }
      } else if (typeof meta.input === "object" && meta.input !== null) {
        const inp = meta.input as Record<string, unknown>;
        if (inp.image === true) return true;
        if (inp.image === false && inp.text === true) return false;
      }

      if (Array.isArray(meta.modalities)) {
        if (meta.modalities.includes("image")) {
          return true;
        }
      } else if (typeof meta.modalities === "object" && meta.modalities !== null) {
        const mods = meta.modalities as Record<string, unknown>;
        if (Array.isArray(mods.input)) {
          if (mods.input.includes("image")) return true;
          if (mods.input.length > 0 && !mods.input.includes("image")) return false;
        }
        if (mods.image === true) return true;
      }
    }
  }

  // 2. Name & ID heuristics for providers without explicit capability flags
  const metaObj = model?.metadata as Record<string, unknown> | undefined;
  const targetString = [
    rawId,
    model?.id ?? "",
    model?.displayName ?? "",
    model?.name ?? "",
    (metaObj?.family as string) ?? "",
    (metaObj?.modelId as string) ?? "",
    (metaObj?.providerName as string) ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  if (!targetString.trim()) {
    return false;
  }

  // Check known text-only patterns first
  for (const pattern of TEXT_ONLY_MODEL_PATTERNS) {
    if (pattern.test(targetString)) {
      return false;
    }
  }

  // Check known vision patterns
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
