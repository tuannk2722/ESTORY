"use client";

import React from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

export interface ChapterNavProps {
  storyId: string;
  prevChapterId?: string | null;
  nextChapterId?: string | null;
}

export default function ChapterNav({
  storyId,
  prevChapterId,
  nextChapterId,
}: ChapterNavProps) {
  return (
    <nav className="chapter-nav my-16 pt-8 border-t border-[var(--color-border)] flex items-center justify-between gap-4">
      {prevChapterId ? (
        <Link
          href={`/stories/${storyId}/${prevChapterId}`}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] hover:bg-[var(--color-muted)] hover:border-[var(--color-primary)] text-[var(--color-foreground)] transition-all duration-200 min-h-[44px]"
        >
          <ChevronLeft className="w-5 h-5 text-[var(--color-accent)]" />
          <span className="font-ui text-sm font-medium">Chương trước</span>
        </Link>
      ) : (
        <div />
      )}

      {nextChapterId ? (
        <Link
          href={`/stories/${storyId}/${nextChapterId}`}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white transition-all duration-200 shadow-md min-h-[44px]"
        >
          <span className="font-ui text-sm font-medium">Chương sau</span>
          <ChevronRight className="w-5 h-5" />
        </Link>
      ) : (
        <Link
          href={`/stories/${storyId}`}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-black font-semibold transition-all duration-200 shadow-md min-h-[44px]"
        >
          <span>Hoàn thành truyện</span>
        </Link>
      )}
    </nav>
  );
}
