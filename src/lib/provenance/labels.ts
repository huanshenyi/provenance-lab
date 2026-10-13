import type { OverallVerdict, SignalKind, SignalStatus, VerificationErrorCode } from "./types";

/** Japanese UI copy for verification results. Kept free of React so it can be tested. */

export const SIGNAL_INFO: Record<SignalKind, { title: string; description: string }> = {
  synthid: {
    title: "SynthID",
    description: "画像のピクセルに埋め込まれた不可視の電子透かし。一部の編集や変換後も残る場合があります。",
  },
  c2pa: {
    title: "C2PA",
    description: "ファイルに付与される署名付きメタデータ（Content Credentials）。編集や形式変換で失われることがあります。",
  },
};

export const SIGNAL_STATUS_LABEL: Record<SignalStatus, string> = {
  detected: "検出",
  not_detected: "未検出",
  unavailable: "結果なし",
};

export type OverallDisplayState = OverallVerdict | "error";

export const OVERALL_COPY: Record<OverallDisplayState, { title: string; description: string }> = {
  detected: {
    title: "OpenAI 由来の来歴シグナルを検出しました",
    description:
      "少なくとも 1 つの対応シグナル（SynthID または C2PA）が、この画像が OpenAI のモデルで生成または編集されたことを示しています。",
  },
  not_detected: {
    title: "対応する来歴シグナルは検出されませんでした",
    description:
      "OpenAI 由来の SynthID・C2PA は見つかりませんでした。これは人間が制作したことの証拠ではなく、「AI 生成ではない」とは断定できません。他社モデルの生成物や、メタデータが削除された画像の可能性もあります。",
  },
  inconclusive: {
    title: "検証できませんでした",
    description:
      "API から一部のシグナルの結果が返されなかったため、総合判定を確定できません。個別の結果と Raw JSON を確認してください。",
  },
  error: {
    title: "検証できませんでした",
    description: "検証処理が完了しなかったため、この画像の来歴については何も判定していません。",
  },
};

export const VALIDATION_STATE_LABEL: Record<string, string> = {
  trusted: "trusted（信頼済みの署名）",
  valid: "valid（有効な署名）",
  invalid: "invalid（署名が無効）",
  not_present: "not_present（マニフェストなし）",
};

export const ERROR_TITLE: Record<VerificationErrorCode, string> = {
  invalid_request: "リクエストが不正です",
  unsupported_file_type: "対応していないファイル形式です",
  file_too_large: "ファイルサイズが大きすぎます",
  rejected_by_provider: "API がファイルを受け付けませんでした",
  not_configured: "サーバーが未設定です",
  unauthorized: "認証エラー",
  forbidden: "権限不足",
  no_access: "API へのアクセス権がありません",
  rate_limited: "レート制限",
  timeout: "タイムアウト",
  network_error: "通信エラー",
  upstream_error: "API エラー",
  invalid_response: "予期しないレスポンス",
};

export function formatDateTime(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(date);
}
