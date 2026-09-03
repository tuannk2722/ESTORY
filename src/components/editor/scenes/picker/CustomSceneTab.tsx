// src/components/editor/scenes/picker/CustomSceneTab.tsx
// Tab 2: Tùy Chỉnh Phối Riêng — Quy trình 4 bước tùy biến tự do (khớp 100% UI gốc)

"use client";

import React, { useCallback } from "react";
import { SceneDraft } from "@/lib/scenes/sceneDraft";
import { BackgroundAsset, ColorPalette } from "@/types/scene";
import { EffectConfig } from "@/types/story";
import { BackgroundPicker } from "./BackgroundPicker";
import { PalettePicker } from "./PalettePicker";
import { SceneEffectsEditor } from "./SceneEffectsEditor";
import { SceneAudioEditor } from "./SceneAudioEditor";

export interface CustomSceneTabProps {
  draft: SceneDraft;
  onChangeDraft: (updater: (prev: SceneDraft) => SceneDraft) => void;
  backgrounds: BackgroundAsset[];
  palettes: ColorPalette[];
  initialBackgroundId?: string;
  initialPaletteId?: string;
  initialAudioSrc?: string;
  isLoop?: boolean;
}

export const CustomSceneTab = React.memo(function CustomSceneTab({
  draft,
  onChangeDraft,
  backgrounds,
  palettes,
  initialBackgroundId,
  initialPaletteId,
  initialAudioSrc,
  isLoop = true,
}: CustomSceneTabProps) {
  const handleSelectBackground = useCallback(
    (bgId: string) => {
      onChangeDraft((prev) => ({
        ...prev,
        backgroundId: bgId,
      }));
    },
    [onChangeDraft]
  );

  const handleSelectPalette = useCallback(
    (palId: string) => {
      onChangeDraft((prev) => ({
        ...prev,
        paletteId: palId,
      }));
    },
    [onChangeDraft]
  );

  const handleChangeEffects = useCallback(
    (effects: EffectConfig[]) => {
      onChangeDraft((prev) => ({
        ...prev,
        ambientEffects: effects,
      }));
    },
    [onChangeDraft]
  );

  const handleChangeAudio = useCallback(
    (audio: EffectConfig | null) => {
      onChangeDraft((prev) => ({
        ...prev,
        ambientAudio: audio,
      }));
    },
    [onChangeDraft]
  );

  return (
    <div className="space-y-6 font-editor">
      {/* 1. Chọn Bối Cảnh Nền (Background) */}
      <BackgroundPicker
        backgrounds={backgrounds}
        selectedBackgroundId={draft.backgroundId}
        onSelectBackground={handleSelectBackground}
        initialBackgroundId={initialBackgroundId}
      />

      {/* 2. Bảng Màu & Âm Thanh Nền (Grid 2 Cột) */}
      <div className="p-5 rounded-2xl bg-secondary/30 border border-border/60 space-y-4">
        <label className="text-sm font-bold text-foreground flex items-center gap-2 font-ui">
          2. Phối Màu & Âm Thanh Nền
        </label>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Dropdown 1: Bảng Màu */}
          <PalettePicker
            palettes={palettes}
            selectedPaletteId={draft.paletteId}
            onSelectPalette={handleSelectPalette}
            initialPaletteId={initialPaletteId}
          />

          {/* Dropdown 2: Âm Thanh Nền */}
          <SceneAudioEditor
            ambientAudio={draft.ambientAudio}
            onChangeAudio={handleChangeAudio}
            initialAudioSrc={initialAudioSrc}
          />
        </div>
      </div>

      {/* 3. Hiệu Ứng Không Gian Đa Tầng */}
      <SceneEffectsEditor
        ambientEffects={draft.ambientEffects}
        onChangeEffects={handleChangeEffects}
        isLoop={isLoop}
      />
    </div>
  );
});

export default CustomSceneTab;
