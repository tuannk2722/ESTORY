"use client";

import Image from "next/image";
import {
  ImagePlus,
  Loader2,
  RefreshCw,
  UploadCloud,
  X,
} from "lucide-react";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import { acceptedImageContentTypes, IMAGE_MAX_BYTES, MEBIBYTE } from "@/lib/media/constants";
import {
  coverObjectPosition,
  coverPositionForViewportPoint,
  normalizeCoverPosition,
} from "@/lib/story-cover";
import type { CoverPosition } from "@/types/story";
import type { CoverUploadState } from "./types";

interface CoverUploaderProps {
  file: File | null;
  previewUrl?: string;
  position: CoverPosition;
  error?: string;
  disabled?: boolean;
  upload: CoverUploadState;
  onFileChange(file: File | null): void;
  onFileError(message: string | null): void;
  onPositionChange(position: CoverPosition): void;
  onCancel?(): void;
  onRetry?(): void;
  inputId?: string;
  showUploadStatus?: boolean;
}

const ACCEPT = acceptedImageContentTypes.join(",");
const POSITION_STEP = 5;

interface DragSnapshot {
  pointerId: number;
  clientX: number;
  clientY: number;
  position: CoverPosition;
  overflowX: number;
  overflowY: number;
  moved: boolean;
}

function validateFile(file: File): string | null {
  if (!acceptedImageContentTypes.includes(file.type as (typeof acceptedImageContentTypes)[number])) {
    return "Ảnh bìa phải là tệp JPG, PNG hoặc WebP.";
  }
  if (file.size > IMAGE_MAX_BYTES) return `Ảnh bìa không được vượt quá ${IMAGE_MAX_BYTES / MEBIBYTE} MiB.`;
  if (file.size === 0) return "Ảnh bìa đang trống. Hãy chọn tệp khác.";
  return null;
}

function phaseLabel(upload: CoverUploadState): string | null {
  switch (upload.phase) {
    case "requesting-url": return "Đang chuẩn bị vùng lưu trữ…";
    case "uploading": return "Đang tải ảnh trực tiếp lên kho lưu trữ…";
    case "processing": return "Đang kiểm tra định dạng và kích thước ảnh…";
    case "complete": return "Ảnh bìa đã tải lên và được xác minh.";
    case "cancelled": return "Đã hủy tải ảnh. Tệp bạn chọn vẫn được giữ để thử lại.";
    case "error": return upload.message ?? "Không thể tải ảnh bìa.";
    default: return null;
  }
}

