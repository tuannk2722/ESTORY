"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Play, Bookmark, ArrowRight } from "lucide-react";
import { Story, Chapter } from "@/types/story";
import { settingsStore } from "@/lib/settingsStore";
import { ReadingProgress } from "@/types/settings";

export interface StoryDetailActionsProps {
  story: Story;
  firstChapter?: Chapter;
}

export default function StoryDetailActions({
  story,
  firstChapter,
}: StoryDetailActionsProps) {
  const [progress, setProgress] = useState<ReadingProgress | null>(null);
  const [isBookmarked, setIsBookmarked] = useState(false);

  useEffect(() => {
    setProgress(settingsStore.getProgress(story.id));
    setIsBookmarked(settingsStore.isBookmarked(story.id));
  }, [story.id]);

  const handleToggleBookmark = () => {
    const next = settingsStore.toggleBookmark(story.id);
    setIsBookmarked(next);
  };

  const continueUrl = progress
    ? `/stories/${story.id}/${progress.chapter_id}#${progress.block_id}`
    : firstChapter
    ? `/stories/${story.id}/${firstChapter.id}`
    : null;

  return (
    <div className="flex flex-wrap items-center gap-3 pt-4">
      {/* Nút Đọc tiếp hoặc Bắt đầu đọc */}
      {continueUrl && (
        <Link
          href={continueUrl}
          className="flex items-center gap-2 px-6 py-3 rounded-lg bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white font-ui font-semibold transition-all duration-200 shadow-lg hover:shadow-blue-500/25 min-h-[44px]"
        >
          {progress ? (
            <>
              <ArrowRight className="w-5 h-5" />
              <span>Đọc Tiếp</span>
            </>
          ) : (
            <>
              <Play className="w-5 h-5 fill-white" />
              <span>Bắt Đầu Đọc</span>
            </>
          )}
        </Link>
      )}

      {/* Bookmark Toggle */}
      <button
        onClick={handleToggleBookmark}
        className={`flex items-center gap-2 px-4 py-3 rounded-lg border font-ui font-medium text-sm transition-all duration-200 cursor-pointer min-h-[44px] ${
          isBookmarked
            ? "border-[var(--color-accent)] bg-[var(--color-accent)]/15 text-[var(--color-accent)]"
            : "border-[var(--color-border)] bg-[var(--color-card)] hover:bg-[var(--color-muted)] text-[var(--color-foreground)]"
        }`}
        aria-label="Đánh dấu truyện"
      >
        <Bookmark className="w-4 h-4" fill={isBookmarked ? "currentColor" : "none"} />
        <span>{isBookmarked ? "Đã Lưu Truyện" : "Lưu Đọc Sau"}</span>
      </button>
    </div>
  );
}
