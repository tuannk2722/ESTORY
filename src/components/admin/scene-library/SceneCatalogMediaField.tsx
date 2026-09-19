"use client";

import {
  FileVideo2,
  ImageIcon,
  UploadCloud,
  X,
} from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type DragEvent,
} from "react";
import {
  acceptedImageContentTypes,
  BACKGROUND_VIDEO_MAX_BYTES,
  IMAGE_MAX_BYTES,
  MEBIBYTE,
} from "@/lib/media/constants";
import {
  SCENE_CATALOG_VIDEO_CONTENT_TYPES,
  validateSceneCatalogMediaFile,
  type SceneCatalogMediaKind,
} from "@/lib/media/scene-catalog-file";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < MEBIBYTE) return `${Math.round(bytes / 1024)} KiB`;
  return `${(bytes / MEBIBYTE).toFixed(bytes < 10 * MEBIBYTE ? 1 : 0)} MiB`;
}

function getFileName(url?: string): string | undefined {
  if (!url) return undefined;
  const raw = url.split("/").pop()?.split("?")[0];
  if (!raw) return undefined;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export default function SceneCatalogMediaField({
  id,
  label,
  kind,
  file,
  currentPreviewUrl,
  disabled = false,
  error,
  onFileChange,
  onFileError,
}: {
  id: string;
  label: string;
  kind: SceneCatalogMediaKind;
  file: File | null;
  currentPreviewUrl?: string;
  disabled?: boolean;
  error?: string;
  onFileChange: (file: File | null) => void;
  onFileError: (message: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const currentFileName = getFileName(currentPreviewUrl);
  const hasCurrent = Boolean(currentPreviewUrl);
  const accept = kind === "image"
    ? acceptedImageContentTypes.join(",")
    : SCENE_CATALOG_VIDEO_CONTENT_TYPES.join(",");
  const hint = kind === "image"
    ? `JPG, PNG hoặc WebP · Tối đa ${IMAGE_MAX_BYTES / MEBIBYTE} MiB`
    : `MP4 hoặc WebM · Tối đa ${BACKGROUND_VIDEO_MAX_BYTES / MEBIBYTE} MiB`;

  useEffect(() => {
    if (!file && inputRef.current) inputRef.current.value = "";
  }, [file, kind]);

  const choose = (next: File | null) => {
    if (!next) return;
    const message = validateSceneCatalogMediaFile(next, kind);
    onFileError(message);
    if (message) {
      onFileChange(null);
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    onFileChange(next);
  };

  const clearReplacement = () => {
    if (inputRef.current) inputRef.current.value = "";
    onFileChange(null);
    onFileError(null);
    inputRef.current?.focus();
  };

  const drop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    if (disabled) return;
    choose(event.dataTransfer.files[0] ?? null);
  };

  const Icon = kind === "image" ? ImageIcon : FileVideo2;
  const descriptionId = `${id}-description`;

  return (
    <div>
      <p className="text-sm font-semibold">{label}</p>
      <div
        onDragEnter={(event) => { event.preventDefault(); if (!disabled) setDragging(true); }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
        }}
        onDrop={drop}
        className={`mt-1.5 overflow-hidden rounded-2xl border bg-[var(--color-background)] transition-colors focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--color-ring)] ${error
          ? "border-[var(--color-destructive)]"
          : dragging
            ? "border-[var(--color-primary)] bg-[var(--color-primary)]/5"
            : "border-[var(--color-border)]"}`}
      >
        <div className="flex items-center justify-between gap-4 p-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-muted)] text-[var(--color-muted-foreground)]">
              <Icon aria-hidden="true" className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">
                {file ? file.name : currentFileName ?? `Kéo thả ${kind === "image" ? "ảnh" : "video"} vào đây hoặc chọn từ thiết bị.`}
              </p>
              <p id={descriptionId} className="text-xs text-[var(--color-muted-foreground)]">
                {file ? `${formatBytes(file.size)} · ${hint}` : hint}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <label
              htmlFor={id}
              className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-3 text-sm font-semibold transition-colors hover:bg-[var(--color-muted)] ${disabled ? "pointer-events-none opacity-50" : "cursor-pointer"}`}
            >
              <UploadCloud aria-hidden="true" className="h-4 w-4" />
              {file || hasCurrent ? "Đổi tệp" : "Chọn tệp"}
            </label>
            {file ? (
              <button
                type="button"
                onClick={clearReplacement}
                disabled={disabled}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)] disabled:opacity-50"
              >
                <X aria-hidden="true" className="h-4 w-4" />
                Xóa tệp
              </button>
            ) : null}
          </div>
        </div>

        <input
          ref={inputRef}
          id={id}
          type="file"
          accept={accept}
          disabled={disabled}
          aria-invalid={Boolean(error)}
          aria-describedby={`${descriptionId}${error ? ` ${id}-error` : ""}`}
          className="sr-only"
          onChange={(event) => choose(event.target.files?.[0] ?? null)}
        />
      </div>
    </div>
  );
}
