"use client";

import React, { useState, useEffect } from "react";
import { Chapter } from "@/types/story";
import StoryBlock from "./StoryBlock";
import ProgressBar from "./ProgressBar";
import ChapterNav from "./ChapterNav";
import { useResumeCommit } from "@/hooks/useResumeCommit";
import { useReaderSettings } from "@/components/ui/ThemeProvider";
import { STORY_FONT_OPTIONS } from "@/types/settings";

export interface ReaderPaneProps {
  storyId: string;
  chapter: Chapter;
  prevChapterId?: string | null;
  nextChapterId?: string | null;
  isLastChapter?: boolean;
}

export default function ReaderPane({
  storyId,
  chapter,
  prevChapterId,
  nextChapterId,
  isLastChapter = false,
}: ReaderPaneProps) {
  const { settings } = useReaderSettings();
  const [activeBlockId, setActiveBlockId] = useState<string | null>(
    chapter.blocks[0]?.id || null
  );

  const lastBlockId = chapter.blocks[chapter.blocks.length - 1]?.id;
  const isLastBlock = activeBlockId === lastBlockId;

  // Chỉ commit resume reading khi reader thực sự đọc đủ threshold (10s time hoặc 20% scroll)
  useResumeCommit({
    storyId,
    chapterId: chapter.id,
    activeBlockId,
    isLastChapter,
    isLastBlock,
  });

  // Tự động cuộn tới vị trí lưu trước đó (nếu có hash hoặc stored progress)
  useEffect(() => {
    if (typeof window !== "undefined" && window.location.hash) {
      const el = document.querySelector(window.location.hash);
      if (el) {
        setTimeout(() => {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 300);
      }
    }
  }, []);

  // Map font-size class theo thiết kế docs/04-ui-ux-design.md
  const fontSizeClass = `font-size-${settings.font_size || "lg"}`;
  const fontFamilyClass = STORY_FONT_OPTIONS.find((font) => font.id === settings.font_family)?.className
    || "story-font-cormorant";

  const firstParagraphId = chapter.blocks.find((block) => block.type === "paragraph")?.id;

  return (
    <div className="reader-pane relative w-full min-h-screen">
      {/* 1. Thanh tiến trình cuộn trang trên đỉnh */}
      <ProgressBar />

      {/* 3. Tiêu đề chương */}
      <header className="mb-12 text-center pt-6">
        <span className="font-ui text-xs font-semibold uppercase tracking-widest text-[var(--color-accent)]">
          {chapter.title.split(":")[0] || `Chương ${chapter.order}`}
        </span>
        <h1 className="font-display text-3xl md:text-5xl font-bold tracking-tight text-[var(--color-foreground)] mt-2">
          {chapter.title.includes(":") ? chapter.title.split(":")[1] : chapter.title}
        </h1>
      </header>

      {/* 4. Khung đọc chính */}
      <main className={`prose-reader ${fontSizeClass}`}>
        {chapter.blocks.map((block) => {
          const isFirstP = block.id === firstParagraphId;
          return (
              <StoryBlock
              key={block.id}
              block={block}
                storyFontClass={fontFamilyClass}
              isFirstParagraph={isFirstP}
              onBlockVisible={setActiveBlockId}
            />
          );
        })}
      </main>

      {/* 5. Điều hướng chương trước / sau */}
      <div className="max-w-2xl mx-auto px-4">
        <ChapterNav
          storyId={storyId}
          prevChapterId={prevChapterId}
          nextChapterId={nextChapterId}
        />
      </div>
    </div>
  );
}
