// src/components/editor/effects/EffectPicker.tsx
// Phase 2 coordinator for selecting, configuring, and previewing block effects.

"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import type { EffectCategory, EffectConfig, EffectType } from "@/types/story";
import { Check, Sliders, Sparkles } from "lucide-react";
import { EditorDialog } from "@/components/editor/shared/EditorDialog";
import { createEffectConfig } from "@/lib/effects/effectFactory";
import { getActiveEffectDefinition, getAuthorEffectPresentation } from "@/lib/effects/effect-authoring";
import { useEditorEffectCatalog } from "../EditorProvider";
import { EffectConfigForm, type EffectConfigUpdate } from "./EffectConfigForm";
import { EffectList } from "./EffectList";
import { EffectPreview } from "./EffectPreview";
import { useAudioPreview } from "./useAudioPreview";
import SoundSourcePicker from "../audio/SoundSourcePicker";

export interface EffectPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveEffect: (effect: EffectConfig) => void;
  initialEffect?: EffectConfig | null;
  presetType?: EffectType | null;
}

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card";

function createInitialDraft(
  effectCatalog: ReturnType<typeof useEditorEffectCatalog>,
  initialEffect?: EffectConfig | null,
  presetType?: EffectType | null
): EffectConfig | null {
  if (initialEffect) {
    return createEffectConfig(initialEffect.type, initialEffect);
  }
  return presetType && getActiveEffectDefinition(effectCatalog, presetType)?.allowed_scopes.includes("block")
    ? createEffectConfig(presetType)
    : null;
}

export function EffectPicker(props: EffectPickerProps) {
  if (!props.isOpen) return null;
  return <EffectPickerDialog {...props} />;
}

