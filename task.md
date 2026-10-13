# Project: Provenance Lab

## 目的

OpenAI Content Provenance APIを利用して、画像に含まれるAI生成コンテンツの来歴情報（C2PA / SynthID）を検出するWebアプリケーションを新規開発してください。

単なるAPIテストではなく、画像をアップロードして検証結果を直感的に確認できる、完成度の高いUIを持つPoCを作成します。

リポジトリ名は `provenance-lab` とします。

## 技術スタック

- Next.js（最新安定版、App Router）
- TypeScript（strict mode）
- Tailwind CSS
- shadcn/ui
- Lucide React
- Zod
- pnpm
- OpenAI Content Provenance API

初期段階ではデータベース、ユーザー認証、画像の永続保存は不要です。

## 主要機能

### 1. 画像アップロード

- PNG / JPEG / WebP対応
- ドラッグ＆ドロップ
- ファイル選択ボタン
- 画像プレビュー
- ファイル名、サイズ、形式の表示
- 最大ファイルサイズ50MiB
- 画像の削除・再選択
- 不正なファイル形式やサイズのエラー表示

### 2. Content Provenance API連携

Next.js Route Handlerを利用して、サーバー側からOpenAI公式APIを呼び出します。

エンドポイント：

`POST https://api.openai.com/v1/content_provenance_checks`

- `OPENAI_API_KEY`を環境変数から取得
- multipart/form-dataで画像ファイルを送信
- OpenAI APIキーをブラウザへ公開しない
- APIレスポンスを型安全に解析する
- C2PAとSynthIDの結果をそれぞれ処理する
- リクエスト失敗、認証エラー、権限不足、レート制限を適切に表示
- APIアクセス権がない場合は検出結果を捏造しない
- ファイルは必要以上に保持しない

実装前に公式ドキュメントを確認し、現行の仕様に準拠すること。

公式ドキュメント：
https://developers.openai.com/api/docs/guides/content-provenance

### 3. 検証結果

結果画面では以下を表示します。

**総合ステータス**
- OpenAI由来の対応する来歴シグナルを検出
- 対応シグナルが検出されなかった
- 検証できなかった

**SynthID**
- Detected / Not Detected
- モデル名（取得できる場合）
- 生成日時（取得できる場合）

**C2PA**
- Detected / Not Detected
- Validation State
- Issuer
- Model
- Generated At

C2PAとSynthIDは独立した検証結果として表示してください。

`not_detected` は人間が制作した証拠ではないため、「AI生成ではない」と断定しないこと。

APIが返した生のJSONを確認できる開閉式の詳細パネルも実装してください。JSONをコピーする機能も必要です。

## UI/UX

デザインコンセプトは、モダンでミニマルな開発者向け検証ツール。

- 日本語UI
- 白・グレーをベースにした落ち着いた配色
- ダークモード対応
- デスクトップとモバイルに対応
- 余白を十分に使ったレイアウト
- shadcn/uiのCard、Button、Badge、Alertなどを活用
- 過剰なアニメーションは不要

### 画面構成

**ヘッダー**
- Provenance Labのロゴ・タイトル
- テーマ切り替え
- GitHubリンク（URLが未設定なら非表示）

**メインエリア**
- 「画像の来歴を検証」という見出し
- 簡単な説明
- ドラッグ＆ドロップ用のアップロード領域
- 画像プレビュー
- 「検証を開始」ボタン
- 検証中のローディング表示

**結果エリア**
- 総合判定
- SynthID結果カード
- C2PA結果カード
- 検出されたメタデータ
- Raw JSON表示
- 再検証ボタン

画面遷移なしで、アップロードから検証結果まで完結するシングルページ構成にしてください。

## アーキテクチャ

想定する構成：

- `src/app/page.tsx` — メイン画面
- `src/app/api/verify/route.ts` — 検証API
- `src/components/image-uploader.tsx` — アップロードUI
- `src/components/verification-result.tsx` — 結果表示
- `src/components/provenance-card.tsx` — 個別検証カード
- `src/lib/openai/provenance.ts` — OpenAI API連携
- `src/lib/provenance/types.ts` — 型定義
- `src/lib/provenance/normalize.ts` — 検証結果の正規化

必要に応じて構成は調整して構いません。

将来的に他社の検証APIを追加できるよう、UIとAPIクライアントを分離してください。

## セキュリティ・品質

- APIキーはサーバー側だけで使用
- ファイル形式とサイズをサーバー側でも検証
- 不正なファイルや通信障害を適切に処理
- ブラウザで選択した画像のプレビューURLは適切に解放
- アップロードされた画像をログに記録しない
- OpenAI API呼び出しにタイムアウトを設定
- 外部公開時のレート制限を考慮
- TypeScript、ESLintまたはBiome、ビルドのチェックを通す
- 必要なユニットテストを用意する
- 実APIに依存しないモックテストを用意する

## 開発環境

`.env.example` に以下を定義します。

`OPENAI_API_KEY=`

READMEには次の内容を記載してください。

- プロジェクト概要
- 必要な環境変数
- ローカル起動方法
- APIの利用方法
- 検出結果の解釈
- APIアクセス制限と既知の制約

## 完了条件

1. `pnpm install`でセットアップ可能
2. `pnpm dev`でWeb UIが起動する
3. 画像を選択してプレビューできる
4. OpenAI公式APIに画像を送信できる
5. SynthIDとC2PAの結果を個別に表示できる
6. 検出されなかった場合とAPIエラーを区別できる
7. 生のAPIレスポンスを確認・コピーできる
8. モバイルでもUIが崩れない
9. 型チェックとビルドが成功する

まずプロジェクトを初期化し、必要なファイルを実装してください。

不明な仕様は公式ドキュメントを確認し、合理的な判断で進めてください。実APIの呼び出しが権限などの理由でできない場合は、モックと実API接続を切り替えられる構成にし、未検証の状態をREADMEに明記してください。