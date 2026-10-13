import "server-only";

import { normalizeOpenAIProvenanceCheck } from "@/lib/provenance/normalize";
import {
  ProvenanceError,
  type ProvenanceProvider,
  type VerificationReport,
} from "@/lib/provenance/types";
import { contentProvenanceCheckSchema, openAIErrorSchema } from "./schema";

export const DEFAULT_OPENAI_BASE_URL = "https://api.openai.com/v1";
export const DEFAULT_TIMEOUT_MS = 30_000;

export interface OpenAIProvenanceOptions {
  apiKey: string;
  baseUrl?: string;
  timeoutMs?: number;
  /** Injectable for tests. */
  fetch?: typeof fetch;
  now?: () => Date;
}

/**
 * Client for OpenAI's Content Provenance API.
 * https://developers.openai.com/api/docs/guides/content-provenance
 *
 * The API key is only ever used here, on the server.
 */
export function createOpenAIProvenanceProvider(
  options: OpenAIProvenanceOptions,
): ProvenanceProvider {
  const baseUrl = (options.baseUrl ?? DEFAULT_OPENAI_BASE_URL).replace(/\/+$/, "");
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const doFetch = options.fetch ?? fetch;
  const now = options.now ?? (() => new Date());

  return {
    id: "openai",
    name: "OpenAI Content Provenance",
    mode: "live",

    async verify(file, { signal } = {}): Promise<VerificationReport> {
      const body = new FormData();
      body.append("file", file, file.name || "upload");

      const timeoutSignal = AbortSignal.timeout(timeoutMs);
      const combinedSignal = signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;

      let response: Response;
      try {
        response = await doFetch(`${baseUrl}/content_provenance_checks`, {
          method: "POST",
          headers: { Authorization: `Bearer ${options.apiKey}` },
          body,
          signal: combinedSignal,
          cache: "no-store",
        });
      } catch {
        // The underlying error is intentionally not surfaced: it may contain request details.
        if (timeoutSignal.aborted) {
          throw new ProvenanceError(
            "timeout",
            `OpenAI API の応答が ${Math.round(timeoutMs / 1000)} 秒以内に返りませんでした。時間をおいて再試行してください。`,
          );
        }
        if (signal?.aborted) {
          throw new ProvenanceError("network_error", "リクエストが中断されました。");
        }
        throw new ProvenanceError(
          "network_error",
          "OpenAI API に接続できませんでした。ネットワーク接続を確認してください。",
        );
      }

      if (!response.ok) {
        throw await toProvenanceError(response);
      }

      let json: unknown;
      try {
        json = await response.json();
      } catch {
        throw new ProvenanceError("invalid_response", "OpenAI API のレスポンスを JSON として解析できませんでした。", {
          upstreamStatus: response.status,
        });
      }

      const parsed = contentProvenanceCheckSchema.safeParse(json);
      if (!parsed.success) {
        throw new ProvenanceError(
          "invalid_response",
          "OpenAI API のレスポンス形式が想定と異なります。API 仕様が変更された可能性があります。",
          { upstreamStatus: response.status },
        );
      }

      const { signals, overall } = normalizeOpenAIProvenanceCheck(parsed.data);
      return {
        provider: { id: "openai", name: "OpenAI Content Provenance", mode: "live" },
        overall,
        signals,
        checkedAt: new Date(parsed.data.created_at * 1000 || now().getTime()).toISOString(),
        raw: json,
      };
    },
  };
}

async function toProvenanceError(response: Response): Promise<ProvenanceError> {
  const upstreamStatus = response.status;
  const detail = await readUpstreamMessage(response);
  const withDetail = (message: string) => (detail ? `${message}（API: ${detail}）` : message);

  switch (upstreamStatus) {
    case 400:
    case 413:
    case 415:
    case 422:
      return new ProvenanceError(
        "rejected_by_provider",
        withDetail("OpenAI API がファイルを受け付けませんでした。破損・非対応・ブロック対象のファイルの可能性があります。"),
        { upstreamStatus },
      );
    case 401:
      return new ProvenanceError(
        "unauthorized",
        "OpenAI API の認証に失敗しました。サーバーの OPENAI_API_KEY を確認してください。",
        { upstreamStatus },
      );
    case 403:
      return new ProvenanceError(
        "forbidden",
        withDetail("この API キーには Content Provenance API を利用する権限がありません。"),
        { upstreamStatus },
      );
    case 404:
      return new ProvenanceError(
        "no_access",
        "この組織は Content Provenance API へのアクセス権を持っていない可能性があります。検証は実行されていません。",
        { upstreamStatus },
      );
    case 429:
      return new ProvenanceError(
        "rate_limited",
        "OpenAI API のレート制限に達しました。しばらく待ってから再試行してください。",
        { upstreamStatus, retryAfter: parseRetryAfter(response.headers.get("retry-after")) },
      );
    default:
      return new ProvenanceError(
        "upstream_error",
        `OpenAI API でエラーが発生しました（HTTP ${upstreamStatus}）。時間をおいて再試行してください。`,
        { upstreamStatus },
      );
  }
}

async function readUpstreamMessage(response: Response): Promise<string | null> {
  try {
    const parsed = openAIErrorSchema.safeParse(await response.json());
    const message = parsed.success ? parsed.data.error.message?.trim() : undefined;
    return message ? message.slice(0, 300) : null;
  } catch {
    return null;
  }
}

/** Parses `Retry-After` (delta-seconds or HTTP-date) into seconds. */
export function parseRetryAfter(value: string | null, now: Date = new Date()): number | null {
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.ceil(seconds);
  const date = Date.parse(value);
  if (Number.isNaN(date)) return null;
  return Math.max(0, Math.ceil((date - now.getTime()) / 1000));
}
