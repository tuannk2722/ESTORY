"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Bookmark, Sparkles, User } from "lucide-react";
import { Story } from "@/types/story";
import { settingsStore } from "@/lib/settingsStore";
import { useHydrated } from "@/hooks/useHydrated";

export interface StoryCardProps {
  story: Story;
}

export default function StoryCard({ story }: StoryCardProps) {
  const isHydrated = useHydrated();
  const [bookmarkOverride, setBookmarkOverride] = useState<{
    storyId: string;
    value: boolean;
  } | null>(null);
  const isBookmarked =
    bookmarkOverride?.storyId === story.id
      ? bookmarkOverride.value
      : isHydrated && settingsStore.isBookmarked(story.id);

  const handleToggleBookmark = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const nextState = settingsStore.toggleBookmark(story.id);
    setBookmarkOverride({ storyId: story.id, value: nextState });
  };

  return (
    <div className="glass-card group relative flex flex-col justify-between overflow-hidden border border-[var(--color-border)] hover:border-[var(--color-accent)] transition-all duration-300 hover:shadow-xl bg-[var(--color-card)]/80 hover:-translate-y-1">
      {/* Cover / Decorative Top Banner */}
      <div className="relative h-44 w-full bg-gradient-to-br from-indigo-950/80 via-slate-900 to-[var(--color-card)] flex items-center justify-center p-6 border-b border-[var(--color-border)] overflow-hidden">
        {/* Glow effect */}
        <div className="absolute -top-12 -right-12 w-32 h-32 bg-[var(--color-primary)]/20 rounded-full blur-2xl group-hover:bg-[var(--color-accent)]/20 transition-all duration-500" />
        
        <div className="relative text-center z-10">
          <div className="w-12 h-12 mx-auto rounded-full bg-[var(--color-background)]/80 border border-[var(--color-border)] flex items-center justify-center mb-3 shadow-inner">
            <Sparkles className="w-6 h-6 text-[var(--color-accent)]" />
          </div>
          <h3 className="font-display text-lg font-bold text-[var(--color-foreground)] line-clamp-1">
            {story.title}
          </h3>
        </div>

        {/* Bookmark Button */}
        <button
          onClick={handleToggleBookmark}
          className={`absolute top-3 right-3 p-2 rounded-full backdrop-blur-md border transition-all z-20 cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center ${
            isBookmarked
              ? "bg-[var(--color-accent)]/20 border-[var(--color-accent)] text-[var(--color-accent)]"
              : "bg-black/40 border-white/10 text-white/70 hover:text-white hover:bg-black/60"
          }`}
          title={isBookmarked ? "Đã lưu" : "Lưu truyện"}
          aria-label="Đánh dấu truyện"
        >
          <Bookmark className="w-4 h-4" fill={isBookmarked ? "currentColor" : "none"} />
        </button>
      </div>

      {/* Content */}
      <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
        <div>
          {/* Author */}
          <div className="flex items-center gap-1.5 text-xs font-ui text-[var(--color-muted-foreground)] mb-2">
            <User className="w-3.5 h-3.5" />
            <span>Tác giả: {story.author}</span>
          </div>

          {/* Description */}
          <p className="font-story text-sm text-[var(--color-foreground)]/80 line-clamp-3 leading-relaxed">
            {story.description}
          </p>
        </div>

        {/* Genres & CTA */}
        <div className="space-y-4 pt-2">
          <div className="flex flex-wrap gap-1.5">
            {story.genre.map((g) => (
              <span
                key={g}
                className="px-2.5 py-0.5 text-xs font-ui rounded-full bg-[var(--color-secondary)] text-[var(--color-secondary-foreground)] border border-[var(--color-border)]"
              >
                {g}
              </span>
            ))}
          </div>

          <Link
            href={`/stories/${story.id}`}
            className="block w-full text-center py-2.5 px-4 rounded-lg bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-[var(--color-primary-foreground)] font-ui text-sm font-semibold transition-colors shadow-md min-h-[44px] flex items-center justify-center"
          >
            Đọc Truyện →
          </Link>
        </div>
      </div>
    </div>
  );
}
