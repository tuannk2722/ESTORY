// src/components/editor/scenes/picker/SceneAudioEditor.tsx
// Scene audio sources and the configuration of the selected sound.

"use client";

import { matchesEffectSearch } from "@/lib/effects/effect-search";
import React, { useState, useCallback, useMemo, useRef } from "react";
import { EffectConfig } from "@/types/story";
import { AUDIO_EFFECT_PRESETS } from "@/lib/effects/effectCatalog";
import { createAudioEffect } from "@/lib/effects/effectFactory";
import { Music, VolumeX, Play, Square } from "lucide-react";
import SoundSourcePicker from "../../audio/SoundSourcePicker";
import { audioFocusRing } from "../../audio/SoundRow";
import SearchableCombobox, { ComboboxOption } from "@/components/ui/SearchableCombobox";
import { useAudioPreview } from "@/components/editor/effects/useAudioPreview";
import { useEditorEffectCatalog } from "@/components/editor/EditorProvider";
import { getActiveEffectDefinition } from "@/lib/effects/effect-authoring";

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
  const effectCatalog = useEditorEffectCatalog();
  const activeAudio = Boolean(
    getActiveEffectDefinition(effectCatalog, "audio")?.allowed_scopes.includes("scene"),
  );
  const audioPreview = useAudioPreview();
  const {
    previewingAudioSrc,
    togglePlayAudio,
    setAudioPreviewVolume,
    stopAudio,
  } = audioPreview;

  const currentSrc = ambientAudio?.audio_src || "";
  const currentVolume = ambientAudio?.intensity ?? 0.5;
  const currentLoop = ambientAudio?.loop ?? true;
  const config = useRef<HTMLDivElement>(null);
  const [personalTitle, setPersonalTitle] = useState("");
  const revealConfig = () => requestAnimationFrame(() => {
    config.current?.focus({ preventScroll: true });
    config.current?.scrollIntoView({ block: "nearest", behavior: "instant" });
  });

  const [showCustomAudioInput, setShowCustomAudioInput] = useState<boolean>(
    currentSrc !== "" && !ambientAudio?.audio_asset_id && !AUDIO_EFFECT_PRESETS.some((p) => p.src === currentSrc)
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
      searchTexts: [preset.label, preset.src, "audio", ...preset.keywords],
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
      ...(activeAudio ? audioPresetItems : []),
      ...(ambientAudio?.audio_asset_id ? [{
        id: "__personal__", label: personalTitle || "Âm thanh từ thư viện của tôi", icon: Music,
      }] : []),
      ...(activeAudio ? [{
        id: "__custom__",
        label: "Nhập URL thủ công...",
        searchTexts: ["custom", "url", "thủ công", "nhập"],
        icon: Music,
      }] : currentSrc ? [{
        id: "__retained__",
        label: "Âm thanh đã lưu · đã ngừng",
        searchTexts: ["đã lưu", "đã ngừng"],
        icon: Music,
      }] : []),
    ];
  }, [activeAudio, audioPresetItems, currentSrc, ambientAudio?.audio_asset_id, personalTitle]);

  const audioComboboxValue = !currentSrc
    ? "__none__"
    : !activeAudio
      ? "__retained__"
    : ambientAudio?.audio_asset_id
      ? "__personal__"
    : AUDIO_EFFECT_PRESETS.some((p) => p.src === currentSrc)
      ? currentSrc
      : "__custom__";

  const handleSelectOption = (id: string) => {
    stopAudio();
    if (id === "__none__") {
      setShowCustomAudioInput(false);
      onChangeAudio(null);
    } else if (id === "__retained__" || id === "__personal__") {
      return;
    } else if (id === "__custom__") {
      setShowCustomAudioInput(true);
      const customSrc = AUDIO_EFFECT_PRESETS.some((preset) => preset.src === currentSrc)
        ? ""
        : currentSrc;
      onChangeAudio(createAudioEffect(customSrc, currentVolume, currentLoop, { id: ambientAudio?.id }));
    } else {
      setShowCustomAudioInput(false);
      onChangeAudio(buildAudioEffect(id));
      revealConfig();
    }
  };

  return (
    <div className="min-w-0 space-y-4 font-editor">
      <SearchableCombobox
        searchMatcher={matchesEffectSearch}
        label="Âm thanh đang chọn"
        icon={Music}
        options={audioComboboxOptions}
        value={audioComboboxValue}
        onSelect={handleSelectOption}
        placeholder="Chọn nhạc nền..."
        searchPlaceholder="Tìm âm thanh..."
      />

      {/* Custom audio URL input */}
      {showCustomAudioInput && !ambientAudio?.audio_asset_id && (
        <div className="animate-fade-in">
          <input
            type="text"
            aria-label="URL âm thanh nền"
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

      {activeAudio && <SoundSourcePicker audioPreview={audioPreview} selectedId={ambientAudio?.audio_asset_id ?? currentSrc} onSelect={(asset) => {
        stopAudio();
        setShowCustomAudioInput(false);
        setPersonalTitle(asset.title);
        onChangeAudio(createAudioEffect(asset.url, currentVolume, currentLoop, { id: ambientAudio?.id, audio_asset_id: asset.id }));
        revealConfig();
      }} />}

      {/* Audio Audition & Volume Controls */}
      {currentSrc && (
        <div ref={config} tabIndex={-1} role="region" aria-label="Tùy chỉnh âm thanh nền" className={`scroll-my-4 p-4 rounded-xl bg-card border border-border space-y-3 ${audioFocusRing}`}>
          <h4 className="text-xs font-semibold">Tùy chỉnh âm thanh nền</h4>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={togglePlay}
                className={`p-2 rounded-xl transition-colors motion-reduce:transition-none cursor-pointer min-h-11 min-w-11 flex items-center justify-center ${audioFocusRing} ${
                  isPlaying
                    ? "bg-destructive/15 text-destructive hover:bg-destructive/25"
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
              aria-label="Âm lượng âm thanh nền"
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
