import { contentProvenanceCheckSchema } from "@/lib/openai/schema";
import { normalizeOpenAIProvenanceCheck } from "./normalize";
import { ProvenanceError, type ProvenanceProvider } from "./types";

/**
 * Mock provider for local development and tests. It returns payloads shaped
 * exactly like the OpenAI API and runs them through the same parsing and
 * normalization pipeline. Reports are clearly labelled as `mode: "mock"`.
 */

export const MOCK_SCENARIOS = [
  "detected",
  "c2pa_only",
  "synthid_only",
  "not_detected",
  "error_no_access",
  "error_rate_limited",
  "error_timeout",
] as const;
export type MockScenario = (typeof MOCK_SCENARIOS)[number];

export function isMockScenario(value: string | undefined): value is MockScenario {
  return (MOCK_SCENARIOS as readonly (string | undefined)[]).includes(value);
}

const DETECTED_C2PA = {
  type: "c2pa",
  outcome: "detected",
  validation_state: "trusted",
  issuer: "OpenAI",
  model: "gpt-image-2",
  generated_at: "2026-10-01T09:30:00Z",
};
const NOT_DETECTED_C2PA = {
  type: "c2pa",
  outcome: "not_detected",
  validation_state: "not_present",
  issuer: null,
  model: null,
  generated_at: null,
};
const DETECTED_SYNTHID = {
  type: "synthid",
  outcome: "detected",
  model: "gpt-image-2",
  generated_at: "2026-10-01T09:30:00Z",
};
const NOT_DETECTED_SYNTHID = {
  type: "synthid",
  outcome: "not_detected",
  model: null,
  generated_at: null,
};

export function buildMockPayload(scenario: MockScenario, createdAt: number) {
  const results = {
    detected: [DETECTED_C2PA, DETECTED_SYNTHID],
    c2pa_only: [DETECTED_C2PA, NOT_DETECTED_SYNTHID],
    synthid_only: [NOT_DETECTED_C2PA, DETECTED_SYNTHID],
    not_detected: [NOT_DETECTED_C2PA, NOT_DETECTED_SYNTHID],
  } satisfies Partial<Record<MockScenario, unknown[]>>;

  if (!(scenario in results)) return null;
  return {
    object: "content_provenance_check",
    created_at: createdAt,
    results: results[scenario as keyof typeof results],
  };
}

export function createMockProvenanceProvider(options: {
  scenario?: MockScenario;
  delayMs?: number;
  now?: () => Date;
} = {}): ProvenanceProvider {
  const scenario = options.scenario ?? "detected";
  const delayMs = options.delayMs ?? 600;
  const now = options.now ?? (() => new Date());

  return {
    id: "mock",
    name: "Mock Provider",
    mode: "mock",

    async verify(_file, { signal } = {}) {
      await sleep(delayMs, signal);

      switch (scenario) {
        case "error_no_access":
          throw new ProvenanceError(
            "no_access",
            "[モック] この組織は Content Provenance API へのアクセス権を持っていない可能性があります。検証は実行されていません。",
            { upstreamStatus: 404 },
          );
        case "error_rate_limited":
          throw new ProvenanceError(
            "rate_limited",
            "[モック] OpenAI API のレート制限に達しました。しばらく待ってから再試行してください。",
            { upstreamStatus: 429, retryAfter: 30 },
          );
        case "error_timeout":
          throw new ProvenanceError("timeout", "[モック] OpenAI API の応答がタイムアウトしました。");
      }

      const date = now();
      const raw = buildMockPayload(scenario, Math.floor(date.getTime() / 1000));
      const parsed = contentProvenanceCheckSchema.parse(raw);
      const { signals, overall } = normalizeOpenAIProvenanceCheck(parsed);
      return {
        provider: { id: "mock", name: "Mock Provider", mode: "mock" },
        overall,
        signals,
        checkedAt: date.toISOString(),
        raw,
      };
    },
  };
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(new ProvenanceError("network_error", "リクエストが中断されました。"));
      },
      { once: true },
    );
  });
}
