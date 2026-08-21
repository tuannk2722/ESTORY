"use client";

import { useEffect, useRef } from "react";
import { settingsStore } from "@/lib/settingsStore";
import { ReadingStatus } from "@/types/settings";

interface UseReadingProgressProps {
  storyId: string;
  chapterId: string;
  activeBlockId: string | null;
  isLastChapter?: boolean;
  isLastBlock?: boolean;
}

export function useReadingProgress({
  storyId,
  chapterId,
  activeBlockId,
  isLastChapter = false,
  isLastBlock = false,
}: UseReadingProgressProps) {
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!activeBlockId || !storyId || !chapterId) return;

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    // Debounce ~1s theo US-1.6
    timerRef.current = setTimeout(() => {
      const status: ReadingStatus = isLastChapter && isLastBlock ? "completed" : "reading";
      settingsStore.saveProgress({
        story_id: storyId,
        chapter_id: chapterId,
        block_id: activeBlockId,
        status,
        updated_at: new Date().toISOString(),
      });
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [storyId, chapterId, activeBlockId, isLastChapter, isLastBlock]);
}
