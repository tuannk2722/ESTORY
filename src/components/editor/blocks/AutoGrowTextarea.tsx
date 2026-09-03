// src/components/editor/blocks/AutoGrowTextarea.tsx
// Textarea tự động co giãn theo chiều cao nội dung với phông chữ theo ngữ cảnh

"use client";

import React, { useRef, useLayoutEffect } from "react";
import { StoryBlockType } from "@/types/story";

export interface AutoGrowTextareaProps {
  value: string;
  blockType: StoryBlockType;
  onChange: (text: string) => void;
  onFocus: () => void;
  onBlur: () => void;
  autoFocus?: boolean;
}

export const AutoGrowTextarea = React.memo(function AutoGrowTextarea({
  value,
  blockType,
  onChange,
  onFocus,
  onBlur,
  autoFocus,
}: AutoGrowTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${Math.max(60, el.scrollHeight)}px`;
    }
  }, [value]);

  const placeholder =
    blockType === "heading"
      ? "Nhập tiêu đề phân đoạn..."
      : blockType === "dialogue"
        ? '"Nhập lời thoại của nhân vật..."'
        : "Nhập nội dung đoạn văn...";

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        value={value}
        autoFocus={autoFocus}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onFocus={onFocus}
        onBlur={onBlur}
        rows={1}
        className={`w-full p-3 bg-secondary/20 border border-border rounded-xl text-foreground focus-visible:outline-ring resize-none overflow-hidden min-h-[60px] transition-[height] duration-75 ${blockType === "heading"
          ? "font-display text-lg font-bold"
          : blockType === "dialogue"
            ? "font-story italic text-base text-accent"
            : "font-story text-base"
          }`}
      />
    </div>
  );
});
