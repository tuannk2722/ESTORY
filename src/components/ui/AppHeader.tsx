"use client";

import React from "react";
import Link from "next/link";
import { BookOpen, Bookmark, Clock, Sparkles } from "lucide-react";
import UserMenu from "./UserMenu";

export default function AppHeader() {
  return (
    <header className="sticky top-0 z-40 w-full bg-[var(--color-card)]/80 backdrop-blur-md border-b border-[var(--color-border)] px-4 py-3">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 group min-h-[44px]">
          <div className="w-8 h-8 rounded-lg bg-[var(--color-primary)] text-white flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
            <Sparkles className="w-4 h-4 text-[var(--color-accent)]" />
          </div>
          <span className="font-display text-lg font-bold tracking-wide text-[var(--color-foreground)] group-hover:text-[var(--color-accent)] transition-colors">
            StoryVerse
          </span>
        </Link>

        {/* Navigation Links & User Menu */}
        <nav className="flex items-center gap-1 sm:gap-4">
          <Link
            href="/"
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-ui text-[var(--color-foreground)] hover:bg-[var(--color-muted)] transition-colors min-h-[44px]"
          >
            <BookOpen className="w-4 h-4 text-[var(--color-accent)]" />
            <span className="hidden sm:inline">Khám phá</span>
          </Link>

          <Link
            href="/library/reading"
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-ui text-[var(--color-foreground)] hover:bg-[var(--color-muted)] transition-colors min-h-[44px]"
          >
            <Clock className="w-4 h-4 text-cyan-400" />
            <span className="hidden sm:inline">Đang đọc</span>
          </Link>

          <Link
            href="/library/bookmarks"
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-ui text-[var(--color-foreground)] hover:bg-[var(--color-muted)] transition-colors min-h-[44px]"
          >
            <Bookmark className="w-4 h-4 text-amber-400" />
            <span className="hidden sm:inline">Đã lưu</span>
          </Link>

          {/* User Profile & Theme Dropdown Menu */}
          <div className="ml-1 sm:ml-2">
            <UserMenu />
          </div>
        </nav>
      </div>
    </header>
  );
}
