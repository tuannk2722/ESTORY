import { Bookmark } from "lucide-react";
import StoryCardVisual from "@/components/story/StoryCardVisual";
import { buildStoryCardPreviewStory } from "./storyPreview";
import type { StoryFormValue } from "./types";

interface LiveStoryCardPreviewProps {
  value: StoryFormValue;
  currentCoverUrl?: string;
  className?: string;
  headingLevel?: "h2" | "h3";
}

export default function LiveStoryCardPreview({
  value,
  currentCoverUrl,
  className = "",
  headingLevel = "h2",
}: LiveStoryCardPreviewProps) {
  const previewStory = buildStoryCardPreviewStory(value, currentCoverUrl);
  const Heading = headingLevel;

  return (
    <aside
      aria-labelledby="live-story-card-preview-title"
      data-live-story-card-preview
      className={`mx-auto w-full max-w-[22rem] rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]/55 p-4 shadow-[var(--shadow-story-card)] ${className}`}
    >
      <div className="mb-4 flex items-start min-w-0">
        <Heading id="live-story-card-preview-title" className="font-ui text-sm font-bold text-[var(--color-foreground)]">
          Xem trước
        </Heading>
      </div>

      <StoryCardVisual
        story={previewStory}
        sizes="(max-width: 639px) calc(100vw - 4rem), 352px"
        ariaHidden
        mediaAction={(
          <span className="pointer-events-none absolute right-3 top-3 z-20 flex min-h-11 min-w-11 items-center justify-center rounded-full border border-white/25 bg-black/45 text-white/80 backdrop-blur-md">
            <Bookmark aria-hidden="true" className="h-4 w-4" />
          </span>
        )}
      />
    </aside>
  );
}
