// src/components/editor/blocks/BlockEditor.tsx
// Phase 2: Author Content Editor - Danh sách các StoryBlock tuần tự (US-2.1 -> US-2.6, docs/08-effects-and-scenes.md)

"use client";

import React, { useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { StoryBlock, StoryBlockType, EffectConfig, EffectType } from "@/types/story";
import { Plus } from "lucide-react";
import { BlockCard } from "./BlockCard";
import { useBlockReorder } from "./useBlockReorder";
import { toast } from "sonner";

const EffectPicker = dynamic(() => import("../effects/EffectPicker"), {
  ssr: false,
});

export interface BlockEditorProps {
  blocks: StoryBlock[];
  activeBlockId: string | null;
  onSelectBlock: (id: string | null) => void;
  onUpdateText: (id: string, text: string) => void;
  onChangeType: (id: string, type: StoryBlockType) => void;
  onInsertBlock: (afterIndex: number) => void;
  onDeleteBlock: (id: string) => void;
  onMoveBlock: (fromIndex: number, toIndex: number) => void;
  onUpsertEffect: (blockId: string, effect: EffectConfig) => void;
  onDeleteEffect: (blockId: string, effectId: string) => void;
}

export function BlockEditor({
  blocks,
  activeBlockId,
  onSelectBlock,
  onUpdateText,
  onChangeType,
  onInsertBlock,
  onDeleteBlock,
  onMoveBlock,
  onUpsertEffect,
  onDeleteEffect,
}: BlockEditorProps) {
  // EffectPicker Modal state
  const [pickerOpen, setPickerOpen] = useState<boolean>(false);
  const [targetBlockId, setTargetBlockId] = useState<string | null>(null);
  const [editingEffect, setEditingEffect] = useState<EffectConfig | null>(null);
  const [suggestedType, setSuggestedType] = useState<EffectType | null>(null);

  // Drag and drop reordering hook
  const {
    draggedIndex,
    dropTarget,
    setDragHandleActive,
    handleDragStart,
    handleDragOver,
    handleDrop,
    handleDragEnd,
    moveUp,
    moveDown,
  } = useBlockReorder({
    totalBlocks: blocks.length,
    onMoveBlock,
  });

  const handleOpenAddEffect = useCallback(
    (blockId: string, type?: EffectType) => {
      setTargetBlockId(blockId);
      setEditingEffect(null);
      setSuggestedType(type || null);
      setPickerOpen(true);
    },
    []
  );

  const handleOpenEditEffect = useCallback(
    (blockId: string, effect: EffectConfig) => {
      setTargetBlockId(blockId);
      setEditingEffect(effect);
      setSuggestedType(null);
      setPickerOpen(true);
    },
    []
  );

  const handleSaveEffect = useCallback(
    (effect: EffectConfig) => {
      if (targetBlockId) {
        onUpsertEffect(targetBlockId, effect);
      }
    },
    [targetBlockId, onUpsertEffect]
  );

  const handleDeleteBlockWithCheck = useCallback(
    (id: string) => {
      if (blocks.length <= 1) {
        toast.error("Chương truyện cần có tối thiểu 1 block.");
        return;
      }
      onDeleteBlock(id);
    },
    [blocks.length, onDeleteBlock]
  );

  return (
    <div
      className="block-editor-container space-y-3 font-editor max-w-3xl mx-auto w-full"
      onDrop={handleDrop}
    >
      {blocks.map((block, index) => {
        const isActive = activeBlockId === block.id;
        const isDragging = draggedIndex === index;

        const showIndicatorBefore =
          dropTarget?.index === index && dropTarget.position === "before";
        const showIndicatorAfter =
          dropTarget?.index === index && dropTarget.position === "after";

        return (
          <React.Fragment key={block.id}>
            {/* Đường chỉ báo vị trí thả - phía trên block */}
            <div
              aria-hidden
              className={`mx-2 rounded-full bg-primary shadow-[0_0_10px_rgba(0,0,0,0.15)] shadow-primary/50 transition-all duration-150 ease-out ${showIndicatorBefore
                ? "h-1 my-1 opacity-100 scale-x-100"
                : "h-0 my-0 opacity-0 scale-x-95"
                }`}
            />

            {/* Block Card */}
            <BlockCard
              block={block}
              index={index}
              totalBlocks={blocks.length}
              isActive={isActive}
              isDragging={isDragging}
              onSelect={onSelectBlock}
              onUpdateText={onUpdateText}
              onChangeType={onChangeType}
              onDeleteBlock={handleDeleteBlockWithCheck}
              onOpenAddEffect={handleOpenAddEffect}
              onOpenEditEffect={handleOpenEditEffect}
              onDeleteEffect={onDeleteEffect}
              onMouseDownDrag={() => setDragHandleActive(true)}
              onTouchStartDrag={() => setDragHandleActive(true)}
              onMoveUp={() => moveUp(index)}
              onMoveDown={() => moveDown(index)}
              onDragStart={(e) => handleDragStart(e, index)}
              onDragEnd={handleDragEnd}
              onDragOver={(e) => handleDragOver(e, index)}
            />

            {/* Đường chỉ báo vị trí thả - phía dưới block */}
            <div
              aria-hidden
              className={`mx-2 rounded-full bg-primary shadow-[0_0_10px_rgba(0,0,0,0.15)] shadow-primary/50 transition-all duration-150 ease-out ${showIndicatorAfter
                ? "h-1 my-1 opacity-100 scale-x-100"
                : "h-0 my-0 opacity-0 scale-x-95"
                }`}
            />

            {/* Hover Divider Gap Between Blocks (Item 5) */}
            {index < blocks.length - 1 && !showIndicatorAfter && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onInsertBlock(index);
                }}
                className="group relative my-1 flex min-h-11 w-full cursor-pointer items-center justify-center rounded-lg transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none"
                title="Chèn đoạn mới vào giữa"
                aria-label={`Chèn block sau block ${index + 1}`}
              >
                <div className="w-full h-px bg-transparent group-hover:bg-primary/40 transition-colors" />
                <div className="opacity-0 group-hover:opacity-100 scale-75 group-hover:scale-100 transition-all duration-200 absolute px-3 py-1 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-md flex items-center gap-1.5 text-xs font-editor font-medium z-10 min-h-[28px]">
                  <Plus className="w-3.5 h-3.5" />
                </div>
              </button>
            )}
          </React.Fragment>
        );
      })}

      {/* Button Thêm Block Cuối Cùng */}
      <div className="pt-6 pb-28 flex justify-center">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onInsertBlock(blocks.length - 1);
          }}
          className="px-6 py-3 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 font-editor font-semibold text-sm flex items-center gap-2 transition-all shadow-sm cursor-pointer min-h-[44px]"
        >
          <Plus className="w-5 h-5" />
          Thêm Đoạn Văn Mới
        </button>
      </div>

      {/* Effect Picker Modal */}
      <EffectPicker
        key={`${targetBlockId ?? "none"}-${editingEffect?.id ?? suggestedType ?? "new"}-${pickerOpen}`}
        isOpen={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSaveEffect={handleSaveEffect}
        initialEffect={editingEffect}
        presetType={suggestedType}
      />
    </div>
  );
}

export default BlockEditor;
