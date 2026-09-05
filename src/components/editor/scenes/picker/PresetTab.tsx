// src/components/editor/scenes/picker/PresetTab.tsx
// Tab 1: Scene Preset Có Sẵn — Lưới 2 cột, ưu tiên đưa preset đang dùng lên đầu danh sách khi edit (khớp 100% UI gốc)

"use client";

import React, { useState, useMemo } from "react";
import { LegacyScenePreset as ScenePreset, LegacyBackgroundAsset as BackgroundAsset, LegacyColorPalette as ColorPalette } from "@/types/scene-legacy";
import {
  Sparkles,
  Eye,
  Check,
  Volume2,
  Film,
  Search,
  ChevronDown,
} from "lucide-react";
import SearchInput, { matchesSearch } from "@/components/ui/SearchInput";
import { getEffectIcon, EFFECT_METADATA } from "@/lib/effects/effectCatalog";

export interface PresetTabProps {
  presets: ScenePreset[];
  backgrounds: BackgroundAsset[];
  palettes: ColorPalette[];
  selectedPresetId?: string | null;
  selectedBackgroundId?: string;
  initialPresetId?: string | null;
  onSelectPreset: (preset: ScenePreset) => void;
  onQuickPreview: (e: React.MouseEvent, preset: ScenePreset) => void;
}

const INITIAL_PRESET_LIMIT = 10;

