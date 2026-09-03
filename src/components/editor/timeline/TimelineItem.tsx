// src/components/editor/timeline/TimelineItem.tsx
// Memoized individual timeline entry for a StoryBlock with exact UI/UX from CHI_TIET_TRANG_EDITOR.md

"use client";

import React from "react";
import { StoryBlock } from "@/types/story";
import { SceneBlockInfo } from "@/lib/scenes/sceneSelectors";
import { EFFECT_METADATA, getEffectIcon } from "@/lib/effects/effectCatalog";
import { Layers } from "lucide-react";

export interface TimelineItemProps {
  block: StoryBlock;
  index: number;
  isActive: boolean;
  sceneInfo?: SceneBlockInfo;
  inPendingRange: boolean;
  isSelectingRange: boolean;
  onSelectBlock: (blockId: string) => void;
  onSelectRangeBlock?: (blockId: string) => void;
}

export const TimelineItem = React.memo(function TimelineItem({
  block,
  index,
  isActive,
  sceneInfo,
  inPendingRange,
  isSelectingRange,
  onSelectBlock,
  onSelectRangeBlock,
}: TimelineItemProps) {
  const previewText =
    block.text.trim().length > 0 ? block.text.trim() : "(Đoạn văn trống)";

  const blockTypeLabel =
    block.type === "heading"
      ? "Tiêu đề"
      : block.type === "dialogue"
        ? "Đối thoại"
        : "Đoạn văn";

  return (
    <button
      type="button"
      onClick={() => {
        if (isSelectingRange && onSelectRangeBlock) {
          onSelectRangeBlock(block.id);
        } else {
          onSelectBlock(block.id);
        }
      }}
      aria-current={isActive ? "true" : undefined}
      className={`w-full p-2.5 rounded-xl border text-left transition-[background-color,border-color,box-shadow,transform] duration-200 motion-reduce:transition-none cursor-pointer flex flex-col gap-1.5 min-h-[44px] relative overflow-hidden focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2 ${
        inPendingRange
          ? "bg-primary/20 border-primary ring-2 ring-primary/40 text-foreground shadow-md"
          : isSelectingRange
            ? "bg-secondary/30 border-dashed border-border hover:border-primary hover:bg-primary/10"
            : isActive
              ? "bg-editor-selected border-editor-selected-border text-editor-selected-foreground shadow-sm"
              : "bg-secondary/30 border-border/50 hover:bg-editor-selected/70 hover:border-editor-selected-border hover:text-foreground motion-safe:hover:-translate-y-0.5 hover:shadow-xs"
      }`}
    >
      {/* Visual Scene ribbon indicator */}
      {sceneInfo && !inPendingRange && (
        <div
          className="absolute left-0 top-0 bottom-0 w-1 bg-accent"
          title={`Thuộc Scene ${sceneInfo.index + 1}`}
        />
      )}

      {/* Top Row: Index + Type + Scene Badge */}
      <div className="flex items-center justify-between text-xs pl-1">
        <div className="flex items-center gap-1.5 font-medium">
          <span className="font-mono text-accent">#{index + 1}</span>
          <span className="flex items-center gap-1 text-[11px] uppercase tracking-wider text-muted-foreground font-ui">
            {blockTypeLabel}
          </span>
        </div>

        <div className="flex items-center gap-1">
          {sceneInfo && (
            <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-accent/20 text-accent font-semibold flex items-center gap-0.5 font-mono">
              <Layers className="w-2.5 h-2.5" /> S{sceneInfo.index + 1}
            </span>
          )}

          {block.effects && block.effects.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-primary/20 text-primary font-mono font-bold">
              {block.effects.length} eff
            </span>
          )}
        </div>
      </div>

      {/* Middle Row: Text snippet */}
      <div
        className={`text-sm line-clamp-1 pl-1 text-foreground/90 ${
          block.type === "heading"
            ? "font-display font-semibold"
            : block.type === "dialogue"
              ? "font-story italic"
              : "font-story"
        }`}
      >
        {previewText}
      </div>

      {/* Bottom Row: Effect Icons */}
      {block.effects && block.effects.length > 0 && (
        <div className="flex flex-wrap gap-1 pt-1 border-t border-border/30 pl-1">
          {block.effects.map((eff) => {
            const Icon = getEffectIcon(eff.type, eff.category);
            const meta = EFFECT_METADATA[eff.type];
            return (
              <span
                key={eff.id}
                className="p-1 rounded-md bg-secondary text-primary flex items-center gap-1 text-[10px]"
                title={`${meta?.label || eff.type} (${Math.round(
                  (eff.intensity ?? 0.7) * 100
                )}%)`}
              >
                <Icon className="w-3 h-3" />
              </span>
            );
          })}
        </div>
      )}
    </button>
  );
});
