// components/editor/EffectPicker.tsx
// Phase 2: Modal chọn & cấu hình hiệu ứng cho block (US-2.2)
"use client";

import React, { useState } from "react";
import { EffectConfig, EffectType, EffectCategory } from "@/types/story";
import {
  EFFECT_CATEGORIES,
  EFFECT_METADATA,
  AUDIO_EFFECT_PRESETS,
} from "./effect-meta";
import { X, Sparkles, Sliders, Volume2, Check, Search } from "lucide-react";

export interface EffectPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveEffect: (effect: EffectConfig) => void;
  initialEffect?: EffectConfig | null;
  presetType?: EffectType | null;
}

const normalizeSearchText = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");

const matchesSearch = (query: string, ...values: string[]) => {
  if (!query) return true;

  const normalizedQuery = normalizeSearchText(query);
  const searchableText = normalizeSearchText(values.join(" "));
  const queryTokens = normalizedQuery.split(" ");

  return (
    queryTokens.every((token) => searchableText.includes(token)) ||
    normalizedQuery.replaceAll(" ", "") !== "" &&
    searchableText.replaceAll(" ", "").includes(normalizedQuery.replaceAll(" ", ""))
  );
};

export default function EffectPicker({
  isOpen,
  onClose,
  onSaveEffect,
  initialEffect,
  presetType,
}: EffectPickerProps) {
  const initialMeta = presetType ? EFFECT_METADATA[presetType] : undefined;
  const [selectedCategory, setSelectedCategory] = useState<EffectCategory>(
    initialEffect?.category ?? initialMeta?.category ?? "visual"
  );
  const [selectedType, setSelectedType] = useState<EffectType>(
    initialEffect?.type ?? initialMeta?.type ?? "lightning_flash"
  );
  const [intensity, setIntensity] = useState<number>(
    initialEffect?.intensity ?? initialMeta?.defaultIntensity ?? 0.85
  );
  const [durationMs, setDurationMs] = useState<number>(
    initialEffect?.duration_ms ?? initialMeta?.defaultDurationMs ?? 1200
  );
  const [delayMs, setDelayMs] = useState<number>(
    initialEffect?.delay_ms ?? initialMeta?.defaultDelayMs ?? 0
  );
  const [audioSrc, setAudioSrc] = useState<string>(
    initialEffect?.audio_src ?? AUDIO_EFFECT_PRESETS[0]?.src ?? ""
  );
  const [loopAudio, setLoopAudio] = useState<boolean>(initialEffect?.loop ?? false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Cập nhật giá trị mặc định khi chọn loại effect mới
  const handleSelectType = (type: EffectType) => {
    setSelectedType(type);
    const meta = EFFECT_METADATA[type];
    if (meta) {
      setIntensity(meta.defaultIntensity);
      setDurationMs(meta.defaultDurationMs);
      setDelayMs(meta.defaultDelayMs);
    }
  };

  const handleSave = () => {
    const config: EffectConfig = {
      id: initialEffect?.id || `eff-${Date.now().toString().slice(-6)}`,
      type: selectedCategory === "audio" ? "audio" : selectedType,
      category: selectedCategory,
      intensity: Number(intensity.toFixed(2)),
      duration_ms: Math.round(durationMs),
      delay_ms: Math.round(delayMs),
      ...(selectedCategory === "audio" ? { audio_src: audioSrc, loop: loopAudio } : {}),
    };
    onSaveEffect(config);
    onClose();
  };

  if (!isOpen) return null;

  const currentMeta = EFFECT_METADATA[selectedType];
  const CurrentIcon = selectedCategory === "audio" ? Volume2 : currentMeta?.icon || Sparkles;
  const normalizedSearchQuery = normalizeSearchText(searchQuery);

  const availableEffects = Object.values(EFFECT_METADATA).filter((meta) => {
    if (selectedCategory === "audio") return false;
    return meta.category === selectedCategory && matchesSearch(
      normalizedSearchQuery,
      meta.type,
      meta.label,
      meta.description
    );
  });
  const availableAudioPresets = AUDIO_EFFECT_PRESETS.filter((preset) => {
    return matchesSearch(normalizedSearchQuery, preset.label, preset.src);
  });
  const optionCount = selectedCategory === "audio" ? availableAudioPresets.length : availableEffects.length;
  const selectedAudioPreset = AUDIO_EFFECT_PRESETS.find((preset) => preset.src === audioSrc);
  const configurationLabel = `Cấu hình thông số: ${selectedCategory === "audio"
    ? selectedAudioPreset?.label || "Âm thanh"
    : currentMeta?.label || selectedType}`;
  const selectedCategoryLabel =
    EFFECT_CATEGORIES.find((category) => category.id === selectedCategory)?.label.split(" (")[0] ?? selectedCategory;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-xl bg-card text-card-foreground border border-border rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold font-editor text-foreground">
                {initialEffect ? "Chỉnh Sửa Hiệu Ứng" : "Gắn Hiệu Ứng Vào Block"}
              </h2>
              <p className="text-xs text-muted-foreground">
                Cấu hình hiệu ứng hiển thị chấm phá khi block xuất hiện trong tầm đọc
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-secondary transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
            aria-label="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Category Tabs */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Nhóm hiệu ứng
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {EFFECT_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    setSelectedCategory(cat.id);
                    setSearchQuery("");
                    setSearchOpen(false);
                    if (cat.id === "audio") {
                      setSelectedType("audio");
                    } else {
                      const firstInCat = Object.values(EFFECT_METADATA).find(
                        (m) => m.category === cat.id
                      );
                      if (firstInCat) handleSelectType(firstInCat.type);
                    }
                  }}
                  className={`px-3 py-2 rounded-lg font-editor text-sm font-medium text-center transition-all cursor-pointer min-h-[44px] flex items-center justify-center ${selectedCategory === cat.id
                    ? "bg-editor-action text-editor-action-foreground shadow-md"
                    : "bg-secondary/60 text-secondary-foreground hover:bg-secondary"
                    }`}
                >
                  {cat.label.split(" (")[0]}
                </button>
              ))}
            </div>
          </div>

          {/* Effect selector */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {selectedCategory === "audio" ? "Chọn âm thanh" : `Chọn hiệu ứng (${optionCount})`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSearchOpen((open) => !open);
                  if (searchOpen) setSearchQuery("");
                }}
                className="shrink-0 p-2 rounded-lg border border-border text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
                aria-label={searchOpen ? "Đóng tìm kiếm hiệu ứng" : "Tìm kiếm hiệu ứng"}
                title={searchOpen ? "Đóng tìm kiếm" : "Tìm kiếm hiệu ứng"}
              >
                <Search className="w-4 h-4" />
              </button>
            </div>
            {searchOpen && (
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={`Tìm trong nhóm ${selectedCategoryLabel.toLocaleLowerCase()}...`}
                autoFocus
                className="w-full px-3 py-2.5 text-sm bg-background border border-border rounded-lg text-foreground focus-visible:outline-ring"
              />
            )}
            {selectedCategory !== "audio" && (
              <div className="max-h-56 overflow-y-auto space-y-2 pr-1 border border-border/50 rounded-xl bg-secondary/20 p-2">
                {availableEffects.length === 0 && (
                  <p className="px-2 py-4 text-center text-xs text-muted-foreground">
                    Không tìm thấy hiệu ứng phù hợp.
                  </p>
                )}
                {availableEffects.map((meta) => {
                  const Icon = meta.icon;
                  const isSelected = selectedType === meta.type;
                  return (
                    <button
                      key={meta.type}
                      type="button"
                      onClick={() => handleSelectType(meta.type)}
                      className={`w-full p-2.5 rounded-lg border text-left transition-all cursor-pointer flex items-center gap-3 min-h-[44px] ${isSelected
                        ? "bg-editor-selected border-editor-selected-border text-editor-selected-foreground shadow-sm"
                        : "bg-card border-border hover:border-primary/50 text-muted-foreground hover:text-foreground"
                        }`}
                    >
                      <div
                        className={`p-2 rounded-md shrink-0 ${isSelected
                          ? "bg-editor-action text-editor-action-foreground"
                          : "bg-secondary text-secondary-foreground"
                          }`}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className={`text-sm font-medium ${isSelected ? "text-editor-selected-foreground" : "text-foreground"}`}>
                          {meta.label}
                        </div>
                        <div className={`text-xs leading-5 mt-0.5 ${isSelected ? "text-editor-selected-foreground/80" : "text-muted-foreground"}`}>
                          {meta.description}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {selectedCategory === "audio" && (
              <div className="space-y-2 pt-2">
                {availableAudioPresets.length === 0 && (
                  <p className="px-2 py-4 text-center text-xs text-muted-foreground">
                    Không tìm thấy file âm thanh phù hợp.
                  </p>
                )}
                {availableAudioPresets.map((preset) => (
                  <button
                    key={preset.src}
                    type="button"
                    onClick={() => {
                      setAudioSrc(preset.src);
                      setSelectedType("audio");
                    }}
                    className={`w-full p-2.5 text-sm text-left rounded-lg border flex items-center justify-between cursor-pointer min-h-[44px] ${audioSrc === preset.src
                      ? "bg-editor-selected border-editor-selected-border text-editor-selected-foreground"
                      : "bg-card border-border text-muted-foreground hover:text-foreground hover:border-primary/50"
                      }`}
                  >
                    <span className="flex items-center gap-2">
                      <Volume2 className="w-3.5 h-3.5" />
                      {preset.label}
                    </span>
                    {audioSrc === preset.src && <Check className="w-4 h-4 text-primary" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Configuration Form */}
          <div className="p-4 rounded-xl bg-secondary/30 border border-border space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-border/60">
              <CurrentIcon className="w-4 h-4 text-accent" />
              <span className="text-sm font-semibold text-foreground">
                {configurationLabel}
              </span>
            </div>

            {/* Slider: Cường độ (Intensity) */}
            <div>
              <div className="flex justify-between text-xs font-medium mb-1.5">
                <span className="text-muted-foreground">Cường độ (Intensity)</span>
                <span className="text-accent font-semibold">{Math.round(intensity * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="1.0"
                step="0.05"
                value={intensity}
                onChange={(e) => setIntensity(parseFloat(e.target.value))}
                className="w-full accent-primary cursor-pointer min-h-[44px]"
              />
            </div>

            {/* Slider: Thời lượng (Duration) */}
            <div>
              <div className="flex justify-between text-xs font-medium mb-1.5">
                <span className="text-muted-foreground">Thời lượng (Duration)</span>
                <span className="text-foreground font-mono font-semibold">{durationMs}ms</span>
              </div>
              <input
                type="range"
                min="200"
                max="10000"
                step="100"
                value={durationMs}
                onChange={(e) => setDurationMs(parseInt(e.target.value, 10))}
                className="w-full accent-primary cursor-pointer min-h-[44px]"
              />
            </div>

            {/* Slider: Độ trễ (Delay) */}
            <div>
              <div className="flex justify-between text-xs font-medium">
                <span className="text-muted-foreground">Độ trễ sau khi xuất hiện (Delay)</span>
                <span className="text-foreground font-mono font-semibold">{delayMs}ms</span>
              </div>
              <input
                type="range"
                min="0"
                max="3000"
                step="50"
                value={delayMs}
                onChange={(e) => setDelayMs(parseInt(e.target.value, 10))}
                className="w-full accent-primary cursor-pointer min-h-[44px]"
              />
            </div>

            {selectedCategory === "audio" && (
              <label
                htmlFor="effect-audio-loop"
                className="flex items-center gap-2.5 text-sm text-foreground cursor-pointer min-h-[44px]"
              >
                <input
                  id="effect-audio-loop"
                  type="checkbox"
                  checked={loopAudio}
                  onChange={(e) => setLoopAudio(e.target.checked)}
                  className="w-4 h-4 rounded border-border accent-primary cursor-pointer"
                />
                <span>Lặp lại âm thanh liên tục</span>
              </label>
            )}

          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border bg-card/60">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg font-editor text-sm bg-secondary text-secondary-foreground hover:bg-muted transition-colors cursor-pointer min-h-[44px]"
          >
            Hủy Bỏ
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-5 py-2 rounded-lg font-editor text-sm font-medium bg-editor-action hover:bg-editor-action-hover text-editor-action-foreground transition-colors cursor-pointer min-h-[44px] flex items-center gap-2 shadow-md"
          >
            <Check className="w-4 h-4" />
            {initialEffect ? "Cập Nhật" : "Xác Nhận"}
          </button>
        </div>
      </div>
    </div>
  );
}
