import { CircleCheck, CircleDashed, CircleMinus } from "lucide-react";
import { Fragment } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  formatDateTime,
  SIGNAL_INFO,
  SIGNAL_STATUS_LABEL,
  VALIDATION_STATE_LABEL,
} from "@/lib/provenance/labels";
import type { SignalResult, SignalStatus } from "@/lib/provenance/types";

const STATUS_STYLE: Record<SignalStatus, { icon: typeof CircleCheck; badge: string }> = {
  detected: {
    icon: CircleCheck,
    badge: "border-success/30 bg-success/10 text-success",
  },
  not_detected: {
    icon: CircleMinus,
    badge: "border-border bg-muted text-muted-foreground",
  },
  unavailable: {
    icon: CircleDashed,
    badge: "border-warning/30 bg-warning/10 text-warning",
  },
};

function fieldsFor(signal: SignalResult): { label: string; value: string | null; mono?: boolean; title?: string }[] {
  const generatedAt = { label: "生成日時", value: formatDateTime(signal.generatedAt), title: signal.generatedAt ?? undefined };
  if (signal.kind === "c2pa") {
    return [
      {
        label: "署名の検証状態",
        value: signal.validationState
          ? (VALIDATION_STATE_LABEL[signal.validationState] ?? signal.validationState)
          : null,
      },
      { label: "発行者", value: signal.issuer },
      { label: "モデル", value: signal.model, mono: true },
      generatedAt,
    ];
  }
  return [{ label: "モデル", value: signal.model, mono: true }, generatedAt];
}

/** One signal's result. Rendered as a section inside the shared signal list, not as its own card. */
export function ProvenanceSignal({ signal }: { signal: SignalResult }) {
  const info = SIGNAL_INFO[signal.kind];
  const style = STATUS_STYLE[signal.status];
  const Icon = style.icon;
  const headingId = `signal-${signal.kind}`;

  return (
    <section aria-labelledby={headingId} className="space-y-3 p-4 sm:p-5">
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-3">
          <h3 id={headingId} className="text-base font-semibold">
            {info.title}
          </h3>
          <Badge variant="outline" className={cn("h-6 gap-1 px-2.5", style.badge)}>
            <Icon aria-hidden="true" />
            {SIGNAL_STATUS_LABEL[signal.status]}
          </Badge>
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">{info.description}</p>
      </div>
      {signal.status === "unavailable" ? (
        <p className="text-sm text-muted-foreground">API のレスポンスにこのシグナルの結果が含まれていませんでした。</p>
      ) : (
        <dl className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-x-3 gap-y-2 text-sm">
          {fieldsFor(signal).map((field) => (
            <Fragment key={field.label}>
              <dt className="text-muted-foreground">{field.label}</dt>
              <dd
                className={cn("min-w-0 wrap-break-word tabular-nums", field.mono && "font-mono text-[0.8rem]")}
                title={field.title}
              >
                {field.value ?? <span className="text-muted-foreground">—</span>}
              </dd>
            </Fragment>
          ))}
        </dl>
      )}
    </section>
  );
}
