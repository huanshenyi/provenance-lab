import { z } from "zod";

/**
 * Provider-agnostic verification model shared by the API route and the UI.
 * Provider-specific payloads (e.g. OpenAI) are normalized into these shapes
 * so that additional verification providers can be added later without
 * touching the UI.
 */

export const signalKindSchema = z.enum(["c2pa", "synthid"]);
export type SignalKind = z.infer<typeof signalKindSchema>;

/** `unavailable` = the provider did not return a result for this signal. */
export const signalStatusSchema = z.enum([
  "detected",
  "not_detected",
  "unavailable",
]);
export type SignalStatus = z.infer<typeof signalStatusSchema>;

export const signalResultSchema = z.object({
  kind: signalKindSchema,
  status: signalStatusSchema,
  /** C2PA manifest validation state (`trusted` / `valid` / `invalid` / `not_present`). */
  validationState: z.string().nullable(),
  issuer: z.string().nullable(),
  model: z.string().nullable(),
  /** ISO 8601 timestamp as returned by the provider. */
  generatedAt: z.string().nullable(),
});
export type SignalResult = z.infer<typeof signalResultSchema>;

export const overallVerdictSchema = z.enum([
  /** At least one supported provenance signal was detected. */
  "detected",
  /** Every supported signal was checked and none was detected. */
  "not_detected",
  /** The check completed but at least one signal could not be evaluated. */
  "inconclusive",
]);
export type OverallVerdict = z.infer<typeof overallVerdictSchema>;

export const providerModeSchema = z.enum(["live", "mock"]);
export type ProviderMode = z.infer<typeof providerModeSchema>;

export const verificationReportSchema = z.object({
  provider: z.object({
    id: z.string(),
    name: z.string(),
    mode: providerModeSchema,
  }),
  overall: overallVerdictSchema,
  signals: z.array(signalResultSchema),
  /** ISO 8601 timestamp of when the check was performed. */
  checkedAt: z.string(),
  /** Unmodified provider response for inspection in the UI. */
  raw: z.unknown(),
});
export type VerificationReport = z.infer<typeof verificationReportSchema>;

export const verificationErrorCodeSchema = z.enum([
  "invalid_request",
  "unsupported_file_type",
  "file_too_large",
  "rejected_by_provider",
  "not_configured",
  "unauthorized",
  "forbidden",
  "no_access",
  "rate_limited",
  "timeout",
  "network_error",
  "upstream_error",
  "invalid_response",
]);
export type VerificationErrorCode = z.infer<typeof verificationErrorCodeSchema>;

export const verificationErrorSchema = z.object({
  code: verificationErrorCodeSchema,
  message: z.string(),
  /** Seconds to wait before retrying (rate limits). */
  retryAfter: z.number().nullable(),
  /** HTTP status returned by the upstream provider, if any. */
  upstreamStatus: z.number().nullable(),
});
export type VerificationError = z.infer<typeof verificationErrorSchema>;

/** Response contract of `POST /api/verify`. */
export const verifyResponseSchema = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true), report: verificationReportSchema }),
  z.object({ ok: z.literal(false), error: verificationErrorSchema }),
]);
export type VerifyResponse = z.infer<typeof verifyResponseSchema>;

export class ProvenanceError extends Error {
  readonly code: VerificationErrorCode;
  readonly retryAfter: number | null;
  readonly upstreamStatus: number | null;

  constructor(
    code: VerificationErrorCode,
    message: string,
    options: { retryAfter?: number | null; upstreamStatus?: number | null } = {},
  ) {
    super(message);
    this.name = "ProvenanceError";
    this.code = code;
    this.retryAfter = options.retryAfter ?? null;
    this.upstreamStatus = options.upstreamStatus ?? null;
  }

  toJSON(): VerificationError {
    return {
      code: this.code,
      message: this.message,
      retryAfter: this.retryAfter,
      upstreamStatus: this.upstreamStatus,
    };
  }
}

/** A provenance verification backend (OpenAI, mock, future vendors). */
export interface ProvenanceProvider {
  readonly id: string;
  readonly name: string;
  readonly mode: ProviderMode;
  verify(file: File, options?: { signal?: AbortSignal }): Promise<VerificationReport>;
}
