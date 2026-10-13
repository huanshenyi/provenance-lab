import { describe, expect, it } from "vitest";
import {
  detectImageType,
  formatBytes,
  MAX_FILE_SIZE_BYTES,
  validateFileMeta,
} from "@/lib/provenance/file-validation";
import { JPEG_HEADER, PNG_HEADER, WEBP_HEADER } from "./fixtures";

describe("validateFileMeta", () => {
  it("accepts supported types within the size limit", () => {
    expect(validateFileMeta({ type: "image/png", size: 10 })).toEqual({ ok: true, mimeType: "image/png" });
    expect(validateFileMeta({ type: "image/webp", size: MAX_FILE_SIZE_BYTES }).ok).toBe(true);
  });

  it("rejects unsupported types", () => {
    const result = validateFileMeta({ type: "image/gif", size: 10 });
    expect(result).toMatchObject({ ok: false, code: "unsupported_file_type" });
  });

  it("rejects files over 50 MiB", () => {
    const result = validateFileMeta({ type: "image/jpeg", size: MAX_FILE_SIZE_BYTES + 1 });
    expect(result).toMatchObject({ ok: false, code: "file_too_large" });
  });

  it("rejects empty files", () => {
    expect(validateFileMeta({ type: "image/png", size: 0 })).toMatchObject({ ok: false, code: "invalid_request" });
  });
});

describe("detectImageType", () => {
  it.each([
    [PNG_HEADER, "image/png"],
    [JPEG_HEADER, "image/jpeg"],
    [WEBP_HEADER, "image/webp"],
  ])("detects %s", (header, expected) => {
    expect(detectImageType(new Uint8Array(header))).toBe(expected);
  });

  it("returns null for other content", () => {
    expect(detectImageType(new TextEncoder().encode("GIF89a........"))).toBeNull();
    expect(detectImageType(new Uint8Array())).toBeNull();
  });
});

describe("formatBytes", () => {
  it("formats binary units", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1536)).toBe("1.5 KiB");
    expect(formatBytes(MAX_FILE_SIZE_BYTES)).toBe("50 MiB");
  });
});
