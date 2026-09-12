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
import InsertGapButton from "@/components/ui/InsertGapButton";

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

function DropIndicator({ active }: { active: boolean }) {
  return (
    <div aria-hidden="true" className="relative h-0">
      <span
        className={`pointer-events-none absolute inset-x-2 top-0 z-10 h-1 -translate-y-1/2 rounded-full bg-primary shadow-[0_0_10px_rgba(0,0,0,0.15)] shadow-primary/50 transition-[opacity,transform] duration-150 ease-out motion-reduce:scale-x-100 motion-reduce:transition-none ${active
          ? "scale-x-100 opacity-100"
          : "scale-x-95 opacity-0"
          }`}
      />
    </div>
  );
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
    handleDragOverAt,
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
            <DropIndicator active={showIndicatorBefore} />

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
            <DropIndicator active={showIndicatorAfter} />

            {/* Hover Divider Gap Between Blocks (Item 5) */}
            {index < blocks.length - 1 && (
              <div
                data-reorder-gap
                className="flow-root"
                onDragOver={(event) => handleDragOverAt(event, index, "after")}
              >
                {draggedIndex === null ? (
                  <InsertGapButton
                    label="Thêm đoạn"
                    ariaLabel={`Chèn block sau block ${index + 1}`}
                    onClick={() => onInsertBlock(index)}
                  />
                ) : <div aria-hidden="true" className="my-1 min-h-11" />}
              </div>
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
