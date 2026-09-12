"use client";

import Image from "next/image";
import Link from "next/link";
import {
  Archive,
  BookOpen,
  EllipsisVertical,
  RotateCcw,
  Send,
  Trash2,
  Undo2,
} from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { coverObjectPosition } from "@/lib/story-cover";
import type { AuthorStoryListItem } from "@/types/story-management";
import type { StoryAction } from "./types";
import StatusBadge from "./StatusBadge";
import { submitReadiness } from "./storyRules";

interface StoryManageCardProps {
  item: AuthorStoryListItem;
  busy?: boolean;
  onAction(action: StoryAction, item: AuthorStoryListItem): void;
}

const MENU_NAVIGATION_KEYS = new Set(["ArrowDown", "ArrowUp", "Home", "End"]);

export default function StoryManageCard({ item, busy = false, onAction }: StoryManageCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const { story, rejectionReason } = item;
  const publishedChapters = story.chapters.filter((chapter) => chapter.status === "published").length;
  const readiness = submitReadiness(story);
  const explanationId = `card-${story.id}-submit-explanation`;

  useEffect(() => {
    if (!menuOpen) return;
    const menu = menuRef.current;
    const trigger = menuTriggerRef.current;
    const focusFrame = requestAnimationFrame(() => {
      menu?.querySelector<HTMLButtonElement>('button:not([disabled])')?.focus();
    });
    const handlePointerDown = (event: PointerEvent) => {
      if (!menu?.contains(event.target as Node) && !trigger?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setMenuOpen(false);
      trigger?.focus();
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      cancelAnimationFrame(focusFrame);
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  const runAction = (action: StoryAction) => {
    setMenuOpen(false);
    onAction(action, item);
  };

  const handleMenuKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!MENU_NAVIGATION_KEYS.has(event.key)) return;
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('button:not([disabled])') ?? []);
    if (items.length === 0) return;
    event.preventDefault();
    const current = Math.max(0, items.indexOf(document.activeElement as HTMLButtonElement));
    const next = event.key === "Home" ? 0
      : event.key === "End" ? items.length - 1
        : event.key === "ArrowDown" ? (current + 1) % items.length
          : (current - 1 + items.length) % items.length;
    items[next].focus();
  };

  return (
    <article className="glass-card group flex h-full flex-col overflow-hidden border border-[var(--color-border)] bg-[var(--color-card)]/85 transition-[border-color,box-shadow] hover:border-[var(--color-primary)]/50 hover:shadow-xl motion-reduce:transition-none">
      <div className="relative aspect-video overflow-hidden border-b border-[var(--color-border)] bg-[var(--color-muted)]">
        {story.cover_image ? (
          <Image
            loader={({ src }) => src}
            unoptimized
            fill
            src={story.cover_image}
            alt={`Ảnh bìa ${story.title}`}
            className="object-cover"
            style={{ objectPosition: coverObjectPosition(story.cover_position) }}
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[var(--color-secondary)] to-[var(--color-card)] text-[var(--color-muted-foreground)]">
            <BookOpen aria-hidden="true" className="h-10 w-10" />
          </div>
        )}
        <div className="absolute right-3 top-3"><StatusBadge status={story.status} onMedia /></div>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <h2 className="font-display text-xl font-bold leading-tight text-[var(--color-foreground)]">
          <Link href={`/author/stories/${encodeURIComponent(story.id)}`} className="rounded hover:text-[var(--color-accent)]">{story.title}</Link>
        </h2>
        <p className="mt-2 text-sm text-[var(--color-muted-foreground)]">
          {publishedChapters}/{story.chapters.length} chương đã publish
        </p>
        {story.status === "rejected" && rejectionReason ? (
          <p className="mt-3 line-clamp-1 rounded-lg bg-[var(--color-destructive)]/10 px-3 py-2 text-sm text-[var(--color-destructive)]" title={rejectionReason}>
            Lý do: {rejectionReason}
          </p>
        ) : null}

        <div className="mt-auto flex items-center gap-2 pt-5">
          <Link href={`/author/stories/${encodeURIComponent(story.id)}`} className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl bg-[var(--color-editor-action)] px-4 text-sm font-semibold text-[var(--color-editor-action-foreground)] transition-colors hover:bg-[var(--color-editor-action-hover)]">
            {story.status === "pending_review" || story.status === "archived" ? "Xem chi tiết" : "Sửa"}
          </Link>
          <div className="relative">
            <button
              ref={menuTriggerRef}
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-label={`Thêm hành động cho ${story.title}`}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              className="flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-xl border border-[var(--color-border)] text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]"
            >
              <EllipsisVertical aria-hidden="true" className="h-5 w-5" />
            </button>
            {menuOpen ? <div ref={menuRef} role="menu" onKeyDown={handleMenuKeyDown} className="absolute bottom-12 right-0 z-20 w-64 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-2 shadow-2xl">
              {(story.status === "draft" || story.status === "rejected") ? (
                <>
                  <button role="menuitem" type="button" disabled={busy || !readiness.ready} onClick={() => runAction("submit")} aria-describedby={!readiness.ready ? explanationId : undefined} className="flex min-h-11 w-full cursor-pointer items-center gap-2 rounded-lg px-3 text-left text-sm font-semibold hover:bg-[var(--color-muted)] disabled:cursor-not-allowed disabled:opacity-45">
                    <Send aria-hidden="true" className="h-4 w-4" /> {story.status === "rejected" ? "Gửi lại duyệt" : "Gửi duyệt"}
                  </button>
                  {!readiness.ready ? <p id={explanationId} className="px-3 pb-2 text-xs leading-relaxed text-[var(--color-muted-foreground)]">{readiness.reasons.join(" ")}</p> : null}
                </>
              ) : null}
              {story.status === "pending_review" ? (
                <button role="menuitem" type="button" disabled={busy} onClick={() => runAction("cancel-review")} className="flex min-h-11 w-full cursor-pointer items-center gap-2 rounded-lg px-3 text-left text-sm font-semibold hover:bg-[var(--color-muted)] disabled:opacity-50">
                  <Undo2 aria-hidden="true" className="h-4 w-4" /> Hủy gửi duyệt
                </button>
              ) : null}
              {story.status === "published" ? (
                <button role="menuitem" type="button" disabled={busy} onClick={() => runAction("archive")} className="flex min-h-11 w-full cursor-pointer items-center gap-2 rounded-lg px-3 text-left text-sm font-semibold hover:bg-[var(--color-muted)] disabled:opacity-50">
                  <Archive aria-hidden="true" className="h-4 w-4" /> Gỡ truyện
                </button>
              ) : null}
              {story.status === "archived" ? (
                <button role="menuitem" type="button" disabled={busy} onClick={() => runAction("restore")} className="flex min-h-11 w-full cursor-pointer items-center gap-2 rounded-lg px-3 text-left text-sm font-semibold hover:bg-[var(--color-muted)] disabled:opacity-50">
                  <RotateCcw aria-hidden="true" className="h-4 w-4" /> Khôi phục
                </button>
              ) : null}
              {(story.status === "draft" || story.status === "archived") ? (
                <button role="menuitem" type="button" disabled={busy} onClick={() => runAction("delete")} className="flex min-h-11 w-full cursor-pointer items-center gap-2 rounded-lg px-3 text-left text-sm font-semibold text-[var(--color-destructive)] hover:bg-[var(--color-destructive)]/10 disabled:opacity-50">
                  <Trash2 aria-hidden="true" className="h-4 w-4" /> {story.status === "archived" ? "Xóa vĩnh viễn" : "Xóa truyện"}
                </button>
              ) : null}
            </div> : null}
          </div>
        </div>
      </div>
    </article>
  );
}
