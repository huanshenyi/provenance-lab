export const PNG_HEADER = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
export const JPEG_HEADER = [0xff, 0xd8, 0xff, 0xe0];
export const WEBP_HEADER = [0x52, 0x49, 0x46, 0x46, 0x24, 0, 0, 0, 0x57, 0x45, 0x42, 0x50];

export function makeFile(header: number[], type: string, name = "image", padding = 32): File {
  const bytes = new Uint8Array(header.length + padding);
  bytes.set(header);
  return new File([bytes], name, { type });
}

export const DETECTED_RESPONSE = {
  object: "content_provenance_check",
  created_at: 1_790_000_000,
  results: [
    {
      type: "c2pa",
      outcome: "detected",
      validation_state: "trusted",
      issuer: "OpenAI",
      model: "gpt-image-2",
      generated_at: "2026-10-01T09:30:00Z",
    },
    { type: "synthid", outcome: "detected", model: "gpt-image-2", generated_at: "2026-10-01T09:30:00Z" },
  ],
};

export const NOT_DETECTED_RESPONSE = {
  object: "content_provenance_check",
  created_at: 1_790_000_000,
  results: [
    { type: "c2pa", outcome: "not_detected", validation_state: "not_present", issuer: null, model: null, generated_at: null },
    { type: "synthid", outcome: "not_detected", model: null, generated_at: null },
  ],
};
