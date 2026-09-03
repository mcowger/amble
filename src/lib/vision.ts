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
 * Determines whether a given model supports vision / image input.
 *
 * The answer comes exclusively from Paseo's providers snapshot metadata.
 * Amble does no name-based guessing: if Paseo doesn't declare image
 * support, the model is treated as text-only.
 *
 * Honored signals (in order):
 * - `model.supportsVision`
 * - `model.metadata.supportsVision` / `model.metadata.supportsAttachments`
 *   (opencode provider reports `supportsAttachments`)
 * - `model.metadata.input` / `model.metadata.modalities` containing "image"
 */
export function isModelVisionCapable(
  modelOrId: AgentModel | string | null | undefined,
  modelsList: AgentModel[] = [],
): boolean {
  if (!modelOrId) return false;

  let model: AgentModel | undefined;

  if (typeof modelOrId === "string") {
    model =
      modelsList.find((m) => m.id === modelOrId) ||
      modelsList.find((m) => m.id.endsWith(`/${modelOrId}`)) ||
      modelsList.find((m) => m.name === modelOrId);
    if (!model) return false;
  } else {
    model = modelOrId;
  }

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
