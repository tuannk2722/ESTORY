"use client";

import { useCallback, useEffect, useRef } from "react";
import { settingsStore } from "@/lib/settingsStore";
import { calculateScrollProgress } from "@/lib/reader/readerMetrics";
import { RESUME_COMMIT_THRESHOLDS, type ReadingStatus } from "@/types/settings";
import { useSettingsSync } from "./useSettingsSync";

interface UseResumeCommitProps {
  storyId: string;
  chapterId: string;
  activeBlockId: string | null;
  isLastChapter?: boolean;
  isLastBlock?: boolean;
  isPaused?: boolean;
}

interface LatestReadingState extends UseResumeCommitProps {
  scope: number;
  isLastChapter: boolean;
  isLastBlock: boolean;
  isPaused: boolean;
}

const SAVE_DEBOUNCE_MS = 1_000;

/**
 * Chỉ xác nhận chapter là "đang đọc" sau khi reader đạt ngưỡng thời gian/cuộn.
 * Sau đó, block mới nhất được lưu với debounce 1 giây theo US-1.6.
 */
export function useResumeCommit({
  storyId,
  chapterId,
  activeBlockId,
  isLastChapter = false,
  isLastBlock = false,
  isPaused = false,
}: UseResumeCommitProps) {
  const sync = useSettingsSync();
  const paused = isPaused || !sync.canWrite;
  const committedRef = useRef(false);
  const startTimeRef = useRef(0);
  const saveTimerRef = useRef<number | null>(null);
  const intervalRef = useRef<number | null>(null);
  const latestRef = useRef<LatestReadingState>({
    scope: sync.scope,
    storyId,
    chapterId,
    activeBlockId,
    isLastChapter,
    isLastBlock,
    isPaused: paused,
  });

  useEffect(() => {
    latestRef.current = {
      scope: sync.scope,
      storyId,
      chapterId,
      activeBlockId,
      isLastChapter,
      isLastBlock,
      isPaused: paused,
    };
  }, [activeBlockId, chapterId, isLastBlock, isLastChapter, paused, storyId, sync.scope]);

  const persistLatest = useCallback(() => {
    const latest = latestRef.current;
    if (!committedRef.current || latest.isPaused || !latest.activeBlockId || latest.scope !== settingsStore.getStatus().scope) return;

    const scrollProgress = calculateScrollProgress(
      window.scrollY,
      document.documentElement.scrollHeight,
      window.innerHeight
    );
    const status: ReadingStatus =
      latest.isLastChapter && latest.isLastBlock ? "completed" : "reading";
    const updatedAt = Date.now();

    settingsStore.saveResumeReading(latest.storyId, {
      chapter_id: latest.chapterId,
      block_id: latest.activeBlockId,
      progress: scrollProgress,
      updated_at: updatedAt,
    });
    settingsStore.saveProgress({
      story_id: latest.storyId,
      chapter_id: latest.chapterId,
      block_id: latest.activeBlockId,
      status,
      updated_at: new Date(updatedAt).toISOString(),
    });
  }, []);

  const scheduleSave = useCallback(() => {
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      saveTimerRef.current = null;
      persistLatest();
    }, SAVE_DEBOUNCE_MS);
  }, [persistLatest]);

  const commitIfReady = useCallback(() => {
    const latest = latestRef.current;
    if (committedRef.current || latest.isPaused || !latest.activeBlockId) return;

    const timeThresholdMet =
      Date.now() - startTimeRef.current >= RESUME_COMMIT_THRESHOLDS.TIME_SPENT_MS;
    const scrollThresholdMet =
      calculateScrollProgress(
        window.scrollY,
        document.documentElement.scrollHeight,
        window.innerHeight
      ) >= RESUME_COMMIT_THRESHOLDS.SCROLL_PROGRESS;

    if (!timeThresholdMet && !scrollThresholdMet) return;
    committedRef.current = true;
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    scheduleSave();
  }, [scheduleSave]);

  useEffect(() => {
    committedRef.current = false;
    startTimeRef.current = Date.now();
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
  }, [chapterId, storyId, sync.scope, paused]);

  useEffect(() => {
    if (committedRef.current) scheduleSave();
  }, [activeBlockId, isLastBlock, isLastChapter, scheduleSave]);

  useEffect(() => {
    if (paused) return;
    window.addEventListener("scroll", commitIfReady, { passive: true });
    intervalRef.current = window.setInterval(commitIfReady, 2_000);
    return () => {
      window.removeEventListener("scroll", commitIfReady);
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [commitIfReady, paused, sync.scope, storyId, chapterId]);

  useEffect(() => {
    const flushPendingSave = () => {
      if (!saveTimerRef.current) return;
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
      persistLatest();
    };
    window.addEventListener("pagehide", flushPendingSave);
    return () => {
      window.removeEventListener("pagehide", flushPendingSave);
      flushPendingSave();
    };
  }, [persistLatest]);
}
