"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Story } from "@/types/story";
import { settingsStore } from "@/lib/settingsStore";
import { ReadingProgress } from "@/types/settings";
import { ArrowRight, BookOpen, Clock, Sparkles } from "lucide-react";

export interface ReadingListClientProps {
  stories: Story[];
}

export default function ReadingListClient({ stories }: ReadingListClientProps) {
  const [progressList, setProgressList] = useState<ReadingProgress[]>([]);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    const all = settingsStore.getAllProgress();
    const reading = all
      .filter((p) => p.status === "reading")
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
    setProgressList(reading);
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return (
      <div className="glass-card p-12 text-center text-[var(--color-muted-foreground)]">
        Đang tải tiến trình đọc...
      </div>
    );
  }

  if (progressList.length === 0) {
    return (
      <div className="glass-card p-12 text-center space-y-4 border border-[var(--color-border)] rounded-2xl">
        <BookOpen className="w-12 h-12 mx-auto text-[var(--color-muted-foreground)] opacity-50" />
        <p className="font-story text-lg text-[var(--color-muted-foreground)]">
          Bạn chưa có truyện nào trong danh sách đang đọc dở.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white font-ui font-medium text-sm transition-colors shadow-md min-h-[44px]"
        >
          <span>Khám phá thư viện truyện</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {progressList.map((prog) => {
        const story = stories.find((s) => s.id === prog.story_id);
        const chapter = story?.chapters.find((ch) => ch.id === prog.chapter_id);
        const storyTitle = story?.title || prog.story_id;
        const chapterTitle = chapter?.title || prog.chapter_id;

        // Tính % tiến trình ước lượng dựa trên vị trí block trong chapter
        let progressPct = 0;
        if (chapter && chapter.blocks.length > 0) {
          const blockIndex = chapter.blocks.findIndex((b) => b.id === prog.block_id);
          const chapterIndex =
            story?.chapters
              .sort((a, b) => a.order - b.order)
              .findIndex((ch) => ch.id === prog.chapter_id) ?? 0;
          const totalChapters = story?.chapters.length ?? 1;
          // Tiến trình tổng = (chương hiện tại / tổng chương) + (block / blocks * 1/tổng chương)
          const chapterProgress =
            blockIndex >= 0 ? (blockIndex + 1) / chapter.blocks.length : 0;
          progressPct = Math.round(
            ((chapterIndex + chapterProgress) / totalChapters) * 100
          );
        }

        return (
          <Link
            key={prog.story_id}
            href={`/stories/${prog.story_id}/${prog.chapter_id}#${prog.block_id}`}
            className="group block glass-card p-5 md:p-6 rounded-xl border border-[var(--color-border)] hover:border-[var(--color-accent)] transition-all duration-300 bg-[var(--color-card)]/80 hover:bg-[var(--color-card)] hover:-translate-y-0.5 hover:shadow-lg cursor-pointer space-y-3"
          >
            {/* Header: Tiêu đề bên trái, Badge & Thời gian flex justify-end trên Desktop */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
              <h3 className="font-display text-xl md:text-2xl font-bold text-[var(--color-foreground)] group-hover:text-[var(--color-accent)] transition-colors line-clamp-1 flex-1">
                {storyTitle}
              </h3>

              <div className="flex items-center gap-2 sm:justify-end text-xs font-ui text-[var(--color-muted-foreground)] flex-shrink-0">
                <span className="px-2.5 py-0.5 text-xs font-ui rounded-full bg-[var(--color-secondary)] text-[var(--color-accent)] border border-[var(--color-border)] font-medium">
                  Đang đọc
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  <span>{new Date(prog.updated_at).toLocaleString("vi-VN")}</span>
                </span>
              </div>
            </div>

            {/* Vị trí chương đang đọc dở */}
            <div className="flex items-center justify-between text-sm text-[var(--color-muted-foreground)]">
              <p className="font-story text-sm md:text-base flex items-center gap-1.5 text-[var(--color-muted-foreground)]">
                <Sparkles className="w-3.5 h-3.5 text-[var(--color-accent)]" />
                <span>
                  Vị trí: <strong className="text-[var(--color-foreground)]">{chapterTitle}</strong>
                </span>
              </p>
              <span className="font-ui text-xs text-[var(--color-accent)] opacity-0 group-hover:opacity-100 transition-opacity font-medium hidden sm:inline-flex items-center gap-1">
                Đọc tiếp <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </span>
            </div>

            {/* Thanh % tiến trình ước lượng */}
            <div className="space-y-1.5 pt-1">
              <div className="flex justify-between text-xs font-ui text-[var(--color-muted-foreground)]">
                <span>Tiến trình đọc</span>
                <span className="font-semibold text-[var(--color-accent)]">{progressPct}%</span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-[var(--color-border)] overflow-hidden">
                <div
                  className="h-full rounded-full bg-[var(--color-accent)] transition-all duration-500"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
