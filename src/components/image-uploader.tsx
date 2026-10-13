"use client";

import { FileImage, ImageUp, RefreshCw, X } from "lucide-react";
import { useId, useRef, useState, type DragEvent } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ACCEPT_ATTRIBUTE,
  formatBytes,
  isSupportedMimeType,
  MAX_FILE_SIZE_BYTES,
  MIME_LABELS,
  validateFileMeta,
} from "@/lib/provenance/file-validation";

export interface SelectedImage {
  file: File;
  /** Object URL for the preview. Owned and revoked by the parent. */
  previewUrl: string;
  dimensions: { width: number; height: number } | null;
}

interface ImageUploaderProps {
  selected: SelectedImage | null;
  disabled?: boolean;
  onSelect: (file: File) => void;
  onClear: () => void;
  onError: (message: string) => void;
  onDimensions: (dimensions: { width: number; height: number }) => void;
}

export function ImageUploader({
  selected,
  disabled = false,
  onSelect,
  onClear,
  onError,
  onDimensions,
}: ImageUploaderProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    if (files.length > 1) {
      onError("一度に検証できる画像は 1 枚です。");
      return;
    }
    const file = files[0];
    const result = validateFileMeta(file);
    if (!result.ok) {
      onError(result.message);
      return;
    }
    onSelect(file);
  };

  const openPicker = () => {
    if (!disabled) inputRef.current?.click();
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    if (disabled) return;
    handleFiles(event.dataTransfer.files);
  };

  const input = (
    <input
      ref={inputRef}
      id={inputId}
      type="file"
      accept={ACCEPT_ATTRIBUTE}
      className="sr-only"
      tabIndex={-1}
      disabled={disabled}
      onChange={(event) => {
        handleFiles(event.target.files);
        // Allow re-selecting the same file after clearing it.
        event.target.value = "";
      }}
    />
  );

  if (selected) {
    const { file, previewUrl, dimensions } = selected;
    const formatLabel = isSupportedMimeType(file.type) ? MIME_LABELS[file.type] : file.type;

    return (
      <div className="overflow-hidden rounded-xl border bg-card">
        {input}
        <div className="flex items-center justify-center bg-muted/40 bg-[radial-gradient(var(--border)_1px,transparent_1px)] [background-size:16px_16px] p-4 sm:p-6">
          {/* A blob: URL cannot be optimized by next/image. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt={`選択した画像のプレビュー: ${file.name}`}
            className="max-h-[22rem] w-auto max-w-full rounded-md object-contain shadow-sm"
            onLoad={(event) => {
              const img = event.currentTarget;
              onDimensions({ width: img.naturalWidth, height: img.naturalHeight });
            }}
          />
        </div>
        <div className="flex flex-col gap-3 border-t p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <FileImage className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium" title={file.name}>
                {file.name}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground tabular-nums">
                <Badge variant="secondary">{formatLabel}</Badge>
                <span>{formatBytes(file.size)}</span>
                {dimensions ? (
                  <span>
                    · {dimensions.width} × {dimensions.height}px
                  </span>
                ) : null}
              </div>
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button variant="outline" size="sm" onClick={openPicker} disabled={disabled}>
              <RefreshCw />
              再選択
            </Button>
            <Button variant="ghost" size="sm" onClick={onClear} disabled={disabled}>
              <X />
              削除
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    // The zone is a mouse convenience; the button inside is the single keyboard/screen-reader control.
    <div
      onClick={openPicker}
      onDragEnter={(event) => {
        event.preventDefault();
        if (!disabled) setIsDragging(true);
      }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setIsDragging(false);
      }}
      onDrop={onDrop}
      className={cn(
        "flex cursor-pointer flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-input bg-card px-6 py-12 text-center transition-colors sm:py-16",
        "hover:border-primary/40 hover:bg-accent/50",
        isDragging && "border-primary/60 bg-accent",
        disabled && "pointer-events-none opacity-60",
      )}
    >
      {input}
      <div className="flex size-12 items-center justify-center rounded-full border bg-background">
        <ImageUp className="size-5 text-muted-foreground" aria-hidden="true" />
      </div>
      <div className="space-y-1">
        <p className="font-medium">
          {isDragging ? "ここにドロップして選択" : "画像をドラッグ＆ドロップ"}
        </p>
        <p className="text-sm text-muted-foreground">
          PNG・JPEG・WebP / 最大 {formatBytes(MAX_FILE_SIZE_BYTES)}
        </p>
      </div>
      <Button
        variant="outline"
        size="lg"
        disabled={disabled}
        onClick={(event) => {
          event.stopPropagation();
          openPicker();
        }}
      >
        ファイルを選択
      </Button>
    </div>
  );
}
