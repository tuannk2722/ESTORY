"use client";

import React from "react";
import Link from "next/link";
import { Play, Bookmark, ArrowRight } from "lucide-react";
import { Story, Chapter } from "@/types/story";
import { settingsStore } from "@/lib/settingsStore";
import { useSettingsSync } from "@/hooks/useSettingsSync";
import { resolvePublicReadingTarget } from "@/lib/reader/publicReadingTarget";

export interface StoryDetailActionsProps {
  story: Story;
  firstChapter?: Chapter;
}

export default function StoryDetailActions({
  story,
  firstChapter,
}: StoryDetailActionsProps) {
  const sync = useSettingsSync();
  const isHydrated = sync.ready;
  const readingTarget = (() => {
    if (!isHydrated) return null;
    const resume = settingsStore.getResumeReading(story.id);
    const progress = settingsStore.getProgress(story.id);

    return resolvePublicReadingTarget(
      story.chapters,
      resume && { chapterId: resume.chapter_id, blockId: resume.block_id },
      progress && {
        chapterId: progress.chapter_id,
        blockId: progress.block_id,
      }
    );
  })();
  const isBookmarked = isHydrated && settingsStore.isBookmarked(story.id);

  const handleToggleBookmark = () => {
    settingsStore.toggleBookmark(story.id);
  };

  const continueUrl = readingTarget
    ? `/stories/${story.id}/${readingTarget.chapterId}${
        readingTarget.blockId ? `#${readingTarget.blockId}` : ""
      }`
    : firstChapter
    ? `/stories/${story.id}/${firstChapter.id}`
    : null;

  return (
    <div className="flex flex-wrap items-center gap-3 pt-4">
      {/* Nút Đọc tiếp hoặc Bắt đầu đọc */}
      {continueUrl && (
        <Link
          href={continueUrl}
          aria-disabled={!sync.ready && !sync.error}
          onClick={(event) => { if (!sync.ready && !sync.error) event.preventDefault(); }}
          className="flex items-center gap-2 px-6 py-3 rounded-lg bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-[var(--color-primary-foreground)] font-ui font-semibold transition-all duration-200 shadow-lg hover:shadow-blue-500/25 min-h-[44px]"
        >
          {readingTarget ? (
            <>
              <ArrowRight className="w-5 h-5" />
              <span>Đọc Tiếp</span>
            </>
          ) : (
            <>
              <Play className="w-5 h-5 fill-white" />
              <span>{!sync.ready && !sync.error ? "Đang tải vị trí đọc..." : "Bắt Đầu Đọc"}</span>
            </>
          )}
        </Link>
      )}

      {/* Bookmark Toggle */}
      <button
        disabled={!sync.canWrite}
        onClick={handleToggleBookmark}
        className={`flex items-center gap-2 px-4 py-3 rounded-lg border font-ui font-medium text-sm transition-all duration-200 cursor-pointer min-h-[44px] ${
          isBookmarked
            ? "border-[var(--color-accent)] bg-[var(--color-accent)]/15 text-[var(--color-accent)]"
            : "border-[var(--color-border)] bg-[var(--color-card)] hover:bg-[var(--color-muted)] text-[var(--color-foreground)]"
        }`}
        aria-pressed={isBookmarked}
      >
        <Bookmark className="w-4 h-4" fill={isBookmarked ? "currentColor" : "none"} />
        <span>{isBookmarked ? "Đã Lưu Truyện" : "Lưu Đọc Sau"}</span>
      </button>
    </div>
  );
}
