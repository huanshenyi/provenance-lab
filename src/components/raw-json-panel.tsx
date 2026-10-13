"use client";

import { Check, ChevronDown, Copy } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

type CopyState = "idle" | "copied" | "failed";

export function RawJsonPanel({
  data,
  title = "Raw JSON（API レスポンス）",
}: {
  data: unknown;
  title?: string;
}) {
  const json = useMemo(() => JSON.stringify(data, null, 2), [data]);
  const [copyState, setCopyState] = useState<CopyState>("idle");

  useEffect(() => {
    if (copyState === "idle") return;
    const timer = setTimeout(() => setCopyState("idle"), 2000);
    return () => clearTimeout(timer);
  }, [copyState]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(json);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
  };

  return (
    <Collapsible className="group/raw rounded-xl border bg-card">
      <div className="flex items-center justify-between gap-2 px-4 py-3">
        <CollapsibleTrigger
          render={
            <Button variant="ghost" size="sm" className="-ml-2">
              <ChevronDown
                className="transition-transform group-data-[panel-open]/button:rotate-180"
                aria-hidden="true"
              />
              {title}
            </Button>
          }
        />
        <Button variant="outline" size="sm" onClick={copy} aria-live="polite">
          {copyState === "copied" ? <Check /> : <Copy />}
          {copyState === "copied" ? "コピーしました" : copyState === "failed" ? "コピー失敗" : "コピー"}
        </Button>
      </div>
      <CollapsibleContent>
        <pre className="max-h-[28rem] overflow-auto border-t bg-muted/40 p-4 font-mono text-xs leading-relaxed">
          <code>{json}</code>
        </pre>
      </CollapsibleContent>
    </Collapsible>
  );
}
