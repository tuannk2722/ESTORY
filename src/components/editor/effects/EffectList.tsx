// src/components/editor/effects/EffectList.tsx
// Category tabs, searchable effect list, quick visual preview, and audio presets.

"use client";

import React, { useId, useMemo, useState } from "react";
import type { EffectCategory, EffectType } from "@/types/story";
import { Check, Eye, Search } from "lucide-react";
import SoundRow from "../audio/SoundRow";
import SearchInput from "@/components/ui/SearchInput";
import { matchesEffectSearch } from "@/lib/effects/effect-search";
import {
  AUDIO_EFFECT_PRESETS,
  EFFECT_CATEGORIES,
  getEffectIcon,
} from "@/lib/effects/effectCatalog";
import {
  getActiveEffectDefinition,
  getAuthorEffectPresentation,
  getSelectableEffects,
} from "@/lib/effects/effect-authoring";
import { useEditorEffectCatalog, useEditorEffectSearchKeywords } from "../EditorProvider";

export interface EffectListProps {
  selectedType: EffectType | null;
  selectedCategory: EffectCategory;
  selectedAudioSrc: string;
  initialEffectType?: EffectType | null;
  previewingAudioSrc: string | null;
  onSelectType: (type: EffectType) => void;
  onSelectCategory: (category: EffectCategory) => void;
  onSelectAudioPreset: (src: string) => void;
  onPreviewEffect: (type: EffectType) => void;
  onToggleAudioPreview: (src: string) => void;
}

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card";

