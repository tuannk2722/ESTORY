import type { ReactNode } from "react";
import { ArrowRight, BookOpen, User } from "lucide-react";
import { coverObjectPosition } from "@/lib/story-cover";
import type { Story } from "@/types/story";
import StoryCoverImage from "./StoryCoverImage";

export type StoryCardVisualStory = Pick<
  Story,
  "title" | "author" | "description" | "genre" | "cover_image" | "cover_position"
>;

export interface StoryCardVisualProps {
  story: StoryCardVisualStory;
  sizes: string;
  interactive?: boolean;
  fillHeight?: boolean;
  navigationOverlay?: ReactNode;
  mediaAction?: ReactNode;
  ariaHidden?: boolean;
}

const MAX_VISIBLE_GENRES = 3;

/** Shared visual surface; callers own any navigation or media actions. */
export default function StoryCardVisual({
  story,
  sizes,
  interactive = false,
  fillHeight = false,
  navigationOverlay,
  mediaAction,
  ariaHidden = false,
}: StoryCardVisualProps) {
  const visibleGenres = story.genre.slice(0, MAX_VISIBLE_GENRES);
  const hiddenCount = story.genre.length - MAX_VISIBLE_GENRES;

  return (
    <article
      aria-hidden={ariaHidden || undefined}
      data-story-card-visual
      className={`glass-card story-card relative flex w-full flex-col overflow-hidden rounded-2xl border border-[var(--color-border)] shadow-[var(--shadow-story-card)] ${fillHeight ? "h-full" : ""} ${interactive ? "group/story-card cursor-pointer transition-[border-color,box-shadow] duration-200 hover:border-[var(--color-primary)]/55 hover:shadow-[var(--shadow-story-card-hover)] motion-reduce:transition-none" : ""}`}
    >
      {navigationOverlay}

      <div className="relative aspect-video w-full shrink-0 overflow-hidden bg-gradient-to-br from-[var(--color-secondary)] via-[var(--color-card)] to-[var(--color-primary)]/35">
        {story.cover_image ? (
          <StoryCoverImage
            src={story.cover_image}
            alt={`Ảnh bìa ${story.title}`}
            className="object-cover transition-[filter] duration-300 group-hover/story-card:brightness-105 motion-reduce:transition-none"
            objectPosition={coverObjectPosition(story.cover_position)}
            sizes={sizes}
          />
        ) : (
          <>
            <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-[var(--color-primary)]/20 blur-3xl transition-colors duration-700 group-hover/story-card:bg-[var(--color-accent)]/25 motion-reduce:transition-none" />
            <div className="absolute -left-8 bottom-8 h-24 w-24 rounded-full bg-[var(--color-accent)]/10 blur-2xl transition-colors duration-700 group-hover/story-card:bg-[var(--color-primary)]/20 motion-reduce:transition-none" />
            <BookOpen
              aria-hidden="true"
              className="absolute left-1/2 top-1/2 h-12 w-12 -translate-x-1/2 -translate-y-1/2 text-[var(--color-muted-foreground)]/55"
            />
          </>
        )}

        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/5 to-black/25"
        />

        {mediaAction}

        {visibleGenres.length > 0 ? (
          <div className="pointer-events-none absolute bottom-3 left-3 z-10 flex flex-wrap items-center gap-1.5">
            {visibleGenres.map((genre) => (
              <span
                key={genre}
                className="rounded-full border border-white/15 bg-black/40 px-2.5 py-0.5 font-ui text-[11px] font-medium tracking-wide text-white/85 backdrop-blur-sm"
              >
                {genre}
              </span>
            ))}
            {hiddenCount > 0 ? (
              <span className="rounded-full border border-white/10 bg-black/30 px-2 py-0.5 font-ui text-[11px] text-white/50 backdrop-blur-sm">
                +{hiddenCount}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col px-4 pb-4 pt-3.5">
        <h3 className="line-clamp-2 font-display text-lg font-bold leading-snug text-[var(--color-card-foreground)] transition-colors duration-200 group-hover/story-card:text-[var(--color-primary)] motion-reduce:transition-none">
          {story.title}
        </h3>

        <p className="mt-1.5 flex items-center gap-1.5 font-ui text-xs text-[var(--color-muted-foreground)]">
          <User aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{story.author}</span>
        </p>

        <p className="mt-2 line-clamp-2 font-story text-sm leading-relaxed text-[var(--color-card-foreground)]/75">
          {story.description}
        </p>

        <div className="mt-auto flex items-center justify-between border-t border-[var(--color-border)] pt-3 font-ui text-sm font-semibold text-[var(--color-primary)]">
          <span>Đọc truyện</span>
          <ArrowRight
            aria-hidden="true"
            className="h-4 w-4 transition-transform duration-200 group-hover/story-card:translate-x-1 motion-reduce:transition-none motion-reduce:group-hover/story-card:transform-none"
          />
        </div>
      </div>
    </article>
  );
}
