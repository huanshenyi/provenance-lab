# Provenance Lab

画像に含まれる AI 生成コンテンツの来歴情報（**C2PA** / **SynthID**）を、[OpenAI Content Provenance API](https://developers.openai.com/api/docs/guides/content-provenance) で検証する開発者向け Web アプリ（PoC）です。

画像をドラッグ＆ドロップして「検証を開始」を押すと、総合ステータス・SynthID・C2PA の結果と、API の生 JSON を 1 ページ内で確認できます。

- Next.js 16（App Router）/ TypeScript strict / Tailwind CSS v4 / shadcn/ui（Base UI）/ Lucide / Zod / pnpm
- データベース・認証・画像の永続保存はありません

## 必要な環境変数

`.env.example` を `.env.local` にコピーして設定します。

| 変数 | 必須 | 既定値 | 説明 |
| --- | --- | --- | --- |
| `OPENAI_API_KEY` | live モードでは必須 | — | OpenAI API キー。サーバー側（Route Handler）でのみ使用され、ブラウザには送られません |
| `PROVENANCE_PROVIDER` | | `openai` | `openai`（実 API）または `mock`（ダミー応答） |
| `PROVENANCE_MOCK_SCENARIO` | | `detected` | mock 時の応答: `detected` / `c2pa_only` / `synthid_only` / `not_detected` / `error_no_access` / `error_rate_limited` / `error_timeout` |
| `OPENAI_BASE_URL` | | `https://api.openai.com/v1` | API のベース URL |
| `OPENAI_TIMEOUT_MS` | | `30000` | OpenAI API 呼び出しのタイムアウト（ミリ秒） |
| `RATE_LIMIT_PER_MINUTE` | | `10` | `/api/verify` のクライアント（IP）ごとの 1 分あたり上限 |
| `NEXT_PUBLIC_GITHUB_URL` | | — | 設定するとヘッダーに GitHub リンクを表示（ビルド時に埋め込まれます） |

> `OPENAI_API_KEY` が未設定でも mock に自動で切り替わることはありません。結果を捏造しないため、明示的に `PROVENANCE_PROVIDER=mock` を指定した場合のみダミー応答を返し、UI 上にも「モックモード」と表示します。

## ローカル起動

```bash
pnpm install
cp .env.example .env.local   # OPENAI_API_KEY を設定
pnpm dev                     # http://localhost:3000
```

API キーなしで UI を試す場合:

```bash
PROVENANCE_PROVIDER=mock PROVENANCE_MOCK_SCENARIO=not_detected pnpm dev
```

### チェック

```bash
pnpm typecheck   # tsc --noEmit
pnpm lint        # ESLint
pnpm test        # Vitest（実 API に依存しないモックテスト）
pnpm build
pnpm check       # 上記すべて
```

## API の利用方法

ブラウザは自アプリの `POST /api/verify` のみを呼び出し、サーバーが OpenAI の `POST https://api.openai.com/v1/content_provenance_checks` に `multipart/form-data`（フィールド名 `file`）で転送します。

```bash
curl -F "file=@image.png;type=image/png" http://localhost:3000/api/verify
```

成功時（HTTP 200）:

```jsonc
{
  "ok": true,
  "report": {
    "provider": { "id": "openai", "name": "OpenAI Content Provenance", "mode": "live" },
    "overall": "detected",            // detected | not_detected | inconclusive
    "signals": [
      { "kind": "synthid", "status": "detected", "validationState": null, "issuer": null, "model": "...", "generatedAt": "..." },
      { "kind": "c2pa", "status": "detected", "validationState": "trusted", "issuer": "OpenAI", "model": "...", "generatedAt": "..." }
    ],
    "checkedAt": "2026-10-13T00:00:00.000Z",
    "raw": { /* OpenAI API のレスポンスそのもの */ }
  }
}
```

失敗時:

```json
{ "ok": false, "error": { "code": "no_access", "message": "…", "retryAfter": null, "upstreamStatus": 404 } }
```

| `error.code` | HTTP | 主な原因 |
| --- | --- | --- |
| `invalid_request` | 400 | `file` がない、空ファイル、multipart でない |
| `unsupported_file_type` | 415 | PNG / JPEG / WebP 以外、または中身（マジックバイト）と MIME が不一致 |
| `file_too_large` | 413 | 50 MiB 超 |
| `rejected_by_provider` | 422 | OpenAI が 400 を返した（破損・非対応・ブロック対象） |
| `not_configured` | 503 | `OPENAI_API_KEY` 未設定など |
| `unauthorized` / `forbidden` / `no_access` | 502 | OpenAI が 401 / 403 / 404（組織にアクセス権なし）を返した |
| `rate_limited` | 429 | 本アプリまたは OpenAI のレート制限。`Retry-After` ヘッダーを付与 |
| `timeout` | 504 | OpenAI の応答がタイムアウト |
| `network_error` / `upstream_error` / `invalid_response` | 502 | 通信障害、OpenAI の 5xx、想定外のレスポンス形式 |

## 検出結果の解釈

| 総合ステータス | 意味 |
| --- | --- |
| **OpenAI 由来の来歴シグナルを検出** | SynthID または C2PA の少なくとも一方が `detected` |
| **対応シグナルは検出されず** | SynthID と C2PA の両方が `not_detected` |
| **検証できなかった** | API エラー、またはレスポンスにシグナルが欠けていた |

- **SynthID**: ピクセルに埋め込まれた不可視の透かし。一部の編集・変換後も残る場合があります。
- **C2PA**: ファイルに付与される署名付きメタデータ。スクリーンショットや再保存、形式変換で失われやすいです。OpenAI のドキュメントによると、C2PA の `detected` は `trusted` または `valid` なマニフェストが OpenAI を発行者として示す場合に限られます。`validation_state` は `trusted` / `valid` / `invalid` / `not_present`。
- 2 つのシグナルは独立して表示します。片方だけ検出されることは普通にあります。
- **`not_detected` は人間が制作した証拠ではありません。** 他社の AI モデルで生成された画像や、メタデータが削除された画像は検出されません。UI でも「AI 生成ではない」とは表示しません。

## アーキテクチャ

```
src/
├─ app/
│  ├─ page.tsx                     メイン画面（シングルページ）
│  └─ api/verify/route.ts          検証 API（Route Handler）
├─ components/
│  ├─ provenance-workbench.tsx     画面の状態管理（選択・検証・結果）
│  ├─ image-uploader.tsx           D&D / ファイル選択 / プレビュー
│  ├─ verification-result.tsx      総合判定・メタデータ・Raw JSON
│  ├─ provenance-card.tsx          SynthID / C2PA の個別カード
│  └─ raw-json-panel.tsx           開閉式 JSON パネル＋コピー
└─ lib/
   ├─ openai/schema.ts             OpenAI レスポンスの Zod スキーマ
   ├─ openai/provenance.ts         OpenAI API クライアント（server-only）
   ├─ provenance/types.ts          プロバイダー非依存の型・Zod スキーマ
   ├─ provenance/normalize.ts      OpenAI 応答 → 共通形式への正規化
   ├─ provenance/provider.ts       環境変数によるプロバイダー選択（openai / mock）
   ├─ provenance/mock-provider.ts  モックプロバイダー
   ├─ provenance/verify-handler.ts 入力検証・レート制限・エラー変換
   └─ provenance/file-validation.ts 形式・サイズ・マジックバイト検証（クライアント／サーバー共通）
```

UI は `VerificationReport`（プロバイダー非依存の型）だけに依存します。他社の検証 API を追加するときは、`ProvenanceProvider` インターフェースを実装して `provider.ts` に登録すれば済みます。

### セキュリティ・データの扱い

- API キーはサーバーのみで使用（`server-only` でクライアントバンドルへの混入を防止）
- 形式（MIME とマジックバイト）とサイズ（50 MiB）をクライアントとサーバーの両方で検証。`Content-Length` が大きすぎるリクエストは本文を読む前に拒否
- アップロード画像はリクエスト処理中のメモリ上にのみ保持し、ディスク保存やログ出力はしない（ログに残すのはエラーコードのみ）
- OpenAI 呼び出しにはタイムアウトを設定し、クライアントの切断時には中断
- ブラウザのプレビュー用 Object URL は、画像の差し替え・削除・アンマウント時に解放

## API アクセス制限と既知の制約

- **実 API 検証の状況（未検証あり）**: 開発時は Content Provenance API へのアクセス権を持つ API キーがなかったため、**実際の検出レスポンスでのエンドツーエンド確認は行っていません。** 確認できているのは次の 3 点です。
  - 無効なキーで実エンドポイントにリクエストが届き、401 が `unauthorized` として表示されること
  - 公式ドキュメントのレスポンス形式に沿ったモックで、パース・正規化・UI 表示が動くこと
  - 各エラー（400/401/403/404/429/5xx/タイムアウト/不正な応答）の扱いがユニットテストで通ること

  アクセス権のあるキーで試して形式の違いが見つかった場合は、`src/lib/openai/schema.ts` を修正してください。
- OpenAI の Content Provenance API は組織単位でアクセス権が必要です。権限がない組織には **404** が返り、本アプリでは「API へのアクセス権がありません」と表示します（検出結果は表示しません）。
- OpenAI 側の既定レート制限は厳しめです。429 の場合は `Retry-After` に従ってください。上限の引き上げは OpenAI に申請が必要です。
- 1 リクエストにつき 1 ファイル、50 MiB まで。本アプリは画像（PNG / JPEG / WebP）のみに対応しています（API 自体は音声にも対応）。
- 本アプリのレート制限はプロセス内メモリで実装しているため、インスタンスごとにしか効きません。外部公開する場合は Redis などの共有ストアや CDN / WAF のレート制限を併用してください。また `X-Forwarded-For` は信頼できるリバースプロキシの背後でのみ有効です。
- 検出できるのは OpenAI 由来のシグナルのみです。検証結果は判断材料の一つであり、真正性を保証するものではありません。
