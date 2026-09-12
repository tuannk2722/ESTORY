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
  variant?: "default" | "media";
}

export default function StoryDetailActions({
  story,
  firstChapter,
  variant = "default",
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
  const onMedia = variant === "media";

  return (
    <div className={`flex flex-wrap items-center gap-3 ${onMedia ? "border-t border-white/20 pt-5" : "pt-4"}`}>
      {/* Nút Đọc tiếp hoặc Bắt đầu đọc */}
      {continueUrl && (
        <Link
          href={continueUrl}
          aria-disabled={!sync.ready && !sync.error}
          onClick={(event) => { if (!sync.ready && !sync.error) event.preventDefault(); }}
          className="flex min-h-[48px] items-center gap-2 rounded-xl bg-[var(--color-primary)] px-6 py-3 font-ui font-semibold text-[var(--color-primary-foreground)] shadow-lg transition-[background-color,box-shadow] duration-200 hover:bg-[var(--color-primary-hover)] hover:shadow-xl motion-reduce:transition-none"
        >
          {readingTarget ? (
            <>
              <ArrowRight aria-hidden="true" className="h-5 w-5" />
              <span>Đọc Tiếp</span>
            </>
          ) : (
            <>
              <Play aria-hidden="true" className="h-5 w-5 fill-current" />
              <span>{!sync.ready && !sync.error ? "Đang tải vị trí đọc..." : "Bắt Đầu Đọc"}</span>
            </>
          )}
        </Link>
      )}

      {/* Bookmark Toggle */}
      <button
        disabled={!sync.canWrite}
        onClick={handleToggleBookmark}
        className={`flex min-h-[48px] cursor-pointer items-center gap-2 rounded-xl border px-4 py-3 font-ui text-sm font-medium transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none ${
          isBookmarked
            ? onMedia
              ? "border-white/30 bg-[var(--color-accent)] text-[var(--color-accent-foreground)]"
              : "border-[var(--color-accent)] bg-[var(--color-accent)]/15 text-[var(--color-accent)]"
            : onMedia
              ? "border-white/25 bg-black/35 text-white hover:bg-white/15"
              : "border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-foreground)] hover:bg-[var(--color-muted)]"
        }`}
        aria-pressed={isBookmarked}
      >
        <Bookmark aria-hidden="true" className="h-4 w-4" fill={isBookmarked ? "currentColor" : "none"} />
        <span>{isBookmarked ? "Đã Lưu Truyện" : "Lưu Đọc Sau"}</span>
      </button>
    </div>
  );
}
