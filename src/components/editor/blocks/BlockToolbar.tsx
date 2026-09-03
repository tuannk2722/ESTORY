// src/components/editor/blocks/BlockToolbar.tsx
// Toolbar của Block: Grip drag handle, Index, loại block, sắp xếp và Smart Delete Popconfirm

"use client";

import React from "react";
import { StoryBlockType } from "@/types/story";
import { ArrowDown, ArrowUp, GripVertical, Trash2 } from "lucide-react";
import Popconfirm from "@/components/ui/Popconfirm";

export interface BlockToolbarProps {
  blockIndex: number;
  blockType: StoryBlockType;
  isEmpty: boolean;
  totalBlocks: number;
  onMouseDownDrag: () => void;
  onTouchStartDrag: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onChangeType: (type: StoryBlockType) => void;
  onDelete: () => void;
}

export const BlockToolbar = React.memo(function BlockToolbar({
  blockIndex,
  blockType,
  isEmpty,
  totalBlocks,
  onMouseDownDrag,
  onTouchStartDrag,
  onMoveUp,
  onMoveDown,
  onChangeType,
  onDelete,
}: BlockToolbarProps) {
  return (
    <div className="flex items-center justify-between gap-1 border-b border-border/40 pb-2 sm:gap-2">
      <div className="flex min-w-0 items-center gap-1 sm:gap-2">
        {/* Drag-and-drop chỉ dùng trên desktop; mobile dùng hai nút di chuyển. */}
        <button
          type="button"
          onMouseDown={onMouseDownDrag}
          onTouchStart={onTouchStartDrag}
          className="hidden min-h-11 min-w-11 touch-none cursor-grab items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing motion-reduce:transition-none lg:flex"
          title="Kéo thả để sắp xếp vị trí block"
          aria-label={`Kéo thả block ${blockIndex + 1}`}
        >
          <GripVertical className="h-4 w-4 pointer-events-none" aria-hidden="true" />
        </button>

        <span className="shrink-0 font-mono text-xs font-bold text-muted-foreground sm:mr-1">
          #{blockIndex + 1}
        </span>

        <div
          className="flex min-w-0 items-center gap-1 rounded-lg border border-border/60 bg-secondary/50 p-0.5"
          aria-label="Loại đoạn văn"
        >
          <button
            type="button"
            onClick={() => onChangeType("paragraph")}
            aria-label="Đoạn văn"
            aria-pressed={blockType === "paragraph"}
            className={`min-h-11 min-w-11 cursor-pointer rounded-md px-2.5 py-1 text-xs font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none ${
              blockType === "paragraph"
                ? "bg-editor-action text-editor-action-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            }`}
          >
            <span className="sm:hidden" aria-hidden="true">
              P
            </span>
            <span className="hidden sm:inline">Đoạn Văn</span>
          </button>
          <button
            type="button"
            onClick={() => onChangeType("dialogue")}
            aria-label="Đối thoại"
            aria-pressed={blockType === "dialogue"}
            className={`min-h-11 min-w-11 cursor-pointer rounded-md px-2.5 py-1 text-xs font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none ${
              blockType === "dialogue"
                ? "bg-editor-action text-editor-action-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            }`}
          >
            <span className="sm:hidden" aria-hidden="true">
              D
            </span>
            <span className="hidden sm:inline">Đối Thoại</span>
          </button>
          <button
            type="button"
            onClick={() => onChangeType("heading")}
            aria-label="Tiêu đề"
            aria-pressed={blockType === "heading"}
            className={`min-h-11 min-w-11 cursor-pointer rounded-md px-2.5 py-1 text-xs font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none ${
              blockType === "heading"
                ? "bg-editor-action text-editor-action-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            }`}
          >
            <span className="sm:hidden" aria-hidden="true">
              H
            </span>
            <span className="hidden sm:inline">Tiêu Đề</span>
          </button>
        </div>
      </div>

      <div className="flex shrink-0 items-center sm:gap-2">
        <div className="flex items-center sm:gap-1" aria-label="Sắp xếp block">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={blockIndex === 0}
            className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-35 motion-reduce:transition-none"
            aria-label={`Di chuyển block ${blockIndex + 1} lên trên`}
          >
            <ArrowUp className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={blockIndex === totalBlocks - 1}
            className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-35 motion-reduce:transition-none"
            aria-label={`Di chuyển block ${blockIndex + 1} xuống dưới`}
          >
            <ArrowDown className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* Block rỗng được xóa ngay; block có nội dung cần xác nhận. */}
        {isEmpty ? (
          <button
            type="button"
            onClick={onDelete}
            className="flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none"
            title="Xóa đoạn văn rỗng"
            aria-label="Xóa đoạn văn"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </button>
        ) : (
          <Popconfirm
            title="Xóa đoạn văn? Đoạn văn này sẽ bị xóa khỏi chương"
            onConfirm={onDelete}
          >
            <button
              type="button"
              className="flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none"
              title="Xóa đoạn văn"
              aria-label="Xóa đoạn văn"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </button>
          </Popconfirm>
        )}
      </div>
    </div>
  );
});