export const PresetTab = React.memo(function PresetTab({
  presets,
  backgrounds,
  palettes,
  selectedPresetId,
  selectedBackgroundId,
  initialPresetId,
  onSelectPreset,
  onQuickPreview,
}: PresetTabProps) {
  const [search, setSearch] = useState<string>("");
  const [searchOpen, setSearchOpen] = useState<boolean>(false);
  const [visibleCount, setVisibleCount] = useState<number>(INITIAL_PRESET_LIMIT);

  const backgroundMap = useMemo(() => {
    const map = new Map<string, BackgroundAsset>();
    backgrounds.forEach((bg) => map.set(bg.id, bg));
    return map;
  }, [backgrounds]);

  const paletteMap = useMemo(() => {
    const map = new Map<string, ColorPalette>();
    palettes.forEach((pal) => map.set(pal.id, pal));
    return map;
  }, [palettes]);

  // Đưa preset đang dùng lên đầu danh sách khi đang Edit (có initialPresetId)
  const orderedPresets = useMemo(() => {
    const list = [...presets];
    if (initialPresetId) {
      const idx = list.findIndex((p) => p.id === initialPresetId);
      if (idx > 0) {
        const [usedItem] = list.splice(idx, 1);
        list.unshift(usedItem);
      }
    }
    return list;
  }, [presets, initialPresetId]);

  const filteredPresets = useMemo(() => {
    if (!search.trim()) return orderedPresets;
    return orderedPresets.filter(
      (p) =>
        matchesSearch(search, p.label) ||
        p.mood_tags.some((tag) => matchesSearch(search, tag))
    );
  }, [orderedPresets, search]);

  const visiblePresets = useMemo(
    () => filteredPresets.slice(0, visibleCount),
    [filteredPresets, visibleCount]
  );

  const hasMore = visibleCount < filteredPresets.length;

  return (
    <div className="space-y-4 font-editor">
      {/* Collapsible search trigger bar */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider font-ui text-muted-foreground">
          Danh sách presets ({filteredPresets.length})
        </span>
        <button
          type="button"
          onClick={() => {
            setSearchOpen((open) => !open);
            if (searchOpen) {
              setSearch("");
              setVisibleCount(INITIAL_PRESET_LIMIT);
            }
          }}
          className={`p-2 rounded-xl border transition-colors cursor-pointer min-h-[40px] min-w-[40px] flex items-center justify-center ${
            searchOpen || search.trim()
              ? "bg-primary text-primary-foreground border-primary"
              : "border-border text-muted-foreground hover:bg-secondary hover:text-foreground"
          }`}
          aria-label={searchOpen ? "Đóng tìm kiếm preset" : "Tìm kiếm preset"}
          title={searchOpen ? "Đóng tìm kiếm" : "Tìm kiếm preset"}
        >
          <Search className="w-4 h-4" />
        </button>
      </div>

      {/* Collapsible Search Input */}
      {searchOpen && (
        <div className="animate-fade-in">
          <SearchInput
            value={search}
            onChange={(v) => {
              setSearch(v);
              setVisibleCount(INITIAL_PRESET_LIMIT);
            }}
            placeholder="Tìm scene preset theo tên, mood tags..."
            autoFocus={true}
          />
        </div>
      )}

      {/* Preset Grid (2 Cột) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {visiblePresets.map((preset) => {
          const bg = backgroundMap.get(preset.background_id);
          const pal = paletteMap.get(preset.palette_id);
          const isSelected =
            selectedPresetId === preset.id &&
            (selectedBackgroundId ? selectedBackgroundId === preset.background_id : true);

          const audioEffect = preset.effects?.find(
            (e) => e.type === "audio" || e.category === "audio"
          );
          const hasAudio = Boolean(audioEffect?.audio_src);

          const nonAudioEffects =
            preset.effects?.filter(
              (e) => e.type !== "audio" && e.category !== "audio"
            ) || [];

          return (
            <article
              key={preset.id}
              className={`rounded-2xl border p-3.5 transition-all duration-200 relative group flex flex-col justify-between min-h-[140px] ${
                isSelected
                  ? "bg-primary/10 border-primary ring-2 ring-primary/40 shadow-md"
                  : "bg-secondary/30 border-border hover:border-primary/50 hover:bg-secondary/60 hover:shadow-xs"
              }`}
            >
              <button
                type="button"
                onClick={() => onSelectPreset(preset)}
                aria-label={`Chọn preset ${preset.label}`}
                aria-pressed={isSelected}
                className="absolute inset-0 z-0 rounded-2xl cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              />
              <div className="relative z-[1] pointer-events-none">
                {/* Top preview thumbnail */}
                <div className="h-28 rounded-xl overflow-hidden mb-3 relative border border-border/40 bg-card">
                  {bg?.type === "gradient" && (
                    <div
                      className="w-full h-full group-hover:scale-105 transition-transform duration-500"
                      style={{ background: bg.value }}
                    />
                  )}
                  {bg?.type === "image" && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={bg.value}
                      alt={preset.label}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  )}
                  {bg?.type === "video" && (
                    <div className="w-full h-full bg-slate-900 flex items-center justify-center text-xs text-cyan-400">
                      <Film className="w-5 h-5 mr-1.5" /> Video Nền
                    </div>
                  )}
                  {bg?.type === "particle_composition" && (
                    <div className="w-full h-full bg-emerald-950 flex items-center justify-center text-xs text-emerald-400">
                      <Sparkles className="w-5 h-5 mr-1.5" /> Particle Nền
                    </div>
                  )}

                  {/* Gradient Tint Overlay */}
                  {pal && (
                    <div
                      className="absolute inset-0 pointer-events-none opacity-60 mix-blend-multiply"
                      style={{
                        background: `linear-gradient(180deg, transparent 0%, ${pal.colors.background_tint || pal.colors.primary} 100%)`,
                      }}
                    />
                  )}

                  {/* Action buttons on card hover */}
                  <div className="absolute top-2 right-2 flex items-center gap-1.5 z-10">
                    {/* Quick Preview 1-Click button */}
                    <button
                      type="button"
                      onClick={(e) => onQuickPreview(e, preset)}
                      className="pointer-events-auto p-2 rounded-xl bg-black/60 hover:bg-black/80 text-white/90 backdrop-blur-md transition-colors cursor-pointer shadow-sm min-h-[34px] min-w-[34px] flex items-center justify-center"
                      title="Xem trước toàn màn hình"
                      aria-label="Xem trước toàn màn hình"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Selected checkmark */}
                  {isSelected && (
                    <div className="absolute top-2 left-2 p-1.5 rounded-full bg-primary text-primary-foreground shadow-md z-10">
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    </div>
                  )}
                </div>

                {/* Preset Info */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-bold text-sm text-foreground group-hover:text-primary transition-colors line-clamp-1">
                      {preset.label}
                    </h3>
                    <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">
                      {bg?.label || "Bối cảnh"} • {pal?.label || "Bảng màu"}
                    </p>
                  </div>

                  {/* Color Swatch Dots */}
                  {pal && (
                    <div className="flex items-center gap-1 shrink-0 p-1 rounded-lg bg-card/80 border border-border/40 shadow-2xs">
                      <span
                        className="w-3 h-3 rounded-full border border-white/20 shadow-xs"
                        style={{ backgroundColor: pal.colors.primary }}
                        title={`Primary: ${pal.colors.primary}`}
                      />
                      <span
                        className="w-3 h-3 rounded-full border border-white/20 shadow-xs"
                        style={{ backgroundColor: pal.colors.accent }}
                        title={`Accent: ${pal.colors.accent}`}
                      />
                      <span
                        className="w-3 h-3 rounded-full border border-white/20 shadow-xs"
                        style={{ backgroundColor: pal.colors.secondary }}
                        title={`Secondary: ${pal.colors.secondary}`}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Bottom Tags */}
              <div className="relative z-[1] pointer-events-none flex flex-wrap items-center gap-1.5 mt-3 pt-2.5 border-t border-border/40 text-[10px]">
                {hasAudio && (
                  <span className="px-2 py-0.5 rounded-md bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 flex items-center gap-1 font-mono">
                    <Volume2 className="w-3 h-3" /> Âm thanh
                  </span>
                )}

                {nonAudioEffects.map((eff) => {
                  const Icon = getEffectIcon(eff.type, eff.category);
                  const meta = EFFECT_METADATA[eff.type];
                  return (
                    <span
                      key={eff.id || eff.type}
                      className="px-2 py-0.5 rounded-md bg-secondary/80 text-foreground border border-border/60 flex items-center gap-1"
                    >
                      <Icon className="w-3 h-3 text-accent" />
                      <span>{meta?.label?.split(" (")[0] || eff.type}</span>
                    </span>
                  );
                })}

                {preset.mood_tags?.map((tag) => (
                  <span
                    key={tag}
                    className="px-2 py-0.5 rounded-md bg-secondary/40 text-muted-foreground border border-border/30"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            </article>
          );
        })}
      </div>

      {/* Preset Pagination Button */}
      {hasMore && (
        <div className="flex justify-center pt-2">
          <button
            type="button"
            onClick={() => setVisibleCount((c) => c + INITIAL_PRESET_LIMIT)}
            className="px-5 py-2.5 rounded-xl border border-border bg-secondary/40 hover:bg-secondary text-xs font-ui font-semibold text-foreground transition-colors cursor-pointer min-h-[40px] flex items-center gap-2"
          >
            <ChevronDown className="w-4 h-4" />
            Xem thêm ({filteredPresets.length - visibleCount} presets còn lại)
          </button>
        </div>
      )}

      {filteredPresets.length === 0 && (
        <div className="py-16 text-center text-muted-foreground text-sm font-ui">
          Không tìm thấy preset nào khớp với &ldquo;{search}&rdquo;
        </div>
      )}
    </div>
  );
});

export default PresetTab;
