"use client";

import { CircleAlert, Loader2, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { ImageUploader, type SelectedImage } from "@/components/image-uploader";
import { VerificationResult } from "@/components/verification-result";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { requestVerification } from "@/lib/provenance/client";
import { SIGNAL_INFO } from "@/lib/provenance/labels";
import type { SignalKind, VerificationError, VerificationReport } from "@/lib/provenance/types";

const SIGNAL_KINDS: SignalKind[] = ["synthid", "c2pa"];

type VerificationState =
  | { status: "idle" }
  | { status: "verifying" }
  | { status: "success"; report: VerificationReport }
  | { status: "error"; error: VerificationError };

export function ProvenanceWorkbench() {
  const [image, setImage] = useState<SelectedImage | null>(null);
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const [state, setState] = useState<VerificationState>({ status: "idle" });
  const abortRef = useRef<AbortController | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  const cancelInFlight = () => {
    abortRef.current?.abort();
    abortRef.current = null;
  };

  /** Replaces the selected image and revokes the previous preview URL. */
  const replaceImage = useCallback((file: File | null) => {
    cancelInFlight();
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    const previewUrl = file ? URL.createObjectURL(file) : null;
    previewUrlRef.current = previewUrl;
    setImage(file && previewUrl ? { file, previewUrl, dimensions: null } : null);
    setState({ status: "idle" });
    setSelectionError(null);
  }, []);

  // Release the preview URL and abort pending requests on unmount.
  useEffect(
    () => () => {
      abortRef.current?.abort();
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    },
    [],
  );

  /** On stacked (narrow) layouts the result is below the fold; bring it into view. */
  const revealResult = () => {
    const el = resultRef.current;
    if (!el) return;
    const { top } = el.getBoundingClientRect();
    if (top >= 0 && top < window.innerHeight / 2) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
  };

  const verify = async () => {
    if (!image) return;
    cancelInFlight();
    const controller = new AbortController();
    abortRef.current = controller;
    setState({ status: "verifying" });

    try {
      const result = await requestVerification(image.file, { signal: controller.signal });
      if (controller.signal.aborted) return;
      setState(result.ok ? { status: "success", report: result.report } : { status: "error", error: result.error });
      requestAnimationFrame(revealResult);
    } catch {
      // Aborted because the image changed; the new state has already been set.
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
    }
  };

  const isVerifying = state.status === "verifying";

  return (
    <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-10">
      {/* Left: the image under test. Sticky on wide screens so it stays beside the result. */}
      <section aria-label="検証する画像" className="space-y-4 lg:sticky lg:top-20">
        <ImageUploader
          selected={image}
          disabled={isVerifying}
          onSelect={replaceImage}
          onClear={() => replaceImage(null)}
          onError={setSelectionError}
          onDimensions={(dimensions) =>
            setImage((current) => (current ? { ...current, dimensions } : current))
          }
        />

        {selectionError ? (
          <Alert variant="destructive">
            <CircleAlert />
            <AlertTitle>このファイルは選択できません</AlertTitle>
            <AlertDescription>{selectionError}</AlertDescription>
          </Alert>
        ) : null}

        <div className="space-y-2.5">
          <Button size="lg" className="h-11 w-full" onClick={verify} disabled={!image || isVerifying}>
            {isVerifying ? <Loader2 className="animate-spin" /> : <ShieldCheck />}
            {isVerifying ? "検証中…" : "検証を開始"}
          </Button>
          <p className="text-xs leading-relaxed text-muted-foreground">
            画像はサーバーを経由して OpenAI API に送信され、本アプリでは保存しません。
          </p>
        </div>
      </section>

      {/* Right: the result for that image. */}
      <div ref={resultRef} className="min-w-0 scroll-mt-20" aria-live="polite">
        {state.status === "idle" ? <IdlePanel hasImage={image !== null} /> : null}
        {isVerifying ? <VerifyingPlaceholder /> : null}
        {state.status === "success" ? <VerificationResult report={state.report} onRetry={verify} /> : null}
        {state.status === "error" ? <VerificationResult error={state.error} onRetry={verify} /> : null}
      </div>
    </div>
  );
}

/** Before any result: says where it will appear and what the two signals are. */
function IdlePanel({ hasImage }: { hasImage: boolean }) {
  return (
    <div className="rounded-xl border border-dashed p-5 sm:p-6">
      <h2 className="text-lg font-semibold tracking-tight">検証結果</h2>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
        {hasImage
          ? "「検証を開始」を押すと、ここに結果が表示されます。"
          : "画像を選んで検証を開始すると、ここに結果が表示されます。"}
      </p>
      <dl className="mt-5 divide-y border-t">
        {SIGNAL_KINDS.map((kind) => (
          <div key={kind} className="py-3">
            <dt className="text-sm font-medium">{SIGNAL_INFO[kind].title}</dt>
            <dd className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{SIGNAL_INFO[kind].description}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** Mirrors the result layout so nothing jumps when the answer arrives. */
function VerifyingPlaceholder() {
  return (
    <div className="space-y-5" role="status">
      <div className="flex h-8 items-center gap-2.5 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        SynthID と C2PA を検証しています…
      </div>
      <div className="h-28 animate-pulse rounded-xl bg-muted" aria-hidden="true" />
      <div className="divide-y rounded-xl border" aria-hidden="true">
        {SIGNAL_KINDS.map((kind) => (
          <div key={kind} className="space-y-3 p-4 sm:p-5">
            <div className="h-5 w-24 animate-pulse rounded bg-muted" />
            <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
            <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}
