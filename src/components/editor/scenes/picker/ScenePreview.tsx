// Full-screen Scene preview rendered by the same SceneLayer used in Reader.

"use client";

import React, { useEffect, useId, useMemo, useRef } from "react";
import { ArrowLeft, Check, Palette } from "lucide-react";
import type { BackgroundAsset, ColorPalette, Scene } from "@/types/scene";
import type { EffectConfig, StoryBlock as StoryBlockType } from "@/types/story";
import { STORY_FONT_OPTIONS } from "@/types/settings";
import SceneLayer from "@/components/scenes/SceneLayer";
import StoryBlock from "@/components/reader/StoryBlock";
import ReaderPlaybackStatus from "@/components/reader/ReaderPlaybackStatus";
import { useReaderSettings } from "@/components/ui/ThemeProvider";
import { useActiveReaderBlock } from "@/hooks/useActiveReaderBlock";

export interface ScenePreviewProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  isSaveDisabled: boolean;
  background?: BackgroundAsset;
  palette?: ColorPalette;
  ambientAudio?: EffectConfig | null;
  effects?: EffectConfig[];
  selectedBlocks: StoryBlockType[];
  previewSceneLabel: string;
  rangeLabel: string;
}

type ScenePreviewDialogProps = Omit<ScenePreviewProps, "isOpen">;

export const ScenePreview = React.memo(function ScenePreview({
  isOpen,
  ...props
}: ScenePreviewProps) {
  if (!isOpen) return null;
  return <ScenePreviewDialog {...props} />;
});

function ScenePreviewDialog({
  onClose,
  onSave,
  isSaveDisabled,
  background,
  palette,
  ambientAudio,
  effects = [],
  selectedBlocks,
  previewSceneLabel,
  rangeLabel,
}: ScenePreviewDialogProps) {
  const { settings } = useReaderSettings();
  const dialogRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();

  const previewBlocks = useMemo(
    () =>
      selectedBlocks.map((block) => ({
        ...block,
        id: `scene-preview-${block.id}`,
        effects: (block.effects ?? []).map((effect) => ({
          ...effect,
          id: `scene-preview-${effect.id}`,
        })),
      })),
    [selectedBlocks]
  );
  const previewBlockIds = useMemo(
    () => previewBlocks.map((block) => block.id),
    [previewBlocks]
  );
  const activeBlockId = useActiveReaderBlock(
    contentRef,
    previewBlockIds,
    previewBlockIds[0] ?? null
  );

  const previewScene = useMemo<Scene>(() => {
    const audio = ambientAudio?.audio_src ? [ambientAudio] : [];

    return {
      id: "scene-picker-live-preview",
      chapter_id: "scene-picker-preview",
      start_block_id: previewBlocks[0]?.id ?? "preview-start",
      end_block_id: previewBlocks.at(-1)?.id ?? "preview-end",
      background_id: background?.id ?? "",
      palette_id: palette?.id ?? "",
      effects: [...audio, ...effects],
    };
  }, [ambientAudio, background?.id, effects, palette?.id, previewBlocks]);

  const firstParagraphId = previewBlocks.find(
    (block) => block.type === "paragraph"
  )?.id;
  const fontFamilyClass =
    STORY_FONT_OPTIONS.find((font) => font.id === settings.font_family)
      ?.className ?? "story-font-cormorant";
  const reducedMotion = Boolean(settings.reduced_motion);

  useEffect(() => {
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;

      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) {
        event.preventDefault();
        dialogRef.current.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocusRef.current?.focus();
    };
  }, [onClose]);

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      tabIndex={-1}
      className="scene-live-preview-overlay fixed inset-0 z-[100] overflow-y-auto bg-background font-story outline-none"
    >
      <header
        data-reader-header
        className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-3 border-b border-border/80 bg-background/85 px-4 py-3 shadow-lg backdrop-blur-xl md:px-8"
      >
        <div className="flex min-w-0 items-center gap-3 md:gap-4">
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="flex min-h-11 items-center gap-1.5 rounded-xl border border-border bg-secondary/80 px-3 py-2 text-xs font-editor transition-colors hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none md:text-sm"
            aria-label="Quay lại chỉnh sửa Scene"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">Quay lại chỉnh sửa</span>
          </button>

          <div className="min-w-0 font-editor">
            <div className="flex items-center gap-2">
              <span className="rounded-md border border-primary/30 bg-primary/15 px-2 py-0.5 font-mono text-[10px] font-bold tracking-wider text-primary">
                PREVIEW
              </span>
              <h2 id={titleId} className="truncate text-sm font-bold text-foreground md:text-base">
                {previewSceneLabel}
              </h2>
            </div>
            <div className="mt-0.5 hidden items-center gap-2 text-xs text-muted-foreground sm:flex">
              <span>{rangeLabel}</span>
              {palette && (
                <span className="flex items-center gap-1.5">
                  <span aria-hidden="true">•</span>
                  <Palette className="h-3 w-3 text-accent" aria-hidden="true" />
                  {palette.label}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 font-editor">
          <ReaderPlaybackStatus />

          <button
            type="button"
            onClick={onSave}
            disabled={isSaveDisabled}
            className="flex min-h-11 items-center gap-2 rounded-xl bg-editor-action px-3 py-2 text-xs font-semibold text-editor-action-foreground shadow-md transition-colors hover:bg-editor-action-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none md:px-5 md:text-sm"
          >
            <Check className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">Áp Dụng Scene</span>
            <span className="sm:hidden">Áp dụng</span>
          </button>
        </div>
      </header>

      <SceneLayer
        scene={previewScene}
        backgroundAsset={background}
        colorPalette={palette}
        reducedMotion={reducedMotion}
      >
        <div id="effect-portal-root" className="pointer-events-none" />
        <main
          ref={contentRef}
          className="prose-reader font-size-lg px-4 py-12 md:px-6"
        >
          {previewBlocks.map((block) => (
            <StoryBlock
              key={block.id}
              block={block}
              storyFontClass={fontFamilyClass}
              isFirstParagraph={block.id === firstParagraphId}
              isActive={block.id === activeBlockId}
              reducedMotion={reducedMotion}
            />
          ))}
        </main>
      </SceneLayer>
    </div>
  );
}

export default ScenePreview;
