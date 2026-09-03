// src/components/editor/timeline/Timeline.tsx
// Right Sidebar Timeline for Chapter-wide block navigation and range selection

"use client";

import React, { useMemo } from "react";
import { StoryBlock } from "@/types/story";
import { Scene } from "@/types/scene";
import { ListOrdered, Zap } from "lucide-react";
import { TimelineItem } from "./TimelineItem";
import { buildBlockIndexMap } from "@/lib/scenes/sceneRange";
import { buildSceneByBlockId } from "@/lib/scenes/sceneSelectors";
import { scrollToEditorBlock } from "@/lib/editor/scrollToBlock";

export interface TimelineProps {
  blocks?: StoryBlock[];
  activeBlockId?: string | null;
  onSelectBlock: (blockId: string) => void;
  scenes?: Scene[];
  isSelectingRange?: boolean;
  onBlockClickInRangeSelection?: (blockId: string) => void;
  rangeStartId?: string | null;
  rangeEndId?: string | null;
}

export function Timeline({
  blocks = [],
  activeBlockId,
  onSelectBlock,
  scenes = [],
  isSelectingRange = false,
  onBlockClickInRangeSelection,
  rangeStartId = null,
  rangeEndId = null,
}: TimelineProps) {
  const blockIndexMap = useMemo(() => buildBlockIndexMap(blocks), [blocks]);
  const sceneByBlockIdMap = useMemo(
    () => buildSceneByBlockId(blocks, scenes, blockIndexMap),
    [blocks, scenes, blockIndexMap]
  );

  const totalEffects = useMemo(() => {
    return blocks.reduce((sum, b) => sum + (b.effects?.length || 0), 0);
  }, [blocks]);

  // Pending range boundary indices in O(1)
  const pendingRangeIndices = useMemo(() => {
    if (!rangeStartId) return null;
    const sIdx = blockIndexMap.get(rangeStartId);
    if (sIdx === undefined) return null;

    if (!rangeEndId) {
      return { min: sIdx, max: sIdx };
    }

    const eIdx = blockIndexMap.get(rangeEndId);
    if (eIdx === undefined) return { min: sIdx, max: sIdx };

    return {
      min: Math.min(sIdx, eIdx),
      max: Math.max(sIdx, eIdx),
    };
  }, [rangeStartId, rangeEndId, blockIndexMap]);

  const handleScrollToBlock = React.useCallback((blockId: string) => {
    onSelectBlock(blockId);
    scrollToEditorBlock(blockId);
  }, [onSelectBlock]);

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
          <span>Nhấp chọn block để gán dải Bối Cảnh</span>
          <span className="w-2 h-2 rounded-full bg-primary motion-reduce:animate-none animate-ping" aria-hidden="true" />
        </div>
      )}

      {/* 3. Blocks List with O(1) Lookup */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
        {blocks.length === 0 ? (
          <div className="text-center py-10 text-xs text-muted-foreground">
            Chưa có đoạn văn nào trong chương
          </div>
        ) : (
          blocks.map((block, index) => {
            const isActive = activeBlockId === block.id;
            const sceneInfo = sceneByBlockIdMap.get(block.id);

            const inPendingRange =
              pendingRangeIndices !== null &&
              index >= pendingRangeIndices.min &&
              index <= pendingRangeIndices.max;

            return (
              <TimelineItem
                key={block.id}
                block={block}
                index={index}
                isActive={isActive}
                sceneInfo={sceneInfo}
                inPendingRange={inPendingRange}
                isSelectingRange={isSelectingRange}
                onSelectBlock={handleScrollToBlock}
                onSelectRangeBlock={onBlockClickInRangeSelection}
              />
            );
          })
        )}
      </div>
    </aside>
  );
}

export default Timeline;
