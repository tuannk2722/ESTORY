"use client";

import React, { useState, useEffect } from "react";
import { Chapter } from "@/types/story";
import StoryBlock from "./StoryBlock";
import ProgressBar from "./ProgressBar";
import ChapterNav from "./ChapterNav";
import SafetyModal from "./SafetyModal";
import { useReadingProgress } from "@/hooks/useReadingProgress";
import { useReaderSettings } from "@/components/ui/ThemeProvider";

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
  const [isSafetyModalOpen, setIsSafetyModalOpen] = useState(false);
  const [activeBlockId, setActiveBlockId] = useState<string | null>(
    chapter.blocks[0]?.id || null
  );

  const lastBlockId = chapter.blocks[chapter.blocks.length - 1]?.id;
  const isLastBlock = activeBlockId === lastBlockId;

  // Tự động lưu tiến trình đọc khi cuộn
  useReadingProgress({
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

  // Xác định vị trí block paragraph đầu tiên để đặt Drop-Cap
  let foundFirstParagraph = false;

  return (
    <div className="reader-pane relative w-full min-h-screen">
      {/* 1. Thanh tiến trình cuộn trang trên đỉnh */}
      <ProgressBar />

      {/* 2. Modal cảnh báo an toàn nếu có hiệu ứng mạnh */}
      <SafetyModal chapter={chapter} onOpenChange={setIsSafetyModalOpen} />

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
          let isFirstP = false;
          if (block.type === "paragraph" && !foundFirstParagraph) {
            isFirstP = true;
            foundFirstParagraph = true;
          }

          return (
            <StoryBlock
              key={block.id}
              block={block}
              isFirstParagraph={isFirstP}
              onBlockVisible={setActiveBlockId}
              isPaused={isSafetyModalOpen}
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
