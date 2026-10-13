import { describe, expect, it } from "vitest";
import { contentProvenanceCheckSchema } from "@/lib/openai/schema";
import { deriveOverallVerdict, normalizeOpenAIProvenanceCheck } from "@/lib/provenance/normalize";
import type { SignalResult } from "@/lib/provenance/types";
import { DETECTED_RESPONSE, NOT_DETECTED_RESPONSE } from "./fixtures";

const signal = (kind: SignalResult["kind"], status: SignalResult["status"]): SignalResult => ({
  kind,
  status,
  validationState: null,
  issuer: null,
  model: null,
  generatedAt: null,
});

describe("deriveOverallVerdict", () => {
  it("is detected when any signal is detected", () => {
    expect(deriveOverallVerdict([signal("synthid", "detected"), signal("c2pa", "not_detected")])).toBe("detected");
    expect(deriveOverallVerdict([signal("synthid", "unavailable"), signal("c2pa", "detected")])).toBe("detected");
  });

  it("is not_detected only when every signal was checked", () => {
    expect(deriveOverallVerdict([signal("synthid", "not_detected"), signal("c2pa", "not_detected")])).toBe(
      "not_detected",
    );
  });

  it("is inconclusive when a signal is missing and nothing was detected", () => {
    expect(deriveOverallVerdict([signal("synthid", "not_detected"), signal("c2pa", "unavailable")])).toBe(
      "inconclusive",
    );
    expect(deriveOverallVerdict([])).toBe("inconclusive");
  });
});

describe("normalizeOpenAIProvenanceCheck", () => {
  it("maps both signals independently", () => {
    const { signals, overall } = normalizeOpenAIProvenanceCheck(contentProvenanceCheckSchema.parse(DETECTED_RESPONSE));
    expect(overall).toBe("detected");
    expect(signals).toEqual([
      {
        kind: "synthid",
        status: "detected",
        validationState: null,
        issuer: null,
        model: "gpt-image-2",
        generatedAt: "2026-10-01T09:30:00Z",
      },
      {
        kind: "c2pa",
        status: "detected",
        validationState: "trusted",
        issuer: "OpenAI",
        model: "gpt-image-2",
        generatedAt: "2026-10-01T09:30:00Z",
      },
    ]);
  });

  it("reports not_detected without inventing metadata", () => {
    const { signals, overall } = normalizeOpenAIProvenanceCheck(
      contentProvenanceCheckSchema.parse(NOT_DETECTED_RESPONSE),
    );
    expect(overall).toBe("not_detected");
    expect(signals.every((s) => s.model === null && s.issuer === null)).toBe(true);
  });

  it("marks missing signals as unavailable (e.g. audio-style responses)", () => {
    const { signals, overall } = normalizeOpenAIProvenanceCheck(
      contentProvenanceCheckSchema.parse({
        object: "content_provenance_check",
        created_at: 1,
        results: [{ type: "synthid", outcome: "not_detected", model: null, generated_at: null }],
      }),
    );
    expect(signals.find((s) => s.kind === "c2pa")?.status).toBe("unavailable");
    expect(overall).toBe("inconclusive");
  });

  it("ignores unknown result types and tolerates omitted optional fields", () => {
    const parsed = contentProvenanceCheckSchema.parse({
      object: "content_provenance_check",
      created_at: 1,
      results: [
        { type: "future_signal", outcome: "detected", score: 0.9 },
        { type: "c2pa", outcome: "not_detected" },
        { type: "synthid", outcome: "detected" },
      ],
    });
    const { signals, overall } = normalizeOpenAIProvenanceCheck(parsed);
    expect(signals.map((s) => s.status)).toEqual(["detected", "not_detected"]);
    expect(signals[1]).toMatchObject({ validationState: null, issuer: null });
    expect(overall).toBe("detected");
  });
});

describe("contentProvenanceCheckSchema", () => {
  it("rejects malformed known signals", () => {
    const result = contentProvenanceCheckSchema.safeParse({
      object: "content_provenance_check",
      created_at: 1,
      results: [{ type: "c2pa", outcome: "maybe" }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects unexpected objects", () => {
    expect(contentProvenanceCheckSchema.safeParse({ object: "list", data: [] }).success).toBe(false);
  });
});
