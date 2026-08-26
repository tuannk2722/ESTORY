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
    threshold: 0,
    rootMargin: "-25% 0px -35% 0px",
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
      className={`story-block relative my-10 md:my-14 transition-all duration-700 ${isIntersecting ? "opacity-100 active" : "opacity-75"
        }`}
    >
      {/* Lớp kích hoạt hiệu ứng - chỉ kích hoạt khi không bị modal tạm dừng */}
      <EffectLayer effects={block.effects} isActive={isEffectActive} />

      {/* Render văn bản theo type */}
      {block.type === "heading" && (
        <div className="my-10 text-center">
          <h2 className="font-display text-2xl md:text-3xl font-bold tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-[#F8FAFC] via-[var(--color-primary,#38BDF8)] to-[#F8FAFC] inline-block pb-3 border-b-2 border-[var(--color-accent,#E2B714)]/60">
            {block.text}
          </h2>
        </div>
      )}

      {block.type === "paragraph" && (
        <p
          className={`font-story ${storyFontClass} text-[length:inherit] leading-[inherit] text-[#F8FAFC] transition-all duration-300 ${isFirstParagraph ? "drop-cap" : ""
            }`}
        >
          {block.text}
        </p>
      )}

      {block.type === "dialogue" && (
        <div className="dialogue-box my-8 p-5 md:p-6 rounded-r-2xl border-l-4 border-[var(--color-accent,#E2B714)] shadow-xl transition-all duration-500">
          <p className={`font-story ${storyFontClass} text-[length:inherit] leading-[inherit] text-[#F8FAFC] transition-all duration-300`}>
            {block.text}
          </p>
        </div>
      )}
    </div>
  );
}
