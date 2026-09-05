import type { Chapter } from "@/types/story";
import type { ChapterCommandContext, StoryCommandContext } from "./story-command-service";

export interface CreateChapterCommand extends StoryCommandContext { title: string }
export interface UpdateChapterMetadataCommand extends ChapterCommandContext { title: string }
export interface ReorderChaptersCommand extends StoryCommandContext { chapterIds: string[] }
export type DeleteChapterCommand = ChapterCommandContext;

export interface ChapterCommandService {
  createChapter(input: CreateChapterCommand): Promise<Chapter>;
  updateChapterMetadata(input: UpdateChapterMetadataCommand): Promise<Chapter>;
  reorderChapters(input: ReorderChaptersCommand): Promise<Chapter[]>;
  deleteChapter(input: DeleteChapterCommand): Promise<void>;
}
