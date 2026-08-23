// components/editor/Timeline.tsx
// Phase 2: Author Editor - Dòng thời gian hiệu ứng và điều hướng nhanh (US-2.4)
"use client";

import React from "react";
import { StoryBlock } from "@/types/story";
import { getEffectIcon, EFFECT_METADATA } from "./effect-meta";
import { ListOrdered, Zap } from "lucide-react";

export interface TimelineProps {
  blocks: StoryBlock[];
  activeBlockId?: string | null;
  onSelectBlock: (blockId: string) => void;
}

export default function Timeline({
  blocks,
  activeBlockId,
  onSelectBlock,
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

  const totalEffects = blocks.reduce((sum, b) => sum + b.effects.length, 0);

  return (
    <aside className="effect-timeline-sidebar sticky top-24 rounded-2xl border border-border bg-card/80 p-4 backdrop-blur-md shadow-lg max-h-[calc(100vh-7rem)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-border">
        <div className="flex items-center gap-2 text-foreground font-semibold text-md">
          <ListOrdered className="w-4 h-4 text-primary" />
          <span>Timeline Toàn Chương</span>
        </div>
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-mono font-medium">
          <Zap className="w-3 h-3" />
          <span>{totalEffects} effects</span>
        </div>
      </div>

      {/* Blocks List */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
        {blocks.length === 0 ? (
          <div className="text-center py-8 text-xs text-muted-foreground">
            Chưa có đoạn văn nào trong chương
          </div>
        ) : (
          blocks.map((block, index) => {
            const isActive = activeBlockId === block.id;
            const previewText =
              block.text.trim().length > 0
                ? block.text.trim().slice(0, 35) + (block.text.length > 35 ? "..." : "")
                : "(Đoạn văn trống)";
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
                onClick={() => handleScrollToBlock(block.id)}
                className={`w-full p-2.5 rounded-xl border text-left transition-all duration-200 cursor-pointer flex flex-col gap-1.5 min-h-[44px] ${isActive
                  ? "bg-editor-selected border-editor-selected-border text-editor-selected-foreground shadow-sm"
                  : "bg-secondary/30 border-border/50 hover:bg-editor-selected/70 hover:border-editor-selected-border hover:text-foreground hover:-translate-y-0.5 hover:shadow-md"
                  }`}
              >
                {/* Top Row: Index + Type */}
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 font-medium">
                    <span className="font-mono text-accent">#{index + 1}</span>
                    <span className="flex items-center gap-1 text-[11px] uppercase tracking-wider">
                      {blockTypeLabel}
                    </span>
                  </div>
                  {block.effects.length > 0 && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-primary/20 text-primary font-mono font-bold">
                      {block.effects.length}
                    </span>
                  )}
                </div>

                {/* Middle Row: Text snippet */}
                <div
                  className={`text-sm line-clamp-1 ${block.type === "heading"
                    ? "font-display font-semibold text-foreground"
                    : block.type === "dialogue"
                      ? "font-story italic"
                      : "font-story"
                    }`}
                >
                  {previewText}
                </div>

                {/* Bottom Row: Effect Icons */}
                {block.effects.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1 border-t border-border/30">
                    {block.effects.map((eff) => {
                      const Icon = getEffectIcon(eff.type, eff.category);
                      const meta = EFFECT_METADATA[eff.type];
                      return (
                        <span
                          key={eff.id}
                          className="p-1 rounded bg-secondary/80 text-primary flex items-center gap-1 text-[10px]"
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
