"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, ChevronRight, Sparkles } from "lucide-react";
import ResumeReadingModal from "@/components/reader/ResumeReadingModal";
import { useSettingsSync } from "@/hooks/useSettingsSync";
import { settingsStore } from "@/lib/settingsStore";
import { resolvePublicReadingTarget } from "@/lib/reader/publicReadingTarget";
import type { Chapter } from "@/types/story";

export interface ChapterListProps {
  storyId: string;
  chapters: Chapter[];
}

export default function ChapterList({ storyId, chapters }: ChapterListProps) {
  const router = useRouter();
  const sync = useSettingsSync();
  const isHydrated = sync.ready;
  const [dismissedScope, setDismissedScope] = useState<number | null>(null);
  const [targetChapter, setTargetChapter] = useState<Chapter | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalScope, setModalScope] = useState<number | null>(null);

  const resumeReading = (() => {
    if (!isHydrated) return null;
    const resume = settingsStore.getResumeReading(storyId);
    const oldProgress = settingsStore.getProgress(storyId);

    return resolvePublicReadingTarget(
      chapters,
      resume && { chapterId: resume.chapter_id, blockId: resume.block_id },
      oldProgress && {
        chapterId: oldProgress.chapter_id,
        blockId: oldProgress.block_id,
      }
    );
  })();

  const isDismissed =
    dismissedScope === sync.scope || (sync.ready && settingsStore.isResumeDismissed(storyId));

  const handleChapterClick = (chapter: Chapter) => {
    if (
      !resumeReading ||
      resumeReading.chapterId === chapter.id ||
      isDismissed
    ) {
      router.push(`/stories/${storyId}/${chapter.id}`);
      return;
    }

    setTargetChapter(chapter);
    setModalScope(sync.scope);
    setIsModalOpen(true);
  };

  const handleResume = () => {
    if (!resumeReading) return;
    setIsModalOpen(false);
    const resumeUrl = resumeReading.blockId
      ? `/stories/${storyId}/${resumeReading.chapterId}#${resumeReading.blockId}`
      : `/stories/${storyId}/${resumeReading.chapterId}`;
    router.push(resumeUrl);
  };

  const handleDismissAndNavigate = () => {
    if (!targetChapter) return;
    setDismissedScope(sync.scope);
    settingsStore.dismissResume(storyId);
    setIsModalOpen(false);
    router.push(`/stories/${storyId}/${targetChapter.id}`);
  };

  const targetChapterTitle = targetChapter
    ? `Chương ${targetChapter.order}: ${
        targetChapter.title.includes(":")
          ? targetChapter.title.split(":")[1]
          : targetChapter.title
      }`
    : "Chương đã chọn";

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-4">
        <h2 className="font-display text-2xl font-bold text-[var(--color-foreground)] flex items-center gap-2">
          <BookOpen className="w-6 h-6 text-[var(--color-accent)]" aria-hidden="true" />
          <span>Mục Lục Chương</span>
        </h2>
        <span className="font-ui text-sm text-[var(--color-muted-foreground)]">
          {chapters.length} chương
        </span>
      </div>

      <div className="space-y-3">
        {chapters.map((chapter) => {
          const effectCount = chapter.blocks.reduce(
            (count, block) => count + (block.effects?.length || 0),
            0
          );
          const isResumeChapter = resumeReading?.chapterId === chapter.id;

          return (
            <button
              type="button"
              disabled={!sync.ready && !sync.error}
              key={chapter.id}
              onClick={() => handleChapterClick(chapter)}
              className={`w-full min-h-11 text-left glass-card group flex items-center justify-between p-4 md:p-5 rounded-xl border transition-colors cursor-pointer motion-safe:hover:translate-x-1 ${
                isResumeChapter
                  ? "border-[var(--color-accent)]/50 bg-[var(--color-accent)]/5 hover:bg-[var(--color-accent)]/10"
                  : "border-[var(--color-border)] bg-[var(--color-card)]/70 hover:bg-[var(--color-muted)] hover:border-[var(--color-accent)]"
              }`}
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
                    <Sparkles className="w-3 h-3 text-[var(--color-accent)]" aria-hidden="true" />
                    <span>{effectCount} hiệu ứng</span>
                  </span>
                )}
                <span className="flex items-center gap-1 text-[var(--color-primary)] font-semibold motion-safe:group-hover:translate-x-1 transition-transform">
                  Đọc <ChevronRight className="w-4 h-4" aria-hidden="true" />
                </span>
              </div>
            </button>
          );
        })}
      </div>

      <ResumeReadingModal
        isOpen={isModalOpen && modalScope === sync.scope}
        targetChapterTitle={targetChapterTitle}
        onResume={handleResume}
        onDismiss={handleDismissAndNavigate}
      />
    </section>
  );
}
