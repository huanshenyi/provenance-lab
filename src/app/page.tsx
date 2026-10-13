import { ProvenanceWorkbench } from "@/components/provenance-workbench";
import { SiteHeader } from "@/components/site-header";

export default function Home() {
  const githubUrl = process.env.NEXT_PUBLIC_GITHUB_URL?.trim() || undefined;

  return (
    <>
      <SiteHeader githubUrl={githubUrl} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
        <div className="mb-8 max-w-2xl space-y-3 sm:mb-10">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">画像の来歴を検証</h1>
          <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
            OpenAI Content Provenance API を使って、画像に OpenAI 由来の来歴シグナル（SynthID 透かし・C2PA
            メタデータ）が含まれているかを確認します。結果はシグナルごとに独立して表示されます。
          </p>
        </div>
        <ProvenanceWorkbench />
      </main>
      <footer className="border-t">
        <div className="mx-auto w-full max-w-6xl px-4 py-6 text-xs leading-relaxed text-muted-foreground sm:px-6">
          検出されなかった場合でも、AI 生成ではないことを意味しません。検証結果は判断材料の一つとしてご利用ください。
        </div>
      </footer>
    </>
  );
}
