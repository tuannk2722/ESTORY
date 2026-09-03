"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, BookOpen, Bookmark, Calendar, User } from "lucide-react";
import { useHydrated } from "@/hooks/useHydrated";
import { settingsStore } from "@/lib/settingsStore";
import type { Story } from "@/types/story";

export interface BookmarksListClientProps {
  stories: Story[];
}

export default function BookmarksListClient({
  stories,
}: BookmarksListClientProps) {
  const isHydrated = useHydrated();
  const [, setRevision] = useState(0);
  const bookmarks = isHydrated
    ? settingsStore
        .getBookmarks()
        .slice()
        .sort(
          (a, b) =>
            new Date(b.created_at).getTime() -
            new Date(a.created_at).getTime()
        )
    : [];

  const handleRemoveBookmark = (storyId: string) => {
    settingsStore.toggleBookmark(storyId);
    setRevision((current) => current + 1);
  };

  if (!isHydrated) {
    return (
      <div className="glass-card p-12 text-center text-[var(--color-muted-foreground)]">
        Đang tải danh sách...
      </div>
    );
  }

  if (bookmarks.length === 0) {
    return (
      <div className="glass-card p-12 text-center space-y-4 border border-[var(--color-border)] rounded-2xl">
        <BookOpen
          className="w-12 h-12 mx-auto text-[var(--color-muted-foreground)] opacity-50"
          aria-hidden="true"
        />
        <p className="font-story text-lg text-[var(--color-muted-foreground)]">
          Chưa có tác phẩm nào trong danh sách đã lưu.
        </p>
        <Link
          href="/"
          className="inline-flex min-h-11 items-center gap-2 px-6 py-2.5 rounded-lg bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white font-ui font-medium text-sm transition-colors shadow-md"
        >
          <span>Khám phá và lưu truyện</span>
          <ArrowRight className="w-4 h-4" aria-hidden="true" />
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {bookmarks.map((bookmark) => {
        const story = stories.find((item) => item.id === bookmark.story_id);
        const title = story?.title || bookmark.story_id;
        const author = story?.author || "Tác giả";
        const description = story?.description || "Không có mô tả";

        return (
          <article
            key={bookmark.story_id}
            className="group glass-card p-5 md:p-6 rounded-xl border border-[var(--color-border)] hover:border-[var(--color-accent)] transition-colors bg-[var(--color-card)]/80 hover:bg-[var(--color-card)] hover:shadow-lg"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-2.5 flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-xs font-ui text-[var(--color-muted-foreground)]">
                  <span className="flex items-center gap-1">
                    <User className="w-3.5 h-3.5 text-[var(--color-accent)]" aria-hidden="true" />
                    <span>
                      Tác giả: <strong className="text-[var(--color-foreground)]">{author}</strong>
                    </span>
                  </span>
                  <span aria-hidden="true" className="opacity-40">•</span>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>
                      Lưu ngày: {new Date(bookmark.created_at).toLocaleDateString("vi-VN")}
                    </span>
                  </span>
                  {story?.genre?.[0] && (
                    <span className="px-2 py-0.5 rounded-full bg-[var(--color-secondary)] text-[var(--color-accent)] border border-[var(--color-border)] text-[11px]">
                      {story.genre[0]}
                    </span>
                  )}
                </div>

                <Link
                  href={`/stories/${bookmark.story_id}`}
                  className="inline-flex items-center gap-2 rounded-sm font-display text-xl md:text-2xl font-bold text-[var(--color-foreground)] hover:text-[var(--color-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
                >
                  <span className="line-clamp-1">{title}</span>
                  <ArrowRight className="w-4 h-4 shrink-0" aria-hidden="true" />
                </Link>

                <p className="font-story text-sm md:text-base text-[var(--color-muted-foreground)] line-clamp-2 leading-relaxed">
                  {description}
                </p>
              </div>

              <button
                type="button"
                onClick={() => handleRemoveBookmark(bookmark.story_id)}
                className="self-end sm:self-center flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-[var(--color-accent)]/40 bg-[var(--color-accent)]/10 text-[var(--color-accent)] hover:border-red-500/50 hover:bg-red-500/10 hover:text-red-500 transition-colors"
                title="Bỏ lưu khỏi thư viện"
                aria-label={`Bỏ lưu ${title}`}
              >
                <Bookmark className="w-5 h-5 fill-current" aria-hidden="true" />
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );
}
