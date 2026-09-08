// src/components/editor/scenes/picker/BackgroundPicker.tsx
// Bước 1: Chọn Bối Cảnh Nền — Lưới 3 cột/2 cột, ưu tiên đưa bối cảnh đang dùng lên đầu danh sách khi edit (khớp 100% UI gốc)

"use client";

import React, { useState, useMemo } from "react";
import type { BackgroundAsset } from "@/types/scene";
import { backgroundSnapshotToPresentation } from "@/lib/scenes/scene-presentation";
import { Check, Film, Sparkles, Search, ChevronDown } from "lucide-react";
import SearchInput, { matchesSearch } from "@/components/ui/SearchInput";

export type BackgroundOption = Pick<BackgroundAsset, "id" | "label" | "mood_tags" | "render">;

export interface BackgroundPickerProps {
  backgrounds: BackgroundOption[];
  selectedBackgroundId: string;
  onSelectBackground: (id: string) => void;
  initialBackgroundId?: string;
}

const INITIAL_BACKGROUND_LIMIT = 6;

export const BackgroundPicker = React.memo(function BackgroundPicker({
  backgrounds,
  selectedBackgroundId,
  onSelectBackground,
  initialBackgroundId,
}: BackgroundPickerProps) {
  const [search, setSearch] = useState<string>("");
  const [searchOpen, setSearchOpen] = useState<boolean>(false);
  const [visibleCount, setVisibleCount] = useState<number>(INITIAL_BACKGROUND_LIMIT);

  // Đưa bối cảnh đang dùng lên đầu danh sách khi đang Edit (có initialBackgroundId)
  const orderedBackgrounds = useMemo(() => {
    const list = [...backgrounds];
    if (initialBackgroundId) {
      const idx = list.findIndex((b) => b.id === initialBackgroundId);
      if (idx > 0) {
        const [usedItem] = list.splice(idx, 1);
        list.unshift(usedItem);
      }
    }
    return list;
  }, [backgrounds, initialBackgroundId]);

  const filteredBackgrounds = useMemo(() => {
    if (!search.trim()) return orderedBackgrounds;
    return orderedBackgrounds.filter(
      (bg) =>
        matchesSearch(search, bg.label) ||
        bg.mood_tags.some((tag) => matchesSearch(search, tag))
    );
  }, [orderedBackgrounds, search]);

  const visibleBackgrounds = useMemo(
    () => filteredBackgrounds.slice(0, visibleCount),
    [filteredBackgrounds, visibleCount]
  );

  const hasMore = visibleCount < filteredBackgrounds.length;

  return (
    <div className="p-5 rounded-2xl bg-secondary/30 border border-border/60 space-y-4 font-editor">
      {/* Header with Search Button */}
      <div className="flex items-center justify-between gap-2">
        <label className="text-sm font-bold text-foreground flex items-center gap-2 font-ui">
          1. Chọn Bối Cảnh Nền (Background)
        </label>
        <button
          type="button"
          onClick={() => {
            setSearchOpen((open) => !open);
            if (searchOpen) {
              setSearch("");
              setVisibleCount(INITIAL_BACKGROUND_LIMIT);
            }
          }}
          className={`p-1.5 rounded-lg border transition-colors cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center ${searchOpen || search.trim()
              ? "bg-primary text-primary-foreground border-primary"
              : "border-border text-muted-foreground hover:bg-secondary hover:text-foreground"
            }`}
          aria-label={searchOpen ? "Đóng tìm kiếm bối cảnh" : "Tìm kiếm bối cảnh"}
          title={searchOpen ? "Đóng tìm kiếm" : "Tìm kiếm bối cảnh"}
        >
          <Search className="w-4 h-4" />
        </button>
      </div>

      {/* Collapsible Search input */}
      {searchOpen && (
        <div className="animate-fade-in">
          <SearchInput
            value={search}
            onChange={(v) => {
              setSearch(v);
              setVisibleCount(INITIAL_BACKGROUND_LIMIT);
            }}
            placeholder="Tìm bối cảnh theo tên, loại..."
            className="mb-3"
            autoFocus={true}
          />
        </div>
      )}

      {/* Expanded scrollable background grid container (max-h-[320px]) */}
      <div className="max-h-[320px] overflow-y-auto custom-scrollbar rounded-2xl border border-border/60 bg-secondary/15 p-3.5">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3.5">
          {visibleBackgrounds.map((item) => {
            const bg = { ...backgroundSnapshotToPresentation(item.render), ...item };
            const isSelected = selectedBackgroundId === bg.id;

            return (
              <button
                type="button"
                key={bg.id}
                onClick={() => onSelectBackground(bg.id)}
                aria-pressed={isSelected}
                className={`w-full text-left rounded-xl border p-3 cursor-pointer transition-all ${isSelected
                    ? "bg-primary/15 border-primary ring-2 ring-primary/30 shadow-xs"
                    : "bg-card border-border hover:border-primary/40 hover:bg-secondary/40"
                  }`}
              >
                <div className="h-20 rounded-lg overflow-hidden mb-2 relative border border-border/40 bg-card">
                  {bg.type === "gradient" && (
                    <div className="w-full h-full" style={{ background: bg.value }} />
                  )}
                  {bg.type === "image" && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={bg.value}
                      alt={bg.label}
                      className="w-full h-full object-cover"
                    />
                  )}
                  {bg.type === "video" && (
                    <div className="w-full h-full bg-slate-900 flex items-center justify-center text-xs text-cyan-400">
                      <Film className="w-4 h-4 mr-1" /> Video Loop
                    </div>
                  )}
                  {bg.type === "particle_composition" && (
                    <div className="w-full h-full bg-emerald-950 flex items-center justify-center text-xs text-emerald-400">
                      <Sparkles className="w-4 h-4 mr-1" /> Particle
                    </div>
                  )}
                  {isSelected && (
                    <div className="absolute top-1.5 right-1.5 p-1 rounded-full bg-primary text-primary-foreground shadow-sm">
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    </div>
                  )}
                </div>
                <div className="text-xs font-semibold text-foreground line-clamp-1">
                  {bg.label}
                </div>
                <div className="text-[10px] text-muted-foreground uppercase font-mono mt-0.5">
                  {bg.type} • {bg.motion}
                </div>
              </button>
            );
          })}
        </div>

        {/* Background "Xem thêm" button */}
        {hasMore && (
          <div className="flex justify-center pt-3 pb-1">
            <button
              type="button"
              onClick={() => setVisibleCount((c) => c + INITIAL_BACKGROUND_LIMIT)}
              className="px-4 py-2 rounded-xl border border-border bg-card hover:bg-secondary text-xs font-ui font-medium text-foreground transition-colors cursor-pointer min-h-[38px] flex items-center gap-1.5"
            >
              <ChevronDown className="w-3.5 h-3.5" />
              Xem thêm ({filteredBackgrounds.length - visibleCount} bối cảnh còn lại)
            </button>
          </div>
        )}

        {filteredBackgrounds.length === 0 && search && (
          <div className="py-10 text-center text-muted-foreground text-sm font-ui">
            Không tìm thấy bối cảnh nào khớp với &ldquo;{search}&rdquo;
          </div>
        )}
      </div>
    </div>
  );
});

export default BackgroundPicker;
