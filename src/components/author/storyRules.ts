import type { Story, StoryStatus } from "@/types/story";
import type { ManagedChapter, ManagedStory } from "@/types/story-management";
import type {
  ChapterFieldErrors,
  StoryFieldErrors,
  StoryFormValue,
  WizardChapter,
} from "./types";

export function validateStoryForm(
  value: StoryFormValue,
  options: { requireByline: boolean; hasExistingCover: boolean },
): StoryFieldErrors {
  const errors: StoryFieldErrors = {};
  if (!value.title.trim()) errors.title = "Vui lòng nhập tên truyện.";
  if (options.requireByline && !value.byline.trim()) {
    errors.byline = "Vui lòng nhập tên tác giả / bút danh hiển thị.";
  }
  if (!value.description.trim()) errors.description = "Vui lòng nhập mô tả truyện.";
  if (value.genre.length === 0) errors.genre = "Vui lòng thêm ít nhất một thể loại.";
  if (value.coverError) errors.cover = value.coverError;
  else if (!value.coverFile && !options.hasExistingCover) errors.cover = "Vui lòng chọn ảnh bìa.";
  return errors;
}

export function validateWizardChapters(chapters: WizardChapter[]): ChapterFieldErrors {
  if (chapters.length === 0) return { chapters: "Mỗi truyện cần ít nhất một chương." };
  return Object.fromEntries(
    chapters.flatMap((chapter) => chapter.title.trim()
      ? []
      : [[chapter.clientId, "Vui lòng nhập tên chương."]]),
  );
}

export type SubmitReadinessStory =
  | Pick<Story, "id" | "title" | "author" | "description" | "cover_image" | "genre" | "status" | "chapters">
  | Pick<ManagedStory, "id" | "title" | "author" | "description" | "cover_image" | "genre" | "status" | "chapters">;

function chapterHasContent(chapter: Story["chapters"][number] | ManagedChapter): boolean {
  return "blockCount" in chapter ? chapter.blockCount > 0 : chapter.blocks.length > 0;
}

export function submitReadiness(story: SubmitReadinessStory): { ready: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (!story.title.trim() || !story.description.trim() || !story.author.trim()
      || !story.cover_image || story.genre.length === 0) {
    reasons.push("Hoàn thiện tên truyện, mô tả, ảnh bìa, thể loại và bút danh.");
  }
  if (story.chapters.length === 0) reasons.push("Thêm ít nhất một chương.");
  if (!story.chapters.some(chapterHasContent)) {
    reasons.push("Viết nội dung cho ít nhất một chương.");
  }
  return { ready: reasons.length === 0, reasons };
}

export function isStoryMutable(story: { status: StoryStatus }): boolean {
  return story.status !== "pending_review" && story.status !== "archived";
}
