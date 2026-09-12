import type { ChapterOrder, ManagedChapter } from "@/types/story-management";
import type { ChapterCommandContext, StoryCommandContext, CommandResult } from "./story-command-service";

export interface CreateChapterCommand extends StoryCommandContext { title: string; afterChapterId?: string }
export interface UpdateChapterMetadataCommand extends ChapterCommandContext { title: string }
export interface ReorderChaptersCommand extends StoryCommandContext { chapterIds: string[] }
export type DeleteChapterCommand = ChapterCommandContext;

export interface ChapterCommandService {
  createChapter(input: CreateChapterCommand): Promise<CommandResult<ManagedChapter>>;
  updateChapterMetadata(input: UpdateChapterMetadataCommand): Promise<CommandResult<ManagedChapter>>;
  reorderChapters(input: ReorderChaptersCommand): Promise<CommandResult<ChapterOrder[]>>;
  deleteChapter(input: DeleteChapterCommand): Promise<CommandResult<null>>;
}
