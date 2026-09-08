import type { Chapter } from "@/types/story";
import type { ChapterCommandContext, StoryCommandContext, CommandResult } from "./story-command-service";

export interface CreateChapterCommand extends StoryCommandContext { title: string }
export interface UpdateChapterMetadataCommand extends ChapterCommandContext { title: string }
export interface ReorderChaptersCommand extends StoryCommandContext { chapterIds: string[] }
export type DeleteChapterCommand = ChapterCommandContext;

export interface ChapterCommandService {
  createChapter(input: CreateChapterCommand): Promise<CommandResult<Chapter>>;
  updateChapterMetadata(input: UpdateChapterMetadataCommand): Promise<CommandResult<Chapter>>;
  reorderChapters(input: ReorderChaptersCommand): Promise<CommandResult<Chapter[]>>;
  deleteChapter(input: DeleteChapterCommand): Promise<CommandResult<null>>;
}
