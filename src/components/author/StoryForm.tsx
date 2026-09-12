"use client";

import { Plus, X } from "lucide-react";
import { useState, type KeyboardEvent } from "react";
import { DEFAULT_COVER_POSITION, normalizeCoverPosition } from "@/lib/story-cover";
import type { CoverPosition } from "@/types/story";
import CoverUploader from "./CoverUploader";
import type { CoverUploadState, StoryFieldErrors, StoryFormValue } from "./types";

interface StoryFormProps {
  value: StoryFormValue;
  onChange(value: StoryFormValue): void;
  errors?: StoryFieldErrors;
  currentCoverUrl?: string;
  currentCoverPosition?: CoverPosition;
  showByline?: boolean;
  disabled?: boolean;
  upload?: CoverUploadState;
  onCancelUpload?(): void;
  onRetryUpload?(): void;
  showUploadStatus?: boolean;
}

const EMPTY_UPLOAD: CoverUploadState = { phase: "idle", parts: [] };

function fieldClass(error?: string): string {
  return `min-h-11 w-full rounded-xl border bg-[var(--color-background)] px-3.5 py-2.5 text-[var(--color-foreground)] placeholder:text-[var(--color-muted-foreground)]/70 transition-colors motion-reduce:transition-none ${error ? "border-[var(--color-destructive)]" : "border-[var(--color-border)] hover:border-[var(--color-muted-foreground)]/60"
    }`;
}