export function CoverUploadProgress({
  upload,
  onCancel,
  onRetry,
}: {
  upload: CoverUploadState;
  onCancel?(): void;
  onRetry?(): void;
}) {
  const label = phaseLabel(upload);
  if (!label) return null;
  const isUploading = upload.phase === "requesting-url" || upload.phase === "uploading";
  return (
    <div
      className={`rounded-xl border p-3 text-sm ${upload.phase === "error"
        ? "border-[var(--color-destructive)]/30 bg-[var(--color-destructive)]/10 text-[var(--color-destructive)]"
        : "border-[var(--color-border)] bg-[var(--color-muted)]/60 text-[var(--color-foreground)]"}`}
      role={upload.phase === "error" ? "alert" : "status"}
      aria-live="polite"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2">
          {isUploading || upload.phase === "processing" ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin motion-reduce:animate-none" /> : null}
          {label}
        </span>
        {isUploading && onCancel ? (
          <button type="button" onClick={onCancel} className="min-h-11 cursor-pointer rounded-lg px-3 font-semibold hover:bg-[var(--color-secondary)]">
            Hủy
          </button>
        ) : null}
        {(upload.phase === "error" || upload.phase === "cancelled") && onRetry ? (
          <button type="button" onClick={onRetry} className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg px-3 font-semibold hover:bg-[var(--color-secondary)]">
            <RefreshCw aria-hidden="true" className="h-4 w-4" /> Thử lại
          </button>
        ) : null}
      </div>
      {upload.parts.map((part) => (
        <div key={part.role} className="mt-2" aria-label={`Tiến độ ${part.role === "primary" ? "ảnh bìa" : "ảnh poster"}: ${part.percent}%`}>
          <div className="h-1.5 overflow-hidden rounded-full bg-[var(--color-border)]" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={part.percent}>
            <div className="h-full rounded-full bg-[var(--color-primary)] transition-[width] motion-reduce:transition-none" style={{ width: `${part.percent}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function CoverUploader({
  file,
  previewUrl,
  position,
  error,
  disabled = false,
  upload,
  onFileChange,
  onFileError,
  onPositionChange,
  onCancel,
  onRetry,
  inputId,
  showUploadStatus = true,
}: CoverUploaderProps) {
  const generatedInputId = useId();
  const resolvedInputId = inputId ?? generatedInputId;
  const inputRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const dragRef = useRef<DragSnapshot | null>(null);
  const pendingPositionRef = useRef<CoverPosition | null>(null);
  const positionFrameRef = useRef<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const canAdjustCover = Boolean(previewUrl) && !disabled;

  useEffect(() => {
    if (!file && inputRef.current) inputRef.current.value = "";
    return () => {
      if (positionFrameRef.current !== null) cancelAnimationFrame(positionFrameRef.current);
    };
  }, [file]);

  const chooseFile = (next: File | null) => {
    if (!next) return;
    const validationError = validateFile(next);
    onFileError(validationError);
    if (!validationError) {
      onFileChange(next);
    }
    else {
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    chooseFile(event.target.files?.[0] ?? null);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    if (!disabled) chooseFile(event.dataTransfer.files[0] ?? null);
  };

  const setPosition = (x: number, y: number) => {
    onPositionChange(normalizeCoverPosition({ x, y }));
  };

  const nudge = (deltaX: number, deltaY: number) => {
    setPosition(position.x + deltaX, position.y + deltaY);
  };

  const handlePositionKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const movement: Record<string, [number, number]> = {
      ArrowLeft: [-POSITION_STEP, 0],
      ArrowRight: [POSITION_STEP, 0],
      ArrowUp: [0, -POSITION_STEP],
      ArrowDown: [0, POSITION_STEP],
    };
    const delta = movement[event.key];
    if (!delta || !canAdjustCover) return;
    event.preventDefault();
    nudge(...delta);
  };

  const handlePositionPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!canAdjustCover || (event.pointerType === "mouse" && event.button !== 0)) return;
    const image = imageRef.current;
    if (!image?.naturalWidth || !image.naturalHeight) return;
    const frame = event.currentTarget;
    const scale = Math.max(frame.clientWidth / image.naturalWidth, frame.clientHeight / image.naturalHeight);
    const overflowX = Math.max(0, image.naturalWidth * scale - frame.clientWidth);
    const overflowY = Math.max(0, image.naturalHeight * scale - frame.clientHeight);
    if (overflowX < 0.5 && overflowY < 0.5) return;
    dragRef.current = {
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
      position,
      overflowX,
      overflowY,
      moved: false,
    };
    frame.setPointerCapture(event.pointerId);
    setDragging(true);
  };

  const handlePositionPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - drag.clientX;
    const deltaY = event.clientY - drag.clientY;
    if (!drag.moved && Math.hypot(deltaX, deltaY) < 3) return;
    drag.moved = true;
    pendingPositionRef.current = normalizeCoverPosition({
      x: drag.overflowX < 0.5
        ? drag.position.x
        : drag.position.x - (deltaX / drag.overflowX) * 100,
      y: drag.overflowY < 0.5
        ? drag.position.y
        : drag.position.y - (deltaY / drag.overflowY) * 100,
    });
    if (positionFrameRef.current === null) {
      positionFrameRef.current = requestAnimationFrame(() => {
        const next = pendingPositionRef.current;
        pendingPositionRef.current = null;
        positionFrameRef.current = null;
        if (next) onPositionChange(next);
      });
    }
  };

  const finishPositionDrag = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (drag?.pointerId !== event.pointerId) return;
    if (!drag.moved) {
      const frame = event.currentTarget;
      const bounds = frame.getBoundingClientRect();
      onPositionChange(coverPositionForViewportPoint(
        drag.position,
        { x: event.clientX - bounds.left, y: event.clientY - bounds.top },
        { width: frame.clientWidth, height: frame.clientHeight },
        { x: drag.overflowX, y: drag.overflowY },
      ));
    }
    dragRef.current = null;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const cancelPositionDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    pendingPositionRef.current = null;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  return (
    <div className="space-y-3">
      <div
        className={`relative aspect-video overflow-hidden rounded-2xl border bg-[var(--color-muted)] transition-colors motion-reduce:transition-none ${dragging || inputFocused ? "border-[var(--color-ring)] ring-2 ring-[var(--color-ring)]/30" : error ? "border-[var(--color-destructive)]" : "border-[var(--color-border)]"
          }`}
        onDragEnter={(event) => { event.preventDefault(); if (!disabled) setDragging(true); }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
      >
        {previewUrl ? (
          <div
            role="group"
            tabIndex={canAdjustCover ? 0 : -1}
            aria-label="Vùng căn ảnh bìa. Chạm vào vùng muốn ưu tiên, kéo ảnh hoặc dùng phím mũi tên để thay đổi phần được hiển thị."
            className={`absolute inset-0 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-ring)] ${canAdjustCover ? "touch-none cursor-grab active:cursor-grabbing" : "touch-pan-y"}`}
            onKeyDown={handlePositionKeyDown}
            onPointerDown={handlePositionPointerDown}
            onPointerMove={handlePositionPointerMove}
            onPointerUp={finishPositionDrag}
            onPointerCancel={cancelPositionDrag}
          >
            <Image
              ref={imageRef}
              loader={({ src }) => src}
              unoptimized
              fill
              src={previewUrl}
              alt="Xem trước ảnh bìa truyện"
              draggable={false}
              className="pointer-events-none select-none object-cover"
              style={{ objectPosition: coverObjectPosition(position) }}
              sizes="(max-width: 768px) 100vw, 672px"
            />
            {canAdjustCover ? (
              <span className="select-none pointer-events-none absolute left-3 top-3 rounded-full bg-black/75 px-3 py-1.5 text-xs font-semibold text-white shadow-lg">
                Chạm, kéo hoặc dùng phím mũi tên để chọn vùng hiển thị
              </span>
            ) : null}
          </div>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-[var(--color-muted-foreground)]">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]">
              <ImagePlus aria-hidden="true" className="h-6 w-6" />
            </span>
            <span className="text-sm">Kéo ảnh vào đây hoặc chọn từ thiết bị</span>
          </div>
        )}

        <div data-cover-control className="absolute inset-x-0 bottom-0 z-10 flex items-center justify-between gap-3 bg-[var(--color-overlay)] p-3 backdrop-blur-sm">
          <label
            htmlFor={resolvedInputId}
            className={`inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-2 text-sm font-semibold text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-secondary)] ${disabled ? "pointer-events-none opacity-50" : ""}`}
          >
            <UploadCloud aria-hidden="true" className="h-4 w-4" />
            {previewUrl ? "Đổi ảnh" : "Chọn ảnh"}
          </label>
          {file && !disabled ? (
            <button
              type="button"
              onClick={() => { onFileChange(null); onFileError(null); }}
              className="inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-muted-foreground)] transition-colors hover:text-[var(--color-destructive)]"
              aria-label="Bỏ ảnh bìa đã chọn"
              title="Bỏ ảnh đã chọn"
            >
              <X aria-hidden="true" className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      </div>

      <input
        ref={inputRef}
        id={resolvedInputId}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        disabled={disabled}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${resolvedInputId}-error` : `${resolvedInputId}-hint`}
        onFocus={() => setInputFocused(true)}
        onBlur={() => setInputFocused(false)}
        onChange={handleChange}
      />
      <p id={`${resolvedInputId}-hint`} className="text-xs text-[var(--color-muted-foreground)]">
        JPG, PNG hoặc WebP  ·  Tối đa {IMAGE_MAX_BYTES / MEBIBYTE} MiB
      </p>
      {error ? <p id={`${resolvedInputId}-error`} role="alert" className="text-sm text-[var(--color-destructive)]">{error}</p> : null}

      {showUploadStatus ? <CoverUploadProgress upload={upload} onCancel={onCancel} onRetry={onRetry} /> : null}
    </div>
  );
}
