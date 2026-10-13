import type { C2paResult, ContentProvenanceCheck, SynthIdResult } from "@/lib/openai/schema";
import type { OverallVerdict, SignalKind, SignalResult } from "./types";

export const SIGNAL_ORDER: readonly SignalKind[] = ["synthid", "c2pa"];

/**
 * Derives the overall verdict from independent signal results.
 *
 * - any signal detected            -> "detected"
 * - all signals checked, none hit  -> "not_detected"
 * - otherwise (missing signals)    -> "inconclusive"
 *
 * Note: "not_detected" is NOT evidence that the content was made by a human.
 */
export function deriveOverallVerdict(signals: readonly SignalResult[]): OverallVerdict {
  if (signals.some((s) => s.status === "detected")) return "detected";
  if (signals.length > 0 && signals.every((s) => s.status === "not_detected")) {
    return "not_detected";
  }
  return "inconclusive";
}

type ProviderResult = ContentProvenanceCheck["results"][number];

// The schema guarantees that entries typed "c2pa"/"synthid" match their strict shapes.
function isC2pa(result: ProviderResult): result is C2paResult {
  return result.type === "c2pa";
}

function isSynthId(result: ProviderResult): result is SynthIdResult {
  return result.type === "synthid";
}

function unavailable(kind: SignalKind): SignalResult {
  return {
    kind,
    status: "unavailable",
    validationState: null,
    issuer: null,
    model: null,
    generatedAt: null,
  };
}

/** Converts an OpenAI content provenance check into provider-agnostic signals. */
export function normalizeOpenAIProvenanceCheck(check: ContentProvenanceCheck): {
  signals: SignalResult[];
  overall: OverallVerdict;
} {
  const byKind = new Map<SignalKind, SignalResult>();

  for (const result of check.results) {
    if (isC2pa(result) && !byKind.has("c2pa")) {
      byKind.set("c2pa", {
        kind: "c2pa",
        status: result.outcome,
        validationState: result.validation_state,
        issuer: result.issuer,
        model: result.model,
        generatedAt: result.generated_at,
      });
    } else if (isSynthId(result) && !byKind.has("synthid")) {
      byKind.set("synthid", {
        kind: "synthid",
        status: result.outcome,
        validationState: null,
        issuer: null,
        model: result.model,
        generatedAt: result.generated_at,
      });
    }
  }

  const signals = SIGNAL_ORDER.map((kind) => byKind.get(kind) ?? unavailable(kind));
  return { signals, overall: deriveOverallVerdict(signals) };
}
