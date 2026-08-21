"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Story } from "@/types/story";
import { settingsStore } from "@/lib/settingsStore";
import { Bookmark as IBookmark } from "@/types/bookmark";
import { BookOpen, User, Bookmark, ArrowRight, Calendar } from "lucide-react";

export interface BookmarksListClientProps {
  stories: Story[];
}

export default function BookmarksListClient({ stories }: BookmarksListClientProps) {
  const [bookmarks, setBookmarks] = useState<IBookmark[]>([]);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    loadBookmarks();
  }, []);

  const loadBookmarks = () => {
    const all = settingsStore.getBookmarks();
    const sorted = [...all].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    setBookmarks(sorted);
    setIsMounted(true);
  };

  const handleRemoveBookmark = (e: React.MouseEvent, storyId: string) => {
    e.preventDefault();
    e.stopPropagation();
    settingsStore.toggleBookmark(storyId);
    loadBookmarks();
  };

  if (!isMounted) {
    return (
      <div className="glass-card p-12 text-center text-[var(--color-muted-foreground)]">
        Đang tải danh sách...
      </div>
    );
  }

  if (bookmarks.length === 0) {
    return (
      <div className="glass-card p-12 text-center space-y-4 border border-[var(--color-border)] rounded-2xl">
        <BookOpen className="w-12 h-12 mx-auto text-[var(--color-muted-foreground)] opacity-50" />
        <p className="font-story text-lg text-[var(--color-muted-foreground)]">
          Chưa có tác phẩm nào trong danh sách đã lưu.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white font-ui font-medium text-sm transition-colors shadow-md min-h-[44px]"
        >
          <span>Khám phá và lưu truyện</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {bookmarks.map((bm) => {
        const story = stories.find((s) => s.id === bm.story_id);
        const title = story?.title || bm.story_id;
        const author = story?.author || "Tác giả";
        const description = story?.description || "Không có mô tả";

        return (
          <Link
            key={bm.story_id}
            href={`/stories/${bm.story_id}`}
            className="group block glass-card p-5 md:p-6 rounded-xl border border-[var(--color-border)] hover:border-[var(--color-accent)] transition-all duration-300 bg-[var(--color-card)]/80 hover:bg-[var(--color-card)] hover:-translate-y-0.5 hover:shadow-lg cursor-pointer"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              {/* Thông tin tác phẩm */}
              <div className="space-y-2.5 flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-xs font-ui text-[var(--color-muted-foreground)]">
                  <span className="flex items-center gap-1">
                    <User className="w-3.5 h-3.5 text-[var(--color-accent)]" />
                    <span>Tác giả: <strong className="text-[var(--color-foreground)]">{author}</strong></span>
                  </span>
                  <span className="opacity-40">•</span>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>Lưu ngày: {new Date(bm.created_at).toLocaleDateString("vi-VN")}</span>
                  </span>
                  {story?.genre && story.genre.length > 0 && (
                    <>
                      <span className="opacity-40">•</span>
                      <span className="px-2 py-0.5 rounded-full bg-[var(--color-secondary)] text-[var(--color-accent)] border border-[var(--color-border)] text-[11px]">
                        {story.genre[0]}
                      </span>
                    </>
                  )}
                </div>

                <h3 className="font-display text-xl md:text-2xl font-bold text-[var(--color-foreground)] group-hover:text-[var(--color-accent)] transition-colors line-clamp-1">
                  {title}
                </h3>

                <p className="font-story text-sm md:text-base text-[var(--color-muted-foreground)] line-clamp-2 leading-relaxed">
                  {description}
                </p>
              </div>

              {/* Nút thao tác bookmark */}
              <div className="flex items-center gap-3 self-end sm:self-center flex-shrink-0">
                <button
                  type="button"
                  onClick={(e) => handleRemoveBookmark(e, bm.story_id)}
                  className="p-2.5 rounded-xl border border-[var(--color-accent)]/40 bg-[var(--color-accent)]/10 text-[var(--color-accent)] hover:border-red-500/50 hover:bg-red-500/10 hover:text-red-400 transition-all duration-200 min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer shadow-xs"
                  title="Bỏ lưu khỏi thư viện"
                  aria-label="Bỏ lưu truyện"
                >
                  <Bookmark className="w-5 h-5 fill-current" />
                </button>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
