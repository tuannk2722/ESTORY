// src/components/editor/scenes/picker/SceneAudioEditor.tsx
// Bước 4: Nhạc Nền Môi Trường — SearchableCombobox chọn mẫu âm thanh, nhập URL thủ công, nghe thử Howler và chỉnh Volume (khớp 100% UI gốc)

"use client";

import React, { useState, useCallback, useMemo } from "react";
import { EffectConfig } from "@/types/story";
import { AUDIO_EFFECT_PRESETS } from "@/lib/effects/effectCatalog";
import { createAudioEffect } from "@/lib/effects/effectFactory";
import { Music, VolumeX, Play, Square } from "lucide-react";
import SearchableCombobox, { ComboboxOption } from "@/components/ui/SearchableCombobox";
import { useAudioPreview } from "@/components/editor/effects/useAudioPreview";

export interface SceneAudioEditorProps {
  ambientAudio: EffectConfig | null;
  onChangeAudio: (audio: EffectConfig | null) => void;
  initialAudioSrc?: string;
}

export const SceneAudioEditor = React.memo(function SceneAudioEditor({
  ambientAudio,
  onChangeAudio,
  initialAudioSrc,
}: SceneAudioEditorProps) {
  const {
    previewingAudioSrc,
    togglePlayAudio,
    setAudioPreviewVolume,
    stopAudio,
  } = useAudioPreview();

  const currentSrc = ambientAudio?.audio_src || "";
  const currentVolume = ambientAudio?.intensity ?? 0.5;
  const currentLoop = ambientAudio?.loop ?? true;

  const [showCustomAudioInput, setShowCustomAudioInput] = useState<boolean>(
    currentSrc !== "" && !AUDIO_EFFECT_PRESETS.some((p) => p.src === currentSrc)
  );

  const isPlaying = previewingAudioSrc === currentSrc;

  const buildAudioEffect = useCallback(
    (audioSrc: string, volume = currentVolume, loop = currentLoop) => {
      const keepsCurrentSource = ambientAudio?.audio_src === audioSrc;
      return createAudioEffect(audioSrc, volume, loop, {
        id: ambientAudio?.id,
        audio_asset_id: keepsCurrentSource
          ? ambientAudio?.audio_asset_id
          : undefined,
      });
    },
    [ambientAudio, currentLoop, currentVolume]
  );

  const togglePlay = useCallback(() => {
    if (!currentSrc) return;

    togglePlayAudio(currentSrc, currentVolume, currentLoop);
  }, [currentLoop, currentSrc, currentVolume, togglePlayAudio]);

  const audioPresetItems = useMemo(() => {
    const items = AUDIO_EFFECT_PRESETS.map((preset) => ({
      id: preset.src,
      label: preset.label,
      searchTexts: [preset.label, preset.src],
      icon: Music,
    }));

    // Khi edit, đưa audio đang dùng lên đầu danh sách
    if (initialAudioSrc) {
      const usedIdx = items.findIndex((p) => p.id === initialAudioSrc);
      if (usedIdx > 0) {
        const [usedItem] = items.splice(usedIdx, 1);
        items.unshift(usedItem);
      }
    }

    return items;
  }, [initialAudioSrc]);

  const audioComboboxOptions: ComboboxOption[] = useMemo(() => {
    return [
      {
        id: "__none__",
        label: "Không có nhạc nền",
        searchTexts: ["không", "none", "tắt"],
        icon: VolumeX,
      },
      ...audioPresetItems,
      {
        id: "__custom__",
        label: "Nhập URL thủ công...",
        searchTexts: ["custom", "url", "thủ công", "nhập"],
        icon: Music,
      },
    ];
  }, [audioPresetItems]);

  const audioComboboxValue = !currentSrc
    ? "__none__"
    : AUDIO_EFFECT_PRESETS.some((p) => p.src === currentSrc)
      ? currentSrc
      : "__custom__";

  const handleSelectOption = (id: string) => {
    stopAudio();
    if (id === "__none__") {
      setShowCustomAudioInput(false);
      onChangeAudio(null);
    } else if (id === "__custom__") {
      setShowCustomAudioInput(true);
      const customSrc = AUDIO_EFFECT_PRESETS.some((preset) => preset.src === currentSrc)
        ? ""
        : currentSrc;
      onChangeAudio(buildAudioEffect(customSrc));
    } else {
      setShowCustomAudioInput(false);
      onChangeAudio(buildAudioEffect(id));
    }
  };

  return (
    <div className="space-y-3 font-editor">
      <SearchableCombobox
        label="Âm Thanh Nền (Ambient Audio)"
        icon={Music}
        options={audioComboboxOptions}
        value={audioComboboxValue}
        onSelect={handleSelectOption}
        placeholder="Chọn nhạc nền..."
        searchPlaceholder="Tìm âm thanh..."
      />

      {/* Custom audio URL input */}
      {showCustomAudioInput && (
        <div className="animate-fade-in">
          <input
            type="text"
            value={currentSrc}
            onChange={(e) => {
              stopAudio();
              onChangeAudio(buildAudioEffect(e.target.value));
            }}
            placeholder="Dán link âm thanh MP3 / OGG (VD: https://... hoặc /audio/rain.mp3)"
            className="w-full px-3 py-2 text-xs bg-card border border-border rounded-xl font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary min-h-[38px]"
          />
        </div>
      )}

      {/* Audio Audition & Volume Controls */}
      {currentSrc && (
        <div className="p-3.5 rounded-xl bg-card border border-border/80 space-y-3 animate-fade-in">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={togglePlay}
                className={`p-2 rounded-xl transition-all cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center ${
                  isPlaying
                    ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                    : "bg-primary/10 text-primary hover:bg-primary/20"
                }`}
                title={isPlaying ? "Dừng nghe thử" : "Nghe thử âm thanh"}
                aria-label={isPlaying ? "Dừng nghe thử" : "Nghe thử âm thanh"}
              >
                {isPlaying ? <Square className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
              </button>

              <div className="text-xs font-semibold text-foreground">
                {isPlaying ? "Đang phát nghe thử..." : "Bấm nút để nghe thử"}
              </div>
            </div>

            <span className="text-xs font-mono font-bold text-primary">
              {Math.round(currentVolume * 100)}%
            </span>
          </div>

          {/* Volume Slider */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>Âm lượng phát:</span>
              <span className="font-mono">{Math.round(currentVolume * 100)}%</span>
            </div>
            <input
              type="range"
              min="0.05"
              max="1"
              step="0.05"
              value={currentVolume}
              onChange={(e) => {
                const vol = parseFloat(e.target.value);
                onChangeAudio(buildAudioEffect(currentSrc, vol, currentLoop));
                setAudioPreviewVolume(vol);
              }}
              className="w-full accent-primary cursor-pointer h-1.5 bg-secondary rounded-lg"
            />
          </div>

          {/* Loop Toggle */}
          <label className="flex items-center justify-between pt-1 text-xs text-muted-foreground cursor-pointer">
            <span>Lặp lại liên tục (Loop âm thanh)</span>
            <input
              type="checkbox"
              checked={currentLoop}
              onChange={(e) => {
                const loop = e.target.checked;
                stopAudio();
                onChangeAudio(buildAudioEffect(currentSrc, currentVolume, loop));
              }}
              className="w-4 h-4 rounded border-border accent-primary cursor-pointer"
            />
          </label>
        </div>
      )}
    </div>
  );
});

export default SceneAudioEditor;
