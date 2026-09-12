"use client";

import React from "react";
import Link from "next/link";
import { Bookmark } from "lucide-react";
import { Story } from "@/types/story";
import { settingsStore } from "@/lib/settingsStore";
import { useSettingsSync } from "@/hooks/useSettingsSync";
import StoryCardVisual from "@/components/story/StoryCardVisual";

export interface StoryCardProps {
  story: Story;
}

export default function StoryCard({ story }: StoryCardProps) {
  const sync = useSettingsSync();
  const isBookmarked = sync.ready && settingsStore.isBookmarked(story.id);

  const handleToggleBookmark = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    settingsStore.toggleBookmark(story.id);
  };

  return (
    <StoryCardVisual
      story={story}
      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
      interactive
      fillHeight
      navigationOverlay={(
        <Link
          href={`/stories/${story.id}`}
          aria-label={`Xem chi tiết truyện ${story.title}`}
          className="absolute inset-0 z-10 rounded-2xl focus-visible:outline-2 focus-visible:outline-[var(--color-ring)] focus-visible:outline-offset-2"
        />
      )}
      mediaAction={(
        <button
          disabled={!sync.canWrite}
          onClick={handleToggleBookmark}
          className={`absolute right-3 top-3 z-20 flex min-h-[44px] min-w-[44px] cursor-pointer items-center justify-center rounded-full border backdrop-blur-md transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-60 ${
            isBookmarked
              ? "border-white/30 bg-[var(--color-accent)] text-[var(--color-accent-foreground)]"
              : "border-white/25 bg-black/45 text-white/80 hover:bg-black/65 hover:text-white"
          }`}
          title={isBookmarked ? "Đã lưu" : "Lưu truyện"}
          aria-label="Đánh dấu truyện"
        >
          <Bookmark aria-hidden="true" className="h-4 w-4" fill={isBookmarked ? "currentColor" : "none"} />
        </button>
      )}
    />
  );
}
