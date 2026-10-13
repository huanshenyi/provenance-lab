import { verifyResponseSchema, type VerifyResponse } from "./types";

/** Browser-side client for this app's `POST /api/verify` route. */
export async function requestVerification(
  file: File,
  options: { signal?: AbortSignal; fetch?: typeof fetch } = {},
): Promise<VerifyResponse> {
  const doFetch = options.fetch ?? fetch;
  const body = new FormData();
  body.append("file", file, file.name);

  let response: Response;
  try {
    response = await doFetch("/api/verify", { method: "POST", body, signal: options.signal });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    return failure("network_error", "サーバーに接続できませんでした。ネットワーク接続を確認してください。");
  }

  let json: unknown;
  try {
    json = await response.json();
  } catch {
    return failure(
      response.status === 413 ? "file_too_large" : "upstream_error",
      `サーバーから予期しない応答がありました（HTTP ${response.status}）。`,
    );
  }

  const parsed = verifyResponseSchema.safeParse(json);
  if (!parsed.success) {
    return failure("invalid_response", "サーバーの応答形式が不正です。");
  }
  return parsed.data;
}

function failure(code: Extract<VerifyResponse, { ok: false }>["error"]["code"], message: string): VerifyResponse {
  return { ok: false, error: { code, message, retryAfter: null, upstreamStatus: null } };
}
