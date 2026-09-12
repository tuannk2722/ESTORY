import type { StoryCardVisualStory } from "@/components/story/StoryCardVisual";
import { normalizeCoverPosition } from "@/lib/story-cover";
import type { StoryFormValue } from "./types";

export const STORY_CARD_PREVIEW_PLACEHOLDERS = Object.freeze({
  title: "Tên truyện của bạn",
  author: "Bút danh của bạn",
  description: "Mô tả ngắn về câu chuyện sẽ xuất hiện ở đây.",
});

/** Projects the controlled author form into the same data shape as a public card. */
export function buildStoryCardPreviewStory(
  value: StoryFormValue,
  currentCoverUrl?: string,
): StoryCardVisualStory {
  return {
    title: value.title.trim() || STORY_CARD_PREVIEW_PLACEHOLDERS.title,
    author: value.byline.trim() || STORY_CARD_PREVIEW_PLACEHOLDERS.author,
    description: value.description.trim() || STORY_CARD_PREVIEW_PLACEHOLDERS.description,
    genre: value.genre,
    cover_image: value.coverPreviewUrl ?? currentCoverUrl,
    cover_position: normalizeCoverPosition(value.coverPosition),
  };
}
