import "server-only";

import { createOpenAIProvenanceProvider, DEFAULT_TIMEOUT_MS } from "@/lib/openai/provenance";
import { createMockProvenanceProvider, isMockScenario } from "./mock-provider";
import { ProvenanceError, type ProvenanceProvider } from "./types";

type Env = Record<string, string | undefined>;

/**
 * Selects the verification provider from environment variables.
 *
 * - `PROVENANCE_PROVIDER=openai` (default): real OpenAI API, requires `OPENAI_API_KEY`.
 * - `PROVENANCE_PROVIDER=mock`: canned responses, labelled as mock in the UI.
 *
 * A missing API key never falls back to the mock provider, so results are
 * never fabricated.
 */
export function getProvenanceProvider(env: Env = process.env): ProvenanceProvider {
  const providerId = (env.PROVENANCE_PROVIDER ?? "openai").trim().toLowerCase();

  if (providerId === "mock") {
    const scenario = env.PROVENANCE_MOCK_SCENARIO?.trim();
    return createMockProvenanceProvider({
      scenario: isMockScenario(scenario) ? scenario : "detected",
    });
  }

  if (providerId !== "openai") {
    throw new ProvenanceError(
      "not_configured",
      `不明な PROVENANCE_PROVIDER です: "${providerId}"（openai または mock を指定してください）。`,
    );
  }

  const apiKey = env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new ProvenanceError(
      "not_configured",
      "サーバーに OPENAI_API_KEY が設定されていません。.env.local を確認してください。",
    );
  }

  const timeoutMs = Number(env.OPENAI_TIMEOUT_MS);
  return createOpenAIProvenanceProvider({
    apiKey,
    baseUrl: env.OPENAI_BASE_URL?.trim() || undefined,
    timeoutMs: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : DEFAULT_TIMEOUT_MS,
  });
}
