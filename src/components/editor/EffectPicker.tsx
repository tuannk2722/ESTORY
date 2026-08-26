// components/editor/EffectPicker.tsx
// Phase 2: Modal chọn & cấu hình hiệu ứng cho block (US-2.2)
"use client";

import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { EffectConfig, EffectType, EffectCategory } from "@/types/story";
import {
  EFFECT_CATEGORIES,
  EFFECT_METADATA,
  AUDIO_EFFECT_PRESETS,
} from "./effect-meta";
import { EFFECT_REGISTRY } from "@/components/effects/EffectRegistry";
import { Howl } from "howler";
import { X, Sparkles, Sliders, Volume2, Check, Search, Play, Square, Eye } from "lucide-react";
import SearchInput, { matchesSearch } from "@/components/ui/SearchInput";

export interface EffectPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveEffect: (effect: EffectConfig) => void;
  initialEffect?: EffectConfig | null;
  presetType?: EffectType | null;
}

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
  const [selectedType, setSelectedType] = useState<EffectType | null>(
    initialEffect?.type ?? initialMeta?.type ?? null
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
    initialEffect?.audio_src ?? ""
  );
  const [isLoop, setIsLoop] = useState<boolean>(initialEffect?.loop ?? false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // ── Preview state ──
  const [previewEffect, setPreviewEffect] = useState<EffectConfig | null>(null);
  const [previewingAudioSrc, setPreviewingAudioSrc] = useState<string | null>(null);
  const previewAudioRef = useRef<Howl | null>(null);
  const previewTimerRef = useRef<NodeJS.Timeout | null>(null);

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

  // ── Audio preview: play/stop ──
  const stopAudioPreview = useCallback(() => {
    if (previewAudioRef.current) {
      previewAudioRef.current.stop();
      previewAudioRef.current.unload();
      previewAudioRef.current = null;
    }
    setPreviewingAudioSrc(null);
  }, []);

  const toggleAudioPreview = useCallback((src: string) => {
    // Nếu đang phát cùng src → stop
    if (previewingAudioSrc === src) {
      stopAudioPreview();
      return;
    }
    // Stop bản trước nếu có
    stopAudioPreview();

    // Nếu là audio đang chọn → lấy theo slider intensity; nếu chưa chọn → lấy âm lượng mặc định 0.8
    const isCurrentSelected = src === audioSrc;
    const previewVolume = isCurrentSelected ? intensity : 0.8;

    // Phát bản mới
    try {
      const howl = new Howl({
        src: [src],
        volume: Math.max(0.1, Math.min(1.0, previewVolume)),
        loop: isLoop,
        html5: false,
        format: ["mp3", "wav"],
        onend: () => {
          if (!isLoop) setPreviewingAudioSrc(null);
        },
        onloaderror: () => setPreviewingAudioSrc(null),
        onplayerror: () => {
          howl.once("unlock", () => howl.play());
        },
      });
      previewAudioRef.current = howl;
      setPreviewingAudioSrc(src);
      howl.play();
    } catch {
      setPreviewingAudioSrc(null);
    }
  }, [previewingAudioSrc, stopAudioPreview, audioSrc, intensity, isLoop]);

  // ── Visual/Motion/Transition preview ──
  const triggerEffectPreview = useCallback((type: EffectType, category: EffectCategory) => {
    // Clear timer trước đó nếu còn
    if (previewTimerRef.current) {
      clearTimeout(previewTimerRef.current);
      previewTimerRef.current = null;
    }
    setPreviewEffect(null);

    const isCurrentSelected = type === selectedType && category === selectedCategory;
    const meta = EFFECT_METADATA[type];
    const previewIntensity = isCurrentSelected ? intensity : (meta?.defaultIntensity ?? 0.8);
    const previewDuration = isCurrentSelected ? durationMs : (meta?.defaultDurationMs ?? 2000);

    // Đợi 1 frame để reset rồi trigger lại (đảm bảo re-mount component)
    requestAnimationFrame(() => {
      const config: EffectConfig = {
        id: `preview-${Date.now()}`,
        type,
        category,
        intensity: Number(previewIntensity.toFixed(2)),
        duration_ms: Math.round(previewDuration),
        delay_ms: 0,
        loop: true, // Luôn bật loop trong lúc preview để tác giả quan sát liên tục
      };
      setPreviewEffect(config);

      // Tự động clear sau 5s nếu không chủ động đổi
      previewTimerRef.current = setTimeout(() => {
        setPreviewEffect(null);
        previewTimerRef.current = null;
      }, 5000);
    });
  }, [selectedType, selectedCategory, intensity, durationMs]);

  // ── Cleanup audio khi đóng modal ──
  useEffect(() => {
    return () => {
      stopAudioPreview();
      if (previewTimerRef.current) {
        clearTimeout(previewTimerRef.current);
      }
      setPreviewEffect(null);
    };
  }, [stopAudioPreview]);

  const initialSelectedType = initialEffect?.type ?? presetType ?? null;
  const initialAudioSrc = initialEffect?.audio_src ?? null;

  const isSelectedInCurrentCategory =
    selectedCategory === "audio"
      ? Boolean(audioSrc)
      : Boolean(selectedType && EFFECT_METADATA[selectedType]?.category === selectedCategory);

  const isSaveDisabled = !isSelectedInCurrentCategory;

  const handleSave = () => {
    if (isSaveDisabled) return;

    // Stop mọi preview trước khi save
    stopAudioPreview();
    setPreviewEffect(null);

    const resolvedType = selectedCategory === "audio" ? "audio" : selectedType!;
    const config: EffectConfig = {
      id: initialEffect?.id || `eff-${Date.now().toString().slice(-6)}`,
      type: resolvedType,
      category: selectedCategory,
      intensity: Number(intensity.toFixed(2)),
      duration_ms: Math.round(durationMs),
      delay_ms: Math.round(delayMs),
      loop: isLoop,
      ...(selectedCategory === "audio" ? { audio_src: audioSrc } : {}),
    };
    onSaveEffect(config);
    onClose();
  };

  const availableEffects = useMemo(() => {
    if (selectedCategory === "audio") return [];
    const list = Object.values(EFFECT_METADATA).filter((meta) => {
      return (
        meta.category === selectedCategory &&
        matchesSearch(searchQuery, meta.type, meta.label, meta.description)
      );
    });

    // Nếu đang EDIT effect thuộc category này, đưa effect ban đầu lên đầu danh sách khi mở modal
    if (initialSelectedType) {
      const idx = list.findIndex((m) => m.type === initialSelectedType);
      if (idx > 0) {
        const [item] = list.splice(idx, 1);
        list.unshift(item);
      }
    }
    return list;
  }, [selectedCategory, searchQuery, initialSelectedType]);

  const availableAudioPresets = useMemo(() => {
    const list = AUDIO_EFFECT_PRESETS.filter((preset) => {
      return matchesSearch(searchQuery, preset.label, preset.src);
    });

    // Nếu đang EDIT audio effect, đưa file audio ban đầu lên đầu danh sách khi mở modal
    if (initialAudioSrc) {
      const idx = list.findIndex((p) => p.src === initialAudioSrc);
      if (idx > 0) {
        const [item] = list.splice(idx, 1);
        list.unshift(item);
      }
    }
    return list;
  }, [searchQuery, initialAudioSrc]);

  if (!isOpen) return null;

  const currentMeta = selectedType ? EFFECT_METADATA[selectedType] : undefined;
  const CurrentIcon = selectedCategory === "audio" ? Volume2 : currentMeta?.icon || Sparkles;

  const optionCount = selectedCategory === "audio" ? availableAudioPresets.length : availableEffects.length;
  const selectedAudioPreset = AUDIO_EFFECT_PRESETS.find((preset) => preset.src === audioSrc);
  const configurationLabel = `Cấu hình thông số: ${selectedCategory === "audio"
    ? selectedAudioPreset?.label || "Âm thanh"
    : currentMeta?.label || selectedType || "Hiệu ứng"}`;
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
                className={`shrink-0 p-2 rounded-lg border transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center ${searchOpen
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border text-muted-foreground hover:bg-secondary hover:text-foreground"
                  }`}
                aria-label={searchOpen ? "Đóng tìm kiếm hiệu ứng" : "Tìm kiếm hiệu ứng"}
                title={searchOpen ? "Đóng tìm kiếm" : "Tìm kiếm hiệu ứng"}
              >
                <Search className="w-4 h-4" />
              </button>
            </div>
            {searchOpen && (
              <SearchInput
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder={`Tìm trong nhóm ${selectedCategoryLabel.toLocaleLowerCase()}...`}
                autoFocus={true}
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
                  const isCurrentlyPreviewing = previewEffect?.type === meta.type;
                  return (
                    <div
                      key={meta.type}
                      className={`w-full p-2.5 rounded-lg border text-left transition-all flex items-center gap-3 min-h-[44px] ${isSelected
                        ? "bg-editor-selected border-editor-selected-border text-editor-selected-foreground shadow-sm"
                        : "bg-card border-border hover:border-primary/50 text-muted-foreground hover:text-foreground"
                        }`}
                    >
                      {/* Icon + label — click để chọn effect */}
                      <button
                        type="button"
                        onClick={() => handleSelectType(meta.type)}
                        className="flex-1 flex items-center gap-3 text-left cursor-pointer min-w-0"
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

                      {/* Nút preview inline */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          triggerEffectPreview(meta.type, meta.category);
                        }}
                        className={`shrink-0 p-1.5 rounded-md transition-all flex items-center justify-center min-w-[32px] min-h-[32px] ${isCurrentlyPreviewing
                          ? "bg-accent/20 text-accent cursor-pointer"
                          : "bg-primary/10 text-primary hover:bg-primary/20 cursor-pointer"
                          }`}
                        aria-label={`Xem trước ${meta.label}`}
                        title={
                          isSelected
                            ? "Xem trước (theo thông số cấu hình đang chỉnh)"
                            : "Xem trước (thông số mặc định)"
                        }
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    </div>
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
                {availableAudioPresets.map((preset) => {
                  const isPlaying = previewingAudioSrc === preset.src;
                  return (
                    <div
                      key={preset.src}
                      className={`w-full p-2.5 text-sm rounded-lg border flex items-center gap-2 min-h-[44px] transition-all ${audioSrc === preset.src
                        ? "bg-editor-selected border-editor-selected-border text-editor-selected-foreground"
                        : "bg-card border-border text-muted-foreground hover:text-foreground hover:border-primary/50"
                        }`}
                    >
                      {/* Nút Play/Stop preview */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleAudioPreview(preset.src);
                        }}
                        className={`shrink-0 p-1.5 rounded-md transition-all cursor-pointer flex items-center justify-center min-w-[32px] min-h-[32px] ${isPlaying
                          ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                          : "bg-primary/10 text-primary hover:bg-primary/20"
                          }`}
                        aria-label={isPlaying ? `Dừng phát ${preset.label}` : `Nghe thử ${preset.label}`}
                        title={isPlaying ? "Dừng" : "Nghe thử"}
                      >
                        {isPlaying ? <Square className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                      </button>

                      {/* Label — click để chọn preset */}
                      <button
                        type="button"
                        onClick={() => {
                          setAudioSrc(preset.src);
                          setSelectedType("audio");
                        }}
                        className="flex-1 text-left cursor-pointer min-h-[32px] flex items-center"
                      >
                        {preset.label}
                      </button>

                      {audioSrc === preset.src && <Check className="w-4 h-4 text-primary shrink-0" />}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Configuration Form */}
          {!isSelectedInCurrentCategory ? (
            <div className="p-6 rounded-xl bg-secondary/20 border border-dashed border-border/80 text-center space-y-2">
              <Sliders className="w-6 h-6 mx-auto text-muted-foreground/50" />
              <p className="text-sm font-medium text-foreground">Chưa chọn hiệu ứng</p>
              <p className="text-xs text-muted-foreground">
                Vui lòng chọn 1 {selectedCategory === "audio" ? "âm thanh" : "hiệu ứng"} ở danh sách phía trên để tùy chỉnh thông số chi tiết.
              </p>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-secondary/30 border border-border space-y-4">
              <div className="flex items-center justify-between gap-2 pb-2 border-b border-border/60">
                <div className="flex items-center gap-2">
                  <CurrentIcon className="w-4 h-4 text-accent" />
                  <span className="text-sm font-semibold text-foreground">
                    {configurationLabel}
                  </span>
                </div>
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

              {/* Toggle: Lặp lại liên tục (Loop) */}
              <label
                htmlFor="effect-universal-loop"
                className="flex items-center justify-between p-3 rounded-xl bg-secondary/50 border border-border text-sm text-foreground cursor-pointer min-h-[44px] hover:bg-secondary/80 transition-colors"
              >
                <div className="flex flex-col pr-3">
                  <span className="font-medium text-foreground">Lặp lại liên tục</span>
                  <span className="text-xs text-muted-foreground">
                    {selectedCategory === "audio"
                      ? "Lặp lại âm thanh nền du dương suốt thời gian đọc"
                      : "Giữ hoạt ảnh hạt / ánh sáng chuyển động liên tục không tự ngắt"}
                  </span>
                </div>
                <input
                  id="effect-universal-loop"
                  type="checkbox"
                  checked={isLoop}
                  onChange={(e) => setIsLoop(e.target.checked)}
                  className="w-4 h-4 rounded border-border accent-primary cursor-pointer"
                />
              </label>
            </div>
          )}
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
            disabled={isSaveDisabled}
            className="px-5 py-2 rounded-lg font-editor text-sm font-medium bg-editor-action hover:bg-editor-action-hover text-editor-action-foreground transition-colors cursor-pointer min-h-[44px] flex items-center gap-2 shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
            title={
              isSaveDisabled
                ? "Vui lòng chọn 1 hiệu ứng trước khi lưu"
                : initialEffect
                  ? "Cập Nhật"
                  : "Xác Nhận"
            }
          >
            <Check className="w-4 h-4" />
            {initialEffect ? "Cập Nhật" : "Xác Nhận"}
          </button>
        </div>

        {/* ── Preview Effect Layer — phủ toàn trang viewport qua createPortal với z-index cao (z-[70]) để hiển thị nổi bật trên Modal (z-50) ── */}
        {previewEffect && (() => {
          const Component = EFFECT_REGISTRY[previewEffect.type];
          if (!Component) return null;
          const element = (
            <div className="effect-modal-preview-portal pointer-events-none fixed inset-0 z-[70] overflow-hidden">
              <Component config={previewEffect} isActive={true} intensityMultiplier={1} />
            </div>
          );
          if (typeof document !== "undefined" && document.body) {
            return createPortal(element, document.body);
          }
          return element;
        })()}
      </div>
    </div>
  );
}
