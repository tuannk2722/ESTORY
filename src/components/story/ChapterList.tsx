"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Chapter } from "@/types/story";
import { ResumeReading } from "@/types/settings";
import { settingsStore } from "@/lib/settingsStore";
import ResumeReadingModal from "@/components/reader/ResumeReadingModal";
import { BookOpen, ChevronRight, Sparkles } from "lucide-react";

export interface ChapterListProps {
  storyId: string;
  chapters: Chapter[];
}

/**
 * Danh sách mục lục chương trên Detail Page.
 * Xử lý logic Resume Reading & Navigation (theo Implementation Plan Section 3 & 4):
 * - Target === Resume Chapter -> Navigate trực tiếp
 * - Target !== Resume Chapter && !dismissed -> Hiển thị Resume Modal
 * - Target !== Resume Chapter && dismissed -> Navigate trực tiếp
 */
export default function ChapterList({ storyId, chapters }: ChapterListProps) {
  const router = useRouter();
  const [resumeReading, setResumeReading] = useState<ResumeReading | null>(null);
  const [isDismissed, setIsDismissed] = useState(false);
  const [targetChapter, setTargetChapter] = useState<Chapter | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    // 1. Lấy resume reading đã lưu (hoặc fallback progress)
    const resume = settingsStore.getResumeReading(storyId);
    if (resume) {
      setResumeReading(resume);
    } else {
      const oldProgress = settingsStore.getProgress(storyId);
      if (oldProgress) {
        setResumeReading({
          chapter_id: oldProgress.chapter_id,
          block_id: oldProgress.block_id,
          progress: 0,
          updated_at: Date.now(),
        });
      }
    }

    // 2. Kiểm tra session state: reader đã chọn chapter khác trong session chưa
    if (typeof sessionStorage !== "undefined") {
      const dismissed = sessionStorage.getItem(`resume_dismissed_${storyId}`);
      if (dismissed === "true") {
        setIsDismissed(true);
      }
    }
  }, [storyId]);

  const handleChapterClick = (e: React.MouseEvent, chapter: Chapter) => {
    e.preventDefault();

    // 1. Nếu không có resume reading hoặc target trùng với resume chapter -> Navigate trực tiếp
    if (!resumeReading || resumeReading.chapter_id === chapter.id) {
      router.push(`/stories/${storyId}/${chapter.id}`);
      return;
    }

    // 2. Nếu target khác resume chapter nhưng đã dismissed trong session -> Navigate trực tiếp
    if (isDismissed) {
      router.push(`/stories/${storyId}/${chapter.id}`);
      return;
    }

    // 3. Target khác resume chapter và chưa dismissed -> Mở Resume Modal
    setTargetChapter(chapter);
    setIsModalOpen(true);
  };

  // Reader chọn "Đọc tiếp [Resume Chapter]"
  const handleResume = () => {
    if (!resumeReading) return;
    setIsModalOpen(false);
    const resumeUrl = resumeReading.block_id
      ? `/stories/${storyId}/${resumeReading.chapter_id}#${resumeReading.block_id}`
      : `/stories/${storyId}/${resumeReading.chapter_id}`;
    router.push(resumeUrl);
  };

  // Reader chọn "Đọc [Target Chapter]"
  const handleDismissAndNavigate = () => {
    if (!targetChapter) return;
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.setItem(`resume_dismissed_${storyId}`, "true");
    }
    setIsDismissed(true);
    setIsModalOpen(false);
    router.push(`/stories/${storyId}/${targetChapter.id}`);
  };

  const targetChapterTitle = targetChapter
    ? `Chương ${targetChapter.order}: ${targetChapter.title.includes(":") ? targetChapter.title.split(":")[1] : targetChapter.title}`
    : `Chương đã chọn`;

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-4">
        <h2 className="font-display text-2xl font-bold text-[var(--color-foreground)] flex items-center gap-2">
          <BookOpen className="w-6 h-6 text-[var(--color-accent)]" />
          <span>Mục Lục Chương</span>
        </h2>
        <span className="font-ui text-sm text-[var(--color-muted-foreground)]">
          {chapters.length} chương
        </span>
      </div>

      <div className="space-y-3">
        {chapters.map((chapter) => {
          const effectCount = chapter.blocks.reduce(
            (acc, b) => acc + (b.effects?.length || 0),
            0
          );
          const isResumeChapter = resumeReading?.chapter_id === chapter.id;

          return (
            <button
              key={chapter.id}
              onClick={(e) => handleChapterClick(e, chapter)}
              className={`w-full text-left glass-card group flex items-center justify-between p-4 md:p-5 rounded-xl border transition-all duration-200 cursor-pointer min-h-[44px] ${isResumeChapter
                ? "border-[var(--color-accent)]/50 bg-[var(--color-accent)]/5 hover:bg-[var(--color-accent)]/10"
                : "border-[var(--color-border)] bg-[var(--color-card)]/70 hover:bg-[var(--color-muted)] hover:border-[var(--color-accent)]"
                } hover:translate-x-1`}
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-ui text-xs font-semibold text-[var(--color-accent)] uppercase tracking-wider">
                    Chương {chapter.order}
                  </span>
                  {isResumeChapter && (
                    <span className="px-2 py-0.5 text-[10px] font-ui font-medium rounded-full bg-[var(--color-accent)]/20 text-[var(--color-accent)] border border-[var(--color-accent)]/30">
                      Đang đọc dở
                    </span>
                  )}
                </div>
                <h3 className="font-story text-lg md:text-xl font-bold text-[var(--color-foreground)] group-hover:text-[var(--color-accent)] transition-colors">
                  {chapter.title}
                </h3>
              </div>

              <div className="flex items-center gap-4 text-xs font-ui text-[var(--color-muted-foreground)]">
                {effectCount > 0 && (
                  <span className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-full bg-[var(--color-secondary)] border border-[var(--color-border)]">
                    <Sparkles className="w-3 h-3 text-[var(--color-accent)]" />
                    <span>{effectCount} hiệu ứng</span>
                  </span>
                )}
                <span className="flex items-center gap-1 text-[var(--color-primary)] font-semibold group-hover:translate-x-1 transition-transform">
                  Đọc <ChevronRight className="w-4 h-4" />
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Resume Modal trigger từ Detail Page */}
      <ResumeReadingModal
        isOpen={isModalOpen}
        targetChapterTitle={targetChapterTitle}
        onResume={handleResume}
        onDismiss={handleDismissAndNavigate}
      />
    </section>
  );
}