function EffectPickerDialog({
  onClose,
  onSaveEffect,
  initialEffect,
  presetType,
}: EffectPickerProps) {
  const effectCatalog = useEditorEffectCatalog();
  const [selectedCategory, setSelectedCategory] = useState<EffectCategory>(
    () =>
      initialEffect
        ? getAuthorEffectPresentation(effectCatalog, initialEffect.type).category
        : presetType
          ? getAuthorEffectPresentation(effectCatalog, presetType).category
          : effectCatalog.effects.find((effect) => effect.allowed_scopes.includes("block"))?.category ?? "visual"
  );
  const [draft, setDraft] = useState<EffectConfig | null>(() =>
    createInitialDraft(effectCatalog, initialEffect, presetType)
  );
  const [previewEffect, setPreviewEffect] = useState<EffectConfig | null>(null);
  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const configRef = useRef<HTMLDivElement>(null);
  const revealAudioConfig = useCallback(() => {
    requestAnimationFrame(() => {
      configRef.current?.focus({ preventScroll: true });
      configRef.current?.scrollIntoView({ block: "nearest", behavior: "instant" });
    });
  }, []);
  const audioPreview = useAudioPreview();
  const { previewingAudioSrc, togglePlayAudio, stopAudio } = audioPreview;

  const stopVisualPreview = useCallback(() => {
    if (previewTimerRef.current) {
      clearTimeout(previewTimerRef.current);
      previewTimerRef.current = null;
    }
    setPreviewEffect(null);
  }, []);

  const handleClose = useCallback(() => {
    stopVisualPreview();
    stopAudio();
    onClose();
  }, [onClose, stopAudio, stopVisualPreview]);

  useEffect(() => {
    return () => {
      if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    };
  }, []);

  const handleSelectType = useCallback(
    (type: EffectType) => {
      setDraft((current) => {
        if (current?.type === type) return current;
        if (initialEffect?.type === type) {
          return createEffectConfig(type, initialEffect);
        }
        return createEffectConfig(type);
      });
    },
    [initialEffect]
  );

  const handleSelectCategory = useCallback((category: EffectCategory) => {
    stopAudio();
    setSelectedCategory(category);
    if (category === "audio" && getActiveEffectDefinition(effectCatalog, "audio")?.allowed_scopes.includes("block")) {
      setDraft((current) =>
        current?.type === "audio" ? current : createEffectConfig("audio")
      );
    }
  }, [effectCatalog, stopAudio]);

  const handleSelectAudioPreset = useCallback((audioSrc: string) => {
    stopAudio();
    setDraft((current) =>
      createEffectConfig("audio", {
        ...(current?.type === "audio" ? current : undefined),
        audio_src: audioSrc,
        audio_asset_id: undefined,
      })
    );
    revealAudioConfig();
  }, [stopAudio, revealAudioConfig]);

  const handleConfigChange = useCallback((update: EffectConfigUpdate) => {
    if (!draft) return;
    const nextDraft = createEffectConfig(draft.type, { ...draft, ...update });
    setDraft(nextDraft);
    setPreviewEffect((current) =>
      current?.type === nextDraft.type
        ? createEffectConfig(nextDraft.type, nextDraft)
        : current
    );
  }, [draft]);

  const handleToggleAudioPreview = useCallback(
    (src: string) => {
      togglePlayAudio(src, draft?.type === "audio" ? draft.intensity : 0.75);
    },
    [draft, togglePlayAudio]
  );

  const handleQuickPreview = useCallback(
    (type: EffectType) => {
      const effect =
        draft?.type === type
          ? createEffectConfig(type, draft)
          : createEffectConfig(type);
      setPreviewEffect(effect);
      if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
      previewTimerRef.current = setTimeout(() => {
        setPreviewEffect(null);
        previewTimerRef.current = null;
      }, 5000);
    },
    [draft]
  );

  const isDraftInCurrentCategory = draft?.category === selectedCategory;
  const isRetainedInitialEffect = Boolean(
    draft
    && initialEffect
    && draft.id === initialEffect.id
    && draft.type === initialEffect.type,
  );
  const isDraftAvailable = Boolean(
    draft
    && (
      isRetainedInitialEffect
      || getActiveEffectDefinition(effectCatalog, draft.type)?.allowed_scopes.includes("block")
    ),
  );
  const normalizedAudioSrc = draft?.audio_src?.trim() ?? "";
  const isSaveDisabled =
    !draft ||
    !isDraftInCurrentCategory ||
    !isDraftAvailable ||
    (draft.type === "audio" && !normalizedAudioSrc);

  const handleSave = () => {
    if (!draft || isSaveDisabled) return;

    onSaveEffect(
      createEffectConfig(draft.type, {
        ...draft,
        audio_src: draft.type === "audio" ? normalizedAudioSrc : undefined,
        audio_asset_id:
          draft.type === "audio" ? draft.audio_asset_id : undefined,
      })
    );
    handleClose();
  };

  const footer = (
    <div className="flex items-center justify-end gap-3">
      <button
        type="button"
        onClick={handleClose}
        className={`min-h-11 rounded-lg bg-secondary px-4 py-2 text-sm text-secondary-foreground transition-colors hover:bg-muted motion-reduce:transition-none ${focusRing}`}
      >
        Hủy Bỏ
      </button>
      <button
        type="button"
        onClick={handleSave}
        disabled={isSaveDisabled}
        className={`flex min-h-11 items-center gap-2 rounded-lg bg-editor-action px-5 py-2 text-sm font-medium text-editor-action-foreground shadow-md transition-colors hover:bg-editor-action-hover disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none ${focusRing}`}
        title={
          isSaveDisabled
            ? "Chọn một hiệu ứng hợp lệ trong nhóm hiện tại trước khi lưu"
            : initialEffect
              ? "Cập nhật hiệu ứng"
              : "Xác nhận hiệu ứng"
        }
      >
        <Check className="h-4 w-4" aria-hidden="true" />
        {initialEffect ? "Cập Nhật" : "Xác Nhận"}
      </button>
    </div>
  );

  return (
    <>
      <EditorDialog
        isOpen
        onClose={handleClose}
        title={initialEffect ? "Chỉnh Sửa Hiệu Ứng" : "Gắn Hiệu Ứng Cho Đoạn Văn"}
        description="Kích hoạt hiệu ứng khi người đọc cuộn tới đoạn này"
        icon={<Sparkles className="h-5 w-5" aria-hidden="true" />}
        bodyClassName="p-0 overscroll-contain"
        footer={footer}
      >
        <EffectList
          selectedType={draft?.type ?? null}
          selectedCategory={selectedCategory}
          selectedAudioSrc={draft?.type === "audio" ? normalizedAudioSrc : ""}
          initialEffectType={initialEffect?.type}
          previewingAudioSrc={previewingAudioSrc}
          onSelectType={handleSelectType}
          onSelectCategory={handleSelectCategory}
          onSelectAudioPreset={handleSelectAudioPreset}
          onPreviewEffect={handleQuickPreview}
          onToggleAudioPreview={handleToggleAudioPreview}
        />

        <div className="p-4 sm:p-6">
          {selectedCategory === "audio" && getActiveEffectDefinition(effectCatalog, "audio")?.allowed_scopes.includes("block") && (
            <div className="mb-4">
              <SoundSourcePicker
                audioPreview={audioPreview}
                selectedId={draft?.audio_asset_id ?? normalizedAudioSrc}
                onSelect={(asset) => {
                  stopAudio();
                  setDraft((current) => createEffectConfig("audio", { ...(current?.type === "audio" ? current : undefined), audio_src: asset.url, audio_asset_id: asset.id }));
                  revealAudioConfig();
                }}
              />
            </div>
          )}
          {draft && isDraftInCurrentCategory ? (
            <div ref={configRef} tabIndex={-1} role="region" aria-label="Tùy chỉnh hiệu ứng đã chọn" className={`scroll-my-4 rounded-xl ${focusRing}`}>
              <EffectConfigForm
                effect={draft}
                onChange={handleConfigChange}
              />
            </div>
          ) : (
            <div className="space-y-2 rounded-xl border border-dashed border-border/80 bg-secondary/20 p-6 text-center">
              <Sliders className="mx-auto h-6 w-6 text-muted-foreground/50" aria-hidden="true" />
              <p className="text-sm font-medium text-foreground">Chưa chọn hiệu ứng</p>
              <p className="text-xs text-muted-foreground">
                {draft
                  ? "Hãy chọn một hiệu ứng thuộc nhóm hiện tại để tiếp tục."
                  : "Vui lòng chọn một hiệu ứng phía trên để tùy chỉnh."}
              </p>
            </div>
          )}
        </div>
      </EditorDialog>

      <EffectPreview effect={previewEffect} />
    </>
  );
}

export default EffectPicker;
