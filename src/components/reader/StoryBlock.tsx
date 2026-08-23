"use client";

import React, { useRef, useEffect } from "react";
import { StoryBlock as IStoryBlock } from "@/types/story";
import { useIntersectionObserver } from "@/hooks/useIntersectionObserver";
import EffectLayer from "../effects/EffectLayer";

export interface StoryBlockProps {
  block: IStoryBlock;
  isFirstParagraph?: boolean;
  storyFontClass?: string;
  onBlockVisible?: (blockId: string) => void;
  isPaused?: boolean;
}

/**
 * Render 1 block và kích hoạt hiệu ứng khi khối văn bản cuộn vào viewport
 */
export default function StoryBlock({
  block,
  isFirstParagraph = false,
  storyFontClass = "story-font-cormorant",
  onBlockVisible,
  isPaused = false,
}: StoryBlockProps) {
  const blockRef = useRef<HTMLDivElement>(null);
  const entry = useIntersectionObserver(blockRef, {
    threshold: 0.35,
    rootMargin: "-20% 0px -25% 0px",
  });

  const isIntersecting = !!entry?.isIntersecting;
  const isEffectActive = isIntersecting && !isPaused;

  useEffect(() => {
    if (isEffectActive && onBlockVisible) {
      onBlockVisible(block.id);
    }
  }, [isEffectActive, block.id, onBlockVisible]);

  return (
    <div
      ref={blockRef}
      id={block.id}
      data-block-id={block.id}
      data-has-effect={block.effects?.map((e) => e.id).join(" ")}
      className={`story-block relative my-10 md:my-14 transition-all duration-700 ${isIntersecting ? "opacity-100 active scale-[1.005]" : "opacity-75"
        }`}
    >
      {/* Lớp kích hoạt hiệu ứng - chỉ kích hoạt khi không bị modal tạm dừng */}
      <EffectLayer effects={block.effects} isActive={isEffectActive} />

      {/* Render văn bản theo type */}
      {block.type === "heading" && (
        <h2 className="font-display text-2xl md:text-3xl font-bold tracking-wide my-10 text-center text-[var(--color-foreground)] border-b border-[var(--color-border)]/50 pb-4">
          {block.text}
        </h2>
      )}

      {block.type === "paragraph" && (
        <p
          className={`font-story ${storyFontClass} text-[length:inherit] leading-[inherit] text-[var(--color-foreground)] transition-all duration-300 ${isFirstParagraph ? "drop-cap" : ""
            }`}
        >
          {block.text}
        </p>
      )}

      {block.type === "dialogue" && (
        <div className="dialogue-box my-8 p-5 md:p-6 bg-[var(--color-card)]/90 border-l-4 border-[var(--color-accent)] shadow-md">
          <p className={`font-story ${storyFontClass} text-[length:inherit] leading-[inherit] text-[var(--color-foreground)] transition-all duration-300`}>
            {block.text}
          </p>
        </div>
      )}
    </div>
  );
}
