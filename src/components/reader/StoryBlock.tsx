// components/reader/StoryBlock.tsx
"use client";

import React from "react";
import { StoryBlock as IStoryBlock } from "@/types/story";

export interface StoryBlockProps {
  block: IStoryBlock;
}

/**
 * Render 1 block và trigger effect khi block vào viewport
 */
export default function StoryBlock({ block }: StoryBlockProps) {
  return (
    <div id={block.id} data-block-id={block.id} className="story-block my-4">
      {block.type === "heading" && <h2 className="text-xl font-semibold">{block.text}</h2>}
      {block.type === "paragraph" && <p className="leading-relaxed">{block.text}</p>}
      {block.type === "dialogue" && <blockquote className="italic border-l-2 pl-4">{block.text}</blockquote>}
    </div>
  );
}
