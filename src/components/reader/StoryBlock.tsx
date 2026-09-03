"use client";

import type { StoryBlock as IStoryBlock } from "@/types/story";
import EffectLayer from "../effects/EffectLayer";

export interface StoryBlockProps {
  block: IStoryBlock;
  isFirstParagraph?: boolean;
  storyFontClass?: string;
  isActive: boolean;
  reducedMotion?: boolean;
}

/**
 * Render một block; container Reader chịu trách nhiệm chọn active block.
 */
export default function StoryBlock({
  block,
  isFirstParagraph = false,
  storyFontClass = "story-font-cormorant",
  isActive,
  reducedMotion,
}: StoryBlockProps) {
  return (
    <div
      id={block.id}
      data-reader-block-id={block.id}
      data-has-effect={block.effects?.map((e) => e.id).join(" ")}
      className={`story-block relative z-20 my-10 md:my-14${isActive ? " active" : ""}`}
    >
      <EffectLayer
        effects={block.effects}
        isActive={isActive}
        reducedMotion={reducedMotion}
      />

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
