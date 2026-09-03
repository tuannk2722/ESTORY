// src/components/editor/blocks/BlockEffects.tsx
// Danh sách chip hiệu ứng gắn kèm và thanh gợi ý từ khóa thông minh

"use client";

import React from "react";
import { EffectConfig, EffectType } from "@/types/story";
import {
  EFFECT_METADATA,
  AUDIO_EFFECT_PRESETS,
  getEffectIcon,
} from "@/lib/effects/effectCatalog";
import { Sparkles, Plus, X } from "lucide-react";

export interface BlockEffectsProps {
  blockId: string;
  effects: EffectConfig[];
  suggestions: { keyword: string; effect_type: EffectType; confidence: number }[];
  showSuggestions: boolean;
  onAddEffect: (blockId: string, type?: EffectType) => void;
  onEditEffect: (blockId: string, effect: EffectConfig) => void;
  onDeleteEffect: (blockId: string, effectId: string) => void;
}

export const BlockEffects = React.memo(function BlockEffects({
  blockId,
  effects,
  suggestions,
  showSuggestions,
  onAddEffect,
  onEditEffect,
  onDeleteEffect,
}: BlockEffectsProps) {
  return (
    <>
      {/* 1. Keyword Suggestions Chips (US-2.3) */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 p-2.5 mb-3 rounded-xl bg-accent/5 border border-accent/20">
          <span className="text-xs font-semibold text-accent flex items-center gap-1 mr-1">
            <Sparkles className="w-3.5 h-3.5" />
            Gợi ý hiệu ứng:
          </span>
          {suggestions.slice(0, 3).map((sug) => {
            const meta = EFFECT_METADATA[sug.effect_type];
            return (
              <button
                key={sug.effect_type}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onAddEffect(blockId, sug.effect_type);
                }}
                className="px-2.5 py-1 rounded-full text-xs font-medium bg-accent/15 text-accent hover:bg-accent/25 border border-accent/30 flex items-center gap-1.5 transition-colors cursor-pointer min-h-[44px]"
                title={`Khớp từ khóa: "${sug.keyword}"`}
                aria-label={`Thêm hiệu ứng ${meta?.label || sug.effect_type}`}
              >
                <Plus className="w-3 h-3" />
                {meta?.label?.split("(")[0].trim() || sug.effect_type}
              </button>
            );
          })}
        </div>
      )}

      {/* 2. Attached Effects List (US-2.2) */}
      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/40">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mr-1">
          Hiệu ứng ({effects.length}):
        </span>

        {effects.map((eff) => {
          const Icon = getEffectIcon(eff.type, eff.category);
          const meta = EFFECT_METADATA[eff.type];
          const effectLabel =
            eff.category === "audio"
              ? AUDIO_EFFECT_PRESETS.find((preset) => preset.src === eff.audio_src)?.label ||
              "Âm thanh"
              : meta?.label?.split("(")[0].trim() || eff.type;

          return (
            <div
              key={eff.id}
              className="flex min-h-8 items-stretch overflow-hidden rounded-lg border border-primary/30 bg-primary/10 text-xs font-medium text-foreground transition-colors focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-1 focus-within:ring-offset-card hover:bg-primary/15"
            >
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onEditEffect(blockId, eff);
                }}
                className="flex min-w-0 items-center gap-1.5 px-2.5 py-1.5 text-left focus-visible:outline-none"
                aria-label={`Chỉnh sửa hiệu ứng ${effectLabel}`}
              >
                <Icon
                  className="h-3.5 w-3.5 shrink-0 text-primary"
                  aria-hidden="true"
                />
                <span className="max-w-32 truncate">{effectLabel}</span>
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteEffect(blockId, eff.id);
                }}
                className="flex min-h-8 min-w-8 items-center justify-center border-l border-primary/20 px-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none"
                title="Xóa hiệu ứng"
                aria-label={`Xóa hiệu ứng ${effectLabel}`}
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
          );
        })}

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onAddEffect(blockId);
          }}
          className="px-3 py-1.5 rounded-lg border border-dashed border-border hover:border-primary text-xs font-medium text-muted-foreground hover:text-primary transition-colors flex items-center gap-1.5 cursor-pointer min-h-[44px]"
        >
          <Plus className="w-3.5 h-3.5" />
          Gắn Hiệu Ứng
        </button>
      </div>
    </>
  );
});
