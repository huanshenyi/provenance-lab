import "server-only";

import { createRateLimiter, getClientKey } from "@/lib/rate-limit";
import { detectImageType, MAX_FILE_SIZE_BYTES, validateFileMeta } from "./file-validation";
import {
  ProvenanceError,
  type ProvenanceProvider,
  type VerificationErrorCode,
  type VerifyResponse,
} from "./types";

/** Headroom for multipart boundaries and headers on top of the file itself. */
const MULTIPART_OVERHEAD_BYTES = 1024 * 1024;

const STATUS_BY_CODE: Record<VerificationErrorCode, number> = {
  invalid_request: 400,
  unsupported_file_type: 415,
  file_too_large: 413,
  rejected_by_provider: 422,
  not_configured: 503,
  unauthorized: 502,
  forbidden: 502,
  no_access: 502,
  rate_limited: 429,
  timeout: 504,
  network_error: 502,
  upstream_error: 502,
  invalid_response: 502,
};

export interface VerifyHandlerDeps {
  getProvider: () => ProvenanceProvider;
  rateLimiter: ReturnType<typeof createRateLimiter>;
}

/**
 * Framework-agnostic handler for `POST /api/verify`, kept separate from the
 * route file so that it can be unit-tested with injected dependencies.
 *
 * Uploaded files are kept only in memory for the duration of the request
 * and are never written to disk or logged.
 */
export function createVerifyHandler(deps: VerifyHandlerDeps) {
  return async function handle(request: Request): Promise<Response> {
    try {
      const rate = deps.rateLimiter.check(getClientKey(request.headers));
      if (!rate.allowed) {
        throw new ProvenanceError(
          "rate_limited",
          "短時間に多くのリクエストが送信されました。しばらく待ってから再試行してください。",
          { retryAfter: rate.retryAfter },
        );
      }

      const contentLength = Number(request.headers.get("content-length"));
      if (Number.isFinite(contentLength) && contentLength > MAX_FILE_SIZE_BYTES + MULTIPART_OVERHEAD_BYTES) {
        throw new ProvenanceError("file_too_large", "ファイルサイズが上限（50 MiB）を超えています。");
      }

      if (!request.headers.get("content-type")?.toLowerCase().startsWith("multipart/form-data")) {
        throw new ProvenanceError("invalid_request", "multipart/form-data で画像ファイルを送信してください。");
      }

      let form: FormData;
      try {
        form = await request.formData();
      } catch {
        throw new ProvenanceError("invalid_request", "フォームデータを解析できませんでした。");
      }

      const file = form.get("file");
      if (!(file instanceof File)) {
        throw new ProvenanceError("invalid_request", "`file` フィールドに画像ファイルを指定してください。");
      }

      const meta = validateFileMeta(file);
      if (!meta.ok) throw new ProvenanceError(meta.code, meta.message);

      // Do not trust the client-supplied MIME type: check the file signature.
      const header = new Uint8Array(await file.slice(0, 16).arrayBuffer());
      if (detectImageType(header) !== meta.mimeType) {
        throw new ProvenanceError(
          "unsupported_file_type",
          "ファイルの内容が PNG・JPEG・WebP のいずれとも一致しません。",
        );
      }

      const provider = deps.getProvider();
      const report = await provider.verify(file, { signal: request.signal });
      return json({ ok: true, report }, 200);
    } catch (error) {
      const provenanceError =
        error instanceof ProvenanceError
          ? error
          : new ProvenanceError("upstream_error", "予期しないエラーが発生しました。");

      // Log only the error code — never the file, its name, or the API key.
      if (!(error instanceof ProvenanceError)) {
        console.error("[verify] unexpected error", error instanceof Error ? error.name : typeof error);
      } else if (STATUS_BY_CODE[provenanceError.code] >= 500) {
        console.warn("[verify] provider error", provenanceError.code, provenanceError.upstreamStatus);
      }

      const headers: Record<string, string> = {};
      if (provenanceError.retryAfter !== null) {
        headers["Retry-After"] = String(provenanceError.retryAfter);
      }
      return json({ ok: false, error: provenanceError.toJSON() }, STATUS_BY_CODE[provenanceError.code], headers);
    }
  };
}

function json(body: VerifyResponse, status: number, headers: Record<string, string> = {}): Response {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store", ...headers },
  });
}
