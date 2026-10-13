import { CircleAlert, CircleCheck, CircleHelp, FlaskConical, RotateCw, ShieldOff } from "lucide-react";
import { ProvenanceSignal } from "@/components/provenance-card";
import { RawJsonPanel } from "@/components/raw-json-panel";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ERROR_TITLE, formatDateTime, OVERALL_COPY, type OverallDisplayState } from "@/lib/provenance/labels";
import type { VerificationError, VerificationReport } from "@/lib/provenance/types";

type VerificationResultProps = {
  onRetry: () => void;
} & ({ report: VerificationReport; error?: never } | { error: VerificationError; report?: never });

const OVERALL_STYLE: Record<OverallDisplayState, { icon: typeof CircleCheck; panel: string; iconColor: string }> = {
  detected: { icon: CircleCheck, panel: "border-success/30 bg-success/5", iconColor: "text-success" },
  not_detected: { icon: CircleHelp, panel: "bg-card", iconColor: "text-muted-foreground" },
  inconclusive: { icon: CircleAlert, panel: "border-warning/30 bg-warning/5", iconColor: "text-warning" },
  error: { icon: ShieldOff, panel: "border-warning/30 bg-warning/5", iconColor: "text-warning" },
};

export function VerificationResult({ report, error, onRetry }: VerificationResultProps) {
  const state: OverallDisplayState = report ? report.overall : "error";
  const copy = OVERALL_COPY[state];
  const style = OVERALL_STYLE[state];
  const Icon = style.icon;

  return (
    <section aria-labelledby="result-heading" className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h2 id="result-heading" className="text-lg font-semibold tracking-tight">
          検証結果
        </h2>
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RotateCw />
          再検証
        </Button>
      </div>

      {/* Overall verdict: the answer, so it gets the largest type on the panel. */}
      <div className={cn("rounded-xl border p-5 sm:p-6", style.panel)} role="status">
        <div className="flex gap-3.5">
          <Icon className={cn("mt-0.5 size-6 shrink-0", style.iconColor)} aria-hidden="true" />
          <div className="space-y-1.5">
            <p className="text-lg leading-snug font-semibold text-balance sm:text-xl">{copy.title}</p>
            <p className="text-sm leading-relaxed text-muted-foreground">{copy.description}</p>
          </div>
        </div>
      </div>

      {error ? (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertTitle>{ERROR_TITLE[error.code]}</AlertTitle>
          <AlertDescription>
            <p>{error.message}</p>
            {error.retryAfter !== null ? <p className="tabular-nums">{error.retryAfter} 秒後に再試行できます。</p> : null}
            {error.upstreamStatus !== null ? (
              <p className="font-mono text-xs">upstream HTTP {error.upstreamStatus}</p>
            ) : null}
          </AlertDescription>
        </Alert>
      ) : null}

      {report ? (
        <>
          {report.provider.mode === "mock" ? (
            <Alert>
              <FlaskConical />
              <AlertTitle>モックモードの結果です</AlertTitle>
              <AlertDescription>
                PROVENANCE_PROVIDER=mock のため、OpenAI API は呼び出されていません。表示内容はダミーデータです。
              </AlertDescription>
            </Alert>
          ) : null}

          <div className="divide-y rounded-xl border bg-card">
            {report.signals.map((signal) => (
              <ProvenanceSignal key={signal.kind} signal={signal} />
            ))}
          </div>

          {report.overall !== "detected" ? (
            <p className="text-xs leading-relaxed text-muted-foreground">
              <span className="font-medium text-foreground">「未検出」の意味：</span>
              OpenAI 由来の対応シグナルが見つからなかったことだけを示します。C2PA
              はスクリーンショットや再保存で失われることがあり、他社の AI モデルで生成された画像はこの API の対象外です。
            </p>
          ) : null}

          <ReportMeta report={report} />
          <RawJsonPanel data={report.raw} />
        </>
      ) : (
        <RawJsonPanel data={{ ok: false, error }} title="Raw JSON（サーバーのエラー応答）" />
      )}
    </section>
  );
}

/** Provider and timestamp. File details already sit beside the preview, so they are not repeated here. */
function ReportMeta({ report }: { report: VerificationReport }) {
  return (
    <dl className="flex flex-wrap gap-x-6 gap-y-1.5 text-xs text-muted-foreground">
      <div className="flex items-center gap-2">
        <dt>検証プロバイダー</dt>
        <dd className="inline-flex items-center gap-1.5 text-foreground">
          {report.provider.name}
          <Badge variant={report.provider.mode === "mock" ? "secondary" : "outline"}>
            {report.provider.mode === "mock" ? "mock" : "live"}
          </Badge>
        </dd>
      </div>
      <div className="flex items-center gap-2">
        <dt>検証日時</dt>
        <dd className="text-foreground tabular-nums">{formatDateTime(report.checkedAt)}</dd>
      </div>
    </dl>
  );
}
