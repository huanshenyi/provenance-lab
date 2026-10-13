/** Shared (client + server) upload constraints. */

export const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50 MiB

export const SUPPORTED_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
] as const;
export type SupportedMimeType = (typeof SUPPORTED_MIME_TYPES)[number];

export const ACCEPT_ATTRIBUTE = ".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp";

export const MIME_LABELS: Record<SupportedMimeType, string> = {
  "image/png": "PNG",
  "image/jpeg": "JPEG",
  "image/webp": "WebP",
};

export type FileValidationResult =
  | { ok: true; mimeType: SupportedMimeType }
  | { ok: false; code: "unsupported_file_type" | "file_too_large" | "invalid_request"; message: string };

export function isSupportedMimeType(type: string): type is SupportedMimeType {
  return (SUPPORTED_MIME_TYPES as readonly string[]).includes(type);
}

/** Validates file metadata (type + size). Used in the browser and on the server. */
export function validateFileMeta(file: { type: string; size: number }): FileValidationResult {
  if (file.size === 0) {
    return { ok: false, code: "invalid_request", message: "空のファイルは検証できません。" };
  }
  if (!isSupportedMimeType(file.type)) {
    return {
      ok: false,
      code: "unsupported_file_type",
      message: "対応していないファイル形式です。PNG・JPEG・WebP の画像を選択してください。",
    };
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return {
      ok: false,
      code: "file_too_large",
      message: `ファイルサイズが上限（${formatBytes(MAX_FILE_SIZE_BYTES)}）を超えています。`,
    };
  }
  return { ok: true, mimeType: file.type };
}

/** Detects the actual image format from the file signature ("magic bytes"). */
export function detectImageType(bytes: Uint8Array): SupportedMimeType | null {
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 12 &&
    ascii(bytes, 0, 4) === "RIFF" &&
    ascii(bytes, 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

function ascii(bytes: Uint8Array, start: number, end: number): string {
  return String.fromCharCode(...bytes.subarray(start, end));
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KiB", "MiB", "GiB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value >= 10 || Number.isInteger(value) ? 0 : 1)} ${units[unit]}`;
}
