"use client";

import { useEffect, useRef, useCallback } from "react";
import { settingsStore } from "@/lib/settingsStore";
import { RESUME_COMMIT_THRESHOLDS, ReadingStatus } from "@/types/settings";

interface UseResumeCommitProps {
  storyId: string;
  chapterId: string;
  activeBlockId: string | null;
  isLastChapter?: boolean;
  isLastBlock?: boolean;
  isPaused?: boolean;
}

/**
 * Hook theo dõi hành vi đọc thực sự (time spent + scroll progress)
 * và chỉ commit resumeReading khi reader đọc đủ threshold.
 *
 * Nguyên tắc cốt lõi (Section 5 & 11 trong plan):
 *   Current navigation ≠ Confirmed reading progress
 *   → Mở chapter mới nhưng chưa thực sự đọc → không ghi đè resume chapter.
 */
export function useResumeCommit({
  storyId,
  chapterId,
  activeBlockId,
  isLastChapter = false,
  isLastBlock = false,
  isPaused = false,
}: UseResumeCommitProps) {
  const committedRef = useRef(false);
  const startTimeRef = useRef<number>(Date.now());
  const chapterIdRef = useRef(chapterId);

  // Reset khi chapter thay đổi
  useEffect(() => {
    if (chapterIdRef.current !== chapterId) {
      committedRef.current = false;
      startTimeRef.current = Date.now();
      chapterIdRef.current = chapterId;
    }
  }, [chapterId]);

  const commitIfReady = useCallback(() => {
    if (committedRef.current || isPaused || !activeBlockId) return;

    const timeSpent = Date.now() - startTimeRef.current;
    const windowHeight = window.innerHeight;
    const documentHeight = document.documentElement.scrollHeight - windowHeight;
    const scrollProgress = documentHeight > 0
      ? Math.min(1, Math.max(0, window.scrollY / documentHeight))
      : 0;

    const timeThresholdMet = timeSpent >= RESUME_COMMIT_THRESHOLDS.TIME_SPENT_MS;
    const scrollThresholdMet = scrollProgress >= RESUME_COMMIT_THRESHOLDS.SCROLL_PROGRESS;

    if (timeThresholdMet || scrollThresholdMet) {
      committedRef.current = true;
      const status: ReadingStatus = isLastChapter && isLastBlock ? "completed" : "reading";

      settingsStore.saveResumeReading(storyId, {
        chapter_id: chapterId,
        block_id: activeBlockId,
        progress: scrollProgress,
        updated_at: Date.now(),
      });

      settingsStore.saveProgress({
        story_id: storyId,
        chapter_id: chapterId,
        block_id: activeBlockId,
        status,
        updated_at: new Date().toISOString(),
      });
    }
  }, [storyId, chapterId, activeBlockId, isLastChapter, isLastBlock, isPaused]);

  // Kiểm tra scroll threshold trên mỗi scroll event
  useEffect(() => {
    if (committedRef.current || isPaused) return;

    const onScroll = () => commitIfReady();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [commitIfReady, isPaused]);

  // Kiểm tra time threshold bằng interval (mỗi 2s)
  useEffect(() => {
    if (committedRef.current || isPaused) return;

    const intervalId = setInterval(() => {
      commitIfReady();
    }, 2000);

    return () => clearInterval(intervalId);
  }, [commitIfReady, isPaused]);

  // Cập nhật block_id mới nhất nếu đã committed (giữ vị trí đọc mới nhất khi cuộn tiếp)
  useEffect(() => {
    if (!committedRef.current || isPaused || !activeBlockId) return;

    const windowHeight = window.innerHeight;
    const documentHeight = document.documentElement.scrollHeight - windowHeight;
    const scrollProgress = documentHeight > 0
      ? Math.min(1, Math.max(0, window.scrollY / documentHeight))
      : 0;

    const status: ReadingStatus = isLastChapter && isLastBlock ? "completed" : "reading";

    settingsStore.saveResumeReading(storyId, {
      chapter_id: chapterId,
      block_id: activeBlockId,
      progress: scrollProgress,
      updated_at: Date.now(),
    });

    settingsStore.saveProgress({
      story_id: storyId,
      chapter_id: chapterId,
      block_id: activeBlockId,
      status,
      updated_at: new Date().toISOString(),
    });
  }, [storyId, chapterId, activeBlockId, isLastChapter, isLastBlock, isPaused]);
}
