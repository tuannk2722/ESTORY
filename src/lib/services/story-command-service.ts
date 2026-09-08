import type { Chapter, ChapterStatus, Story } from "@/types/story";

/** actorId is supplied by the authenticated server boundary, never trusted from HTTP input. */
export interface CommandResult<T> { data: T; meta: { updatedAt: string } }
export interface StoryCommandContext { actorId: string; storyId: string; expectedUpdatedAt: string }
export interface ChapterCommandContext extends StoryCommandContext { chapterId: string }
export type StoryMetadata = Pick<Story, "title" | "description" | "cover_image" | "genre">;
export interface CreateStoryWithChaptersCommand {
  actorId: string;
  /**
   * Trim; fall back to the actor's DB User.name when blank/omitted. Reject if both are blank.
   * Persist the resolved snapshot as Story.authorDisplayName; never fall back to email.
   */
  byline?: string;
  metadata: StoryMetadata;
  chapters: Array<Pick<Chapter, "title">>;
}
export interface UpdateStoryMetadataCommand extends StoryCommandContext { metadata: StoryMetadata }
export interface ReplaceChapterContentCommand extends ChapterCommandContext { blocks: Chapter["blocks"] }
export type SubmitStoryCommand = StoryCommandContext;
export interface SetChapterPublicationCommand extends ChapterCommandContext { status: ChapterStatus }

// Each result carries the aggregate revision committed with this command.
export interface StoryCommandService {
  createStoryWithChapters(input: CreateStoryWithChaptersCommand): Promise<CommandResult<Story>>;
  updateStoryMetadata(input: UpdateStoryMetadataCommand): Promise<CommandResult<Story>>;
  replaceChapterContent(input: ReplaceChapterContentCommand): Promise<CommandResult<Chapter>>;
  submitForReview(input: SubmitStoryCommand): Promise<CommandResult<Story>>;
  cancelReview(input: StoryCommandContext): Promise<CommandResult<Story>>;
  archiveStory(input: StoryCommandContext): Promise<CommandResult<Story>>;
  restoreStory(input: StoryCommandContext): Promise<CommandResult<Story>>;
  setChapterPublication(input: SetChapterPublicationCommand): Promise<CommandResult<Chapter>>;
}
