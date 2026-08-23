"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Settings } from "lucide-react";
import SettingsPanel from "./SettingsPanel";

export interface ReaderScreenHeaderProps {
  storyId: string;
  storyTitle: string;
  chapterTitle: string;
}

export default function ReaderScreenHeader({
  storyId,
  storyTitle,
  chapterTitle,
}: ReaderScreenHeaderProps) {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-40 w-full bg-[var(--color-card)]/80 backdrop-blur-md border-b border-[var(--color-border)] px-4 py-3 transition-colors">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          {/* Back link */}
          <Link
            href={`/stories/${storyId}`}
            className="flex items-center gap-2 text-sm font-ui text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] transition-colors min-h-[44px] px-2 rounded-lg"
          >
            <ArrowLeft className="w-4 h-4 text-[var(--color-accent)]" />
            <span className="hidden sm:inline line-clamp-1">{storyTitle}</span>
          </Link>

          <span className="font-ui text-sm font-semibold text-[var(--color-foreground)] line-clamp-1 text-center">
            {chapterTitle}
          </span>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="p-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] hover:bg-[var(--color-muted)] text-[var(--color-foreground)] transition-all min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
              title="Cài đặt đọc truyện"
              aria-label="Cài đặt đọc truyện"
            >
              <Settings className="w-5 h-5 text-[var(--color-accent)]" />
            </button>
          </div>
        </div>
      </header>

      {/* Settings Panel Drawer */}
      <SettingsPanel
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </>
  );
}