export default function StoryForm({
  value,
  onChange,
  errors = {},
  currentCoverUrl,
  currentCoverPosition,
  showByline = false,
  disabled = false,
  upload = EMPTY_UPLOAD,
  onCancelUpload,
  onRetryUpload,
  showUploadStatus = true,
}: StoryFormProps) {
  const prefix = "story";
  const [genreDraft, setGenreDraft] = useState("");
  const update = <K extends keyof StoryFormValue>(key: K, next: StoryFormValue[K]) => {
    onChange({ ...value, [key]: next });
  };

  const addGenre = () => {
    const next = genreDraft.trim().replace(/,$/, "").trim();
    if (!next) return;
    if (!value.genre.some((genre) => genre.localeCompare(next, "vi", { sensitivity: "accent" }) === 0)) {
      update("genre", [...value.genre, next]);
    }
    setGenreDraft("");
  };

  const handleGenreKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      addGenre();
    }
  };

  const replaceCoverFile = (file: File | null) => {
    if (value.coverPreviewUrl) URL.revokeObjectURL(value.coverPreviewUrl);
    onChange({
      ...value,
      coverFile: file,
      coverPreviewUrl: file ? URL.createObjectURL(file) : null,   // Tạo URL tạm thời cho ảnh bìa mới nếu có
      coverPosition: file
        ? { ...DEFAULT_COVER_POSITION }
        : currentCoverUrl
          ? normalizeCoverPosition(currentCoverPosition)
          : value.coverPosition,
      coverError: null,
    });
  };

  return (
    <div className="space-y-6">
      <div id="cover-field" className="space-y-2 scroll-mt-24">
        <span className="block text-sm font-semibold text-[var(--color-foreground)]">Ảnh bìa <span aria-hidden="true" className="text-[var(--color-destructive)]">*</span></span>
        <CoverUploader
          file={value.coverFile}
          previewUrl={value.coverPreviewUrl ?? currentCoverUrl}
          position={value.coverPosition}
          error={value.coverError ?? errors.cover}
          disabled={disabled}
          upload={upload}
          onFileChange={replaceCoverFile}
          onFileError={(coverError) => {
            if (!coverError) return;
            onChange({ ...value, coverError });
          }}
          onPositionChange={(coverPosition) => onChange({ ...value, coverPosition })}
          onCancel={onCancelUpload}
          onRetry={onRetryUpload}
          inputId={`${prefix}-cover`}
          showUploadStatus={showUploadStatus}
        />
      </div>

      <fieldset disabled={disabled} className="space-y-6 disabled:opacity-75">
        <legend className="sr-only">Thông tin chữ của truyện</legend>

      <div id="title-field" className="space-y-2 scroll-mt-24">
        <label htmlFor={`${prefix}-title`} className="block text-sm font-semibold">Tên truyện <span aria-hidden="true" className="text-[var(--color-destructive)]">*</span></label>
        <input
          id={`${prefix}-title`}
          value={value.title}
          onChange={(event) => update("title", event.target.value)}
          className={fieldClass(errors.title)}
          placeholder="Một tựa truyện khiến người đọc muốn mở trang đầu"
          autoComplete="off"
          aria-invalid={Boolean(errors.title)}
          aria-describedby={errors.title ? `${prefix}-title-error` : undefined}
        />
        {errors.title ? <p id={`${prefix}-title-error`} role="alert" className="text-sm text-[var(--color-destructive)]">{errors.title}</p> : null}
      </div>

      {showByline ? (
        <div id="byline-field" className="space-y-2 scroll-mt-24">
          <label htmlFor={`${prefix}-byline`} className="block text-sm font-semibold">Bút danh <span aria-hidden="true" className="text-[var(--color-destructive)]">*</span></label>
          <input
            id={`${prefix}-byline`}
            value={value.byline}
            onChange={(event) => update("byline", event.target.value)}
            className={fieldClass(errors.byline)}
            placeholder="Tên sẽ xuất hiện công khai cùng tác phẩm"
            autoComplete="name"
            aria-invalid={Boolean(errors.byline)}
            aria-describedby={`${prefix}-byline-hint${errors.byline ? ` ${prefix}-byline-error` : ""}`}
          />
          {errors.byline ? <p id={`${prefix}-byline-error`} role="alert" className="text-sm text-[var(--color-destructive)]">{errors.byline}</p> : null}
        </div>
      ) : null}

      <div id="description-field" className="space-y-2 scroll-mt-24">
        <label htmlFor={`${prefix}-description`} className="block text-sm font-semibold">Mô tả <span aria-hidden="true" className="text-[var(--color-destructive)]">*</span></label>
        <textarea
          id={`${prefix}-description`}
          rows={5}
          value={value.description}
          onChange={(event) => update("description", event.target.value)}
          className={`${fieldClass(errors.description)} resize-y`}
          placeholder="Giới thiệu ngắn về thế giới, nhân vật hoặc xung đột chính…"
          aria-invalid={Boolean(errors.description)}
          aria-describedby={errors.description ? `${prefix}-description-error` : undefined}
        />
        {errors.description ? <p id={`${prefix}-description-error`} role="alert" className="text-sm text-[var(--color-destructive)]">{errors.description}</p> : null}
      </div>

      <div id="genre-field" className="space-y-2 scroll-mt-24">
        <label htmlFor={`${prefix}-genre`} className="block text-sm font-semibold">Thể loại <span aria-hidden="true" className="text-[var(--color-destructive)]">*</span></label>
        {value.genre.length > 0 ? (
          <ul className="flex flex-wrap gap-2" aria-label="Các thể loại đã chọn">
            {value.genre.map((genre) => (
              <li key={genre} className="inline-flex min-h-11 items-center gap-1 rounded-full border border-[var(--color-border)] bg-[var(--color-secondary)] pl-3 text-sm text-[var(--color-secondary-foreground)]">
                <span>{genre}</span>
                <button
                  type="button"
                  onClick={() => update("genre", value.genre.filter((item) => item !== genre))}
                  className="inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-full transition-colors hover:bg-[var(--color-muted)] hover:text-[var(--color-destructive)]"
                  aria-label={`Xóa thể loại ${genre}`}
                >
                  <X aria-hidden="true" className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            id={`${prefix}-genre`}
            value={genreDraft}
            onChange={(event) => setGenreDraft(event.target.value)}
            onKeyDown={handleGenreKeyDown}
            onBlur={addGenre}
            className={fieldClass(errors.genre)}
            placeholder="Ví dụ: Kỳ ảo"
            aria-invalid={Boolean(errors.genre)}
            aria-describedby={`${prefix}-genre-hint${errors.genre ? ` ${prefix}-genre-error` : ""}`}
          />
          <button
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={addGenre}
            disabled={!genreDraft.trim()}
            className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-secondary)] px-4 text-sm font-semibold text-[var(--color-secondary-foreground)] transition-colors hover:bg-[var(--color-muted)] disabled:pointer-events-none disabled:opacity-50"
          >
            <Plus aria-hidden="true" className="h-4 w-4" /> Thêm
          </button>
        </div>
        <p id={`${prefix}-genre-hint`} className="text-xs text-[var(--color-muted-foreground)]">Nhấn Enter hoặc dấu phẩy để thêm nhiều thể loại.</p>
        {errors.genre ? <p id={`${prefix}-genre-error`} role="alert" className="text-sm text-[var(--color-destructive)]">{errors.genre}</p> : null}
      </div>
      </fieldset>
    </div>
  );
}
