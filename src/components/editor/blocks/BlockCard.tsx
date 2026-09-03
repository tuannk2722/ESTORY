// src/components/editor/blocks/BlockCard.tsx
// Memoized StoryBlock Card with exact UI/UX from CHI_TIET_TRANG_EDITOR.md

"use client";

import React, { useState, useCallback } from "react";
import { StoryBlock, StoryBlockType, EffectConfig, EffectType } from "@/types/story";
import { BlockToolbar } from "./BlockToolbar";
import { AutoGrowTextarea } from "./AutoGrowTextarea";
import { BlockEffects } from "./BlockEffects";
import { detectEffectKeywords } from "@/lib/effectSuggestion";

export interface BlockCardProps {
  block: StoryBlock;
  index: number;
  totalBlocks: number;
  isActive: boolean;
  isDragging: boolean;
  onSelect: (blockId: string) => void;
  onUpdateText: (blockId: string, text: string) => void;
  onChangeType: (blockId: string, type: StoryBlockType) => void;
  onDeleteBlock: (blockId: string) => void;
  onOpenAddEffect: (blockId: string, type?: EffectType) => void;
  onOpenEditEffect: (blockId: string, effect: EffectConfig) => void;
  onDeleteEffect: (blockId: string, effectId: string) => void;
  onMouseDownDrag: () => void;
  onTouchStartDrag: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDragStart: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragEnd: () => void;
  onDragOver: (e: React.DragEvent<HTMLDivElement>) => void;
}

export const BlockCard = React.memo(function BlockCard({
  block,
  index,
  totalBlocks,
  isActive,
  isDragging,
  onSelect,
  onUpdateText,
  onChangeType,
  onDeleteBlock,
  onOpenAddEffect,
  onOpenEditEffect,
  onDeleteEffect,
  onMouseDownDrag,
  onTouchStartDrag,
  onMoveUp,
  onMoveDown,
  onDragStart,
  onDragEnd,
  onDragOver,
}: BlockCardProps) {
  const [isBlurred, setIsBlurred] = useState<boolean>(false);
  const [suggestions, setSuggestions] = useState<
    ReturnType<typeof detectEffectKeywords>
  >([]);

  const isEmpty =
    block.text.trim().length === 0 &&
    (!block.effects || block.effects.length === 0);

  const handleFocus = useCallback(() => {
    setIsBlurred(false);
    onSelect(block.id);
  }, [onSelect, block.id]);

  const handleBlur = useCallback(() => {
    setSuggestions(
      block.text.trim() ? detectEffectKeywords(block.text).slice(0, 3) : []
    );
    setIsBlurred(true);
  }, [block.text]);

  return (
    <div
      id={block.id}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(block.id);
      }}
      className={`block-card relative rounded-2xl border p-4 transition-all duration-200 cursor-pointer flex flex-col gap-3 font-editor ${isDragging
        ? "opacity-30 border-dashed border-primary"
        : isActive
          ? "border-editor-selected-border ring-2 ring-primary/30 shadow-md"
          : "bg-card/90 border-border/80 hover:border-border hover:shadow-xs hover:bg-card"
        }`}
    >
      {/* 1. Header Toolbar */}
      <BlockToolbar
        blockIndex={index}
        blockType={block.type}
        isEmpty={isEmpty}
        totalBlocks={totalBlocks}
        onMouseDownDrag={onMouseDownDrag}
        onTouchStartDrag={onTouchStartDrag}
        onMoveUp={onMoveUp}
        onMoveDown={onMoveDown}
        onChangeType={(type) => onChangeType(block.id, type)}
        onDelete={() => onDeleteBlock(block.id)}
      />

      {/* 2. Textarea */}
      <AutoGrowTextarea
        value={block.text}
        blockType={block.type}
        onChange={(text) => onUpdateText(block.id, text)}
        onFocus={handleFocus}
        onBlur={handleBlur}
      />

      {/* 3. Keyword Suggestions & Attached Effects */}
      <BlockEffects
        blockId={block.id}
        effects={block.effects || []}
        suggestions={suggestions}
        showSuggestions={isBlurred && suggestions.length > 0}
        onAddEffect={onOpenAddEffect}
        onEditEffect={onOpenEditEffect}
        onDeleteEffect={onDeleteEffect}
      />
    </div>
  );
});