export const EffectList = React.memo(function EffectList({
  selectedType,
  selectedCategory,
  selectedAudioSrc,
  initialEffectType,
  previewingAudioSrc,
  onSelectType,
  onSelectCategory,
  onSelectAudioPreset,
  onPreviewEffect,
  onToggleAudioPreview,
}: EffectListProps) {
  const effectCatalog = useEditorEffectCatalog();
  const searchKeywords = useEditorEffectSearchKeywords();
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState("");
  const searchId = useId();

  const filteredEffects = useMemo(() => {
    const effects = getSelectableEffects(effectCatalog, "block", selectedCategory).filter(
      (effect) =>
        effect.id !== "audio" &&
        matchesEffectSearch(search, effect.label, effect.description ?? "", effect.id, ...(searchKeywords.get(effect.id) ?? []))
    );

    if (!search.trim() && initialEffectType) {
      const selectedIndex = effects.findIndex(
        (effect) => effect.id === initialEffectType
      );
      if (selectedIndex > 0) {
        const [selectedEffect] = effects.splice(selectedIndex, 1);
        if (selectedEffect) effects.unshift(selectedEffect);
      }
    }

    return effects;
  }, [effectCatalog, searchKeywords, initialEffectType, search, selectedCategory]);

  const activeAudio = Boolean(
    getActiveEffectDefinition(effectCatalog, "audio")?.allowed_scopes.includes("block"),
  );

  const filteredAudioPresets = useMemo(
    () =>
      activeAudio
        ? AUDIO_EFFECT_PRESETS.filter((preset) =>
            matchesEffectSearch(search, preset.label, preset.src, "audio", ...preset.keywords)
          )
        : [],
    [activeAudio, search]
  );

  const retainedPresentation = initialEffectType
    ? getAuthorEffectPresentation(effectCatalog, initialEffectType)
    : null;
  const retainedUnavailable = Boolean(retainedPresentation && !retainedPresentation.isActive);
  const visibleCategories = EFFECT_CATEGORIES.filter((category) =>
    getSelectableEffects(effectCatalog, "block", category.id).length > 0
    || (retainedUnavailable && retainedPresentation?.category === category.id),
  );

  const resultCount =
    selectedCategory === "audio"
      ? filteredAudioPresets.length
      : filteredEffects.length;

  return (
    <section className="space-y-3" aria-label="Chọn hiệu ứng">
      <div className="flex items-center justify-between gap-2 border-b border-border/80 bg-secondary/30 px-4 py-3 sm:px-6">
        <div
          className="flex min-w-0 items-center gap-1.5 overflow-x-auto py-0.5 custom-scrollbar"
          aria-label="Nhóm hiệu ứng"
        >
          {visibleCategories.map((category) => {
            const isActive = selectedCategory === category.id;
            return (
              <button
                key={category.id}
                type="button"
                aria-pressed={isActive}
                onClick={() => {
                  onSelectCategory(category.id);
                  setSearch("");
                }}
                className={`min-h-11 shrink-0 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs text-editor-action-foreground font-semibold transition-colors motion-reduce:transition-none ${focusRing} ${isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "border border-border/40 bg-secondary/60 text-muted-foreground hover:bg-secondary hover:text-foreground"
                  }`}
              >
                {category.label}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => setSearchOpen((current) => !current)}
          className={`flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg border transition-colors motion-reduce:transition-none ${focusRing} ${searchOpen || search.trim()
            ? "border-primary/40 bg-primary/15 text-primary"
            : "border-border bg-secondary/60 text-muted-foreground hover:text-foreground"
            }`}
          aria-label="Tìm kiếm hiệu ứng"
          aria-expanded={searchOpen}
          aria-controls={searchId}
          title="Tìm kiếm hiệu ứng"
        >
          <Search className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      {searchOpen && (
        <div
          id={searchId}
          className="border-b border-border/60 bg-secondary/40 px-4 py-2.5 motion-safe:animate-fade-in sm:px-6"
        >
          <label className="block">
            <span className="sr-only">Tìm theo tên, mã, mô tả hoặc từ khóa hiệu ứng</span>
            <SearchInput
              placeholder="Tìm theo tên, mã, mô tả hoặc từ khóa..."
              value={search}
              onChange={setSearch}
              autoFocus
              className="[&_button]:min-h-11 [&_button]:min-w-11 [&_input]:pr-12"
            />
          </label>
        </div>
      )}

      <div className="space-y-2.5 px-4 sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Danh sách {selectedCategory === "audio" ? "âm thanh" : "hiệu ứng"} ({resultCount})
        </p>

        <div
          className="grid max-h-56 grid-cols-1 gap-2.5 overflow-y-auto pr-1 custom-scrollbar sm:grid-cols-2"
        >
          {retainedUnavailable && retainedPresentation?.category === selectedCategory && !search.trim() && (
            <div className="col-span-full flex min-h-14 items-center gap-2.5 rounded-xl border border-dashed border-amber-500/50 bg-amber-500/10 p-3 text-left text-xs">
              <retainedPresentation.icon className="h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
              <span className="min-w-0">
                <span className="block font-semibold text-foreground">{retainedPresentation.label}</span>
                <span className="block text-muted-foreground">Hiệu ứng đã lưu này không còn dành cho lựa chọn mới, nhưng bạn vẫn có thể chỉnh thông số hiện tại.</span>
              </span>
            </div>
          )}
          {selectedCategory === "audio" ? (
            filteredAudioPresets.length === 0 && !(retainedUnavailable && retainedPresentation?.category === selectedCategory) ? (
              <EmptySearchResult />
            ) : (
              filteredAudioPresets.map((preset) => {
                const isSelected =
                  selectedType === "audio" && selectedAudioSrc === preset.src;
                const isPlaying = previewingAudioSrc === preset.src;

                return (
                  <SoundRow
                    key={preset.src}
                    title={preset.label}
                    description={`${preset.duration ? `${preset.duration} · ` : ""}${preset.source ?? "Hệ thống"}`}
                    selected={isSelected}
                    playing={isPlaying}
                    onPreview={() => onToggleAudioPreview(preset.src)}
                    onSelect={() => onSelectAudioPreset(preset.src)}
                  />
                );
              })
            )
          ) : filteredEffects.length === 0 && !(retainedUnavailable && retainedPresentation?.category === selectedCategory) ? (
            <EmptySearchResult />
          ) : (
            <>
              {filteredEffects.map((effect) => {
                const isSelected = selectedType === effect.id;
                const Icon = getEffectIcon(effect.id, effect.category);

                return (
                  <div
                    key={effect.id}
                    className={`flex min-h-14 items-stretch gap-1 rounded-xl border text-left transition-colors motion-reduce:transition-none ${isSelected
                      ? "border-primary bg-primary/10 text-primary ring-1 ring-primary/40 shadow-xs"
                      : "border-border bg-secondary/30 text-foreground hover:border-border hover:bg-secondary/70"
                      }`}
                  >
                    <button
                      type="button"
                      onClick={() => onSelectType(effect.id)}
                      aria-pressed={isSelected}
                      className={`flex min-w-0 flex-1 items-start gap-2.5 rounded-xl p-3 text-left ${focusRing}`}
                    >
                      <Icon
                        className={`mt-0.5 h-4 w-4 shrink-0 ${isSelected ? "text-primary" : "text-accent"
                          }`}
                        aria-hidden="true"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-bold">
                          {effect.label}
                        </span>
                        <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                          {effect.description}
                        </span>
                      </span>
                      {isSelected && (
                        <Check className="h-4 w-4 shrink-0" aria-hidden="true" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => onPreviewEffect(effect.id)}
                      className={`flex min-h-11 min-w-11 shrink-0 items-center justify-center self-center rounded-md text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary motion-reduce:transition-none ${focusRing}`}
                      title="Xem trước 5 giây"
                      aria-label={`Xem trước ${effect.label}`}
                    >
                      <Eye className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>
    </section>
  );
});

function EmptySearchResult() {
  return (
    <p className="col-span-full py-8 text-center text-xs text-muted-foreground">
      Không tìm thấy hiệu ứng phù hợp
    </p>
  );
}
