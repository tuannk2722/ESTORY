import type { Chapter, ChapterStatus, Story } from "@/types/story";
import type { ManagedChapter, ManagedStory } from "@/types/story-management";

/** actorId is supplied by the authenticated server boundary, never trusted from HTTP input. */
export interface CommandResult<T> { data: T; meta: { updatedAt: string } }
export interface StoryCommandContext { actorId: string; storyId: string; expectedUpdatedAt: string }
export interface ChapterCommandContext extends StoryCommandContext { chapterId: string }
/** Cover URLs are resolved only from a claimed MediaUpload inside the command transaction. */
export type StoryMetadata = Pick<Story, "title" | "description" | "genre" | "cover_position">;
export interface CreateStoryWithChaptersCommand {
  actorId: string;
  /**
   * Trim; fall back to the actor's DB User.name when blank/omitted. Reject if both are blank.
   * Persist the resolved snapshot as Story.authorDisplayName; never fall back to email.
   */
  byline?: string;
  coverUploadId: string;
  metadata: StoryMetadata;
  chapters: Array<Pick<Chapter, "title">>;
}
export interface UpdateStoryMetadataCommand extends StoryCommandContext {
  /** Omit to preserve the existing cover. A URL is never accepted from the caller. */
  coverUploadId?: string;
  metadata: StoryMetadata;
}
export interface ReplaceChapterContentCommand extends ChapterCommandContext { blocks: Chapter["blocks"] }
export type SubmitStoryCommand = StoryCommandContext;
export interface SetChapterPublicationCommand extends ChapterCommandContext { status: ChapterStatus }

// Each result carries the aggregate revision committed with this command.
export interface StoryCommandService {
  createStoryWithChapters(input: CreateStoryWithChaptersCommand): Promise<CommandResult<Story>>;
  updateStoryMetadata(input: UpdateStoryMetadataCommand): Promise<CommandResult<ManagedStory>>;
  replaceChapterContent(input: ReplaceChapterContentCommand): Promise<CommandResult<Chapter>>;
  submitForReview(input: SubmitStoryCommand): Promise<CommandResult<ManagedStory>>;
  cancelReview(input: StoryCommandContext): Promise<CommandResult<ManagedStory>>;
  archiveStory(input: StoryCommandContext): Promise<CommandResult<ManagedStory>>;
  restoreStory(input: StoryCommandContext): Promise<CommandResult<ManagedStory>>;
  deleteStory(input: StoryCommandContext): Promise<CommandResult<null>>;
  setChapterPublication(input: SetChapterPublicationCommand): Promise<CommandResult<ManagedChapter>>;
}
