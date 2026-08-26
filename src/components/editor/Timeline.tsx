// components/editor/Timeline.tsx
// Phase 2: Author Editor - Dòng thời gian khối văn bản và điều hướng nhanh (US-2.4)
"use client";

import React from "react";
import { StoryBlock } from "@/types/story";
import { Scene } from "@/types/scene";
import { getEffectIcon, EFFECT_METADATA } from "./effect-meta";
import { ListOrdered, Zap, Layers } from "lucide-react";

export interface TimelineProps {
  blocks: StoryBlock[];
  activeBlockId?: string | null;
  onSelectBlock: (blockId: string) => void;
  scenes?: Scene[];
  isSelectingRange?: boolean;
  onBlockClickInRangeSelection?: (blockId: string) => void;
  rangeStartId?: string | null;
  rangeEndId?: string | null;
}

export default function Timeline({
  blocks = [],
  activeBlockId,
  onSelectBlock,
  scenes = [],
  isSelectingRange = false,
  onBlockClickInRangeSelection,
  rangeStartId = null,
  rangeEndId = null,
}: TimelineProps) {
  const handleScrollToBlock = (blockId: string) => {
    onSelectBlock(blockId);
    if (typeof window !== "undefined") {
      const element = document.getElementById(blockId);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  };

  const totalEffects = blocks.reduce((sum, b) => sum + (b.effects?.length || 0), 0);

  // Helper check if a block is inside any existing Scene
  const getSceneForBlock = (blockId: string): { scene: Scene; index: number } | undefined => {
    const blockIndex = blocks.findIndex((b) => b.id === blockId);
    if (blockIndex === -1) return undefined;

    const sIdx = scenes.findIndex((scene) => {
      const startIdx = blocks.findIndex((b) => b.id === scene.start_block_id);
      const endIdx = blocks.findIndex((b) => b.id === scene.end_block_id);
      if (startIdx === -1 || endIdx === -1) return false;
      const minIdx = Math.min(startIdx, endIdx);
      const maxIdx = Math.max(startIdx, endIdx);
      return blockIndex >= minIdx && blockIndex <= maxIdx;
    });

    if (sIdx === -1) return undefined;
    return { scene: scenes[sIdx], index: sIdx };
  };

  // Check if a block is in current pending range
  const isBlockInPendingRange = (blockId: string): boolean => {
    if (!rangeStartId) return false;
    const sIdx = blocks.findIndex((b) => b.id === rangeStartId);
    const bIdx = blocks.findIndex((b) => b.id === blockId);
    if (bIdx === -1) return false;

    if (!rangeEndId) return bIdx === sIdx;
    const eIdx = blocks.findIndex((b) => b.id === rangeEndId);
    return bIdx >= Math.min(sIdx, eIdx) && bIdx <= Math.max(sIdx, eIdx);
  };

  return (
    <aside className="effect-timeline-sidebar w-full rounded-3xl border border-border bg-card/85 p-4 backdrop-blur-xl shadow-xl max-h-[calc(100vh-6rem)] flex flex-col font-editor">
      {/* 1. Header */}
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-border">
        <div className="flex items-center gap-2 text-foreground font-semibold text-sm">
          <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
            <ListOrdered className="w-4 h-4" />
          </div>
          <span>Timeline Chương</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[11px] font-mono font-medium flex items-center gap-1"
            title={`${totalEffects} hiệu ứng`}
          >
            <Zap className="w-3 h-3" />
            {totalEffects}
          </span>
          <span
            className="px-2 py-0.5 rounded-full bg-accent/15 text-accent text-[11px] font-mono font-medium flex items-center gap-1"
            title={`${blocks.length} đoạn văn`}
          >
            {blocks.length} b
          </span>
        </div>
      </div>

      {/* 2. Range Selection Hint Banner (when active) */}
      {isSelectingRange && (
        <div className="mb-3 p-2.5 rounded-xl bg-primary/10 border border-primary/30 text-xs text-primary font-medium flex items-center justify-between animate-fade-in">
          <span>Nhấp chọn block để gán dải Scene</span>
          <span className="w-2 h-2 rounded-full bg-primary animate-ping" />
        </div>
      )}

      {/* 3. Blocks List with Scene Ribbon Indicator */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
        {blocks.length === 0 ? (
          <div className="text-center py-10 text-xs text-muted-foreground">
            Chưa có đoạn văn nào trong chương
          </div>
        ) : (
          blocks.map((block, index) => {
            const isActive = activeBlockId === block.id;
            const sceneInfo = getSceneForBlock(block.id);
            const inPendingRange = isBlockInPendingRange(block.id);

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
                key={block.id}
                type="button"
                onClick={() => {
                  if (isSelectingRange && onBlockClickInRangeSelection) {
                    onBlockClickInRangeSelection(block.id);
                  } else {
                    handleScrollToBlock(block.id);
                  }
                }}
                className={`w-full p-2.5 rounded-xl border text-left transition-all duration-200 cursor-pointer flex flex-col gap-1.5 min-h-[44px] relative overflow-hidden ${
                  inPendingRange
                    ? "bg-primary/20 border-primary ring-2 ring-primary/40 text-foreground shadow-md"
                    : isSelectingRange
                    ? "bg-secondary/30 border-dashed border-border hover:border-primary hover:bg-primary/10"
                    : isActive
                    ? "bg-editor-selected border-editor-selected-border text-editor-selected-foreground shadow-sm"
                    : "bg-secondary/30 border-border/50 hover:bg-editor-selected/70 hover:border-editor-selected-border hover:text-foreground hover:-translate-y-0.5 hover:shadow-xs"
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
          })
        )}
      </div>
    </aside>
  );
}


