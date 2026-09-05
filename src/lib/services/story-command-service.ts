import type { Chapter, ChapterStatus, Story } from "@/types/story";

/** actorId is supplied by the authenticated server boundary, never trusted from HTTP input. */
export interface StoryCommandContext { actorId: string; storyId: string }
export interface ChapterCommandContext extends StoryCommandContext { chapterId: string }
export type StoryMetadata = Pick<Story, "title" | "description" | "cover_image" | "genre">;
export interface CreateStoryWithChaptersCommand {
  actorId: string;
  metadata: StoryMetadata;
  chapters: Array<Pick<Chapter, "title">>;
}
export interface UpdateStoryMetadataCommand extends StoryCommandContext { metadata: StoryMetadata }
export interface ReplaceChapterContentCommand extends ChapterCommandContext { blocks: Chapter["blocks"] }
export type SubmitStoryCommand = StoryCommandContext;
export interface SetChapterPublicationCommand extends ChapterCommandContext { status: ChapterStatus }

// Contracts only. P3-06 supplies authorization, validation and transactional implementations.
export interface StoryCommandService {
  createStoryWithChapters(input: CreateStoryWithChaptersCommand): Promise<Story>;
  updateStoryMetadata(input: UpdateStoryMetadataCommand): Promise<Story>;
  replaceChapterContent(input: ReplaceChapterContentCommand): Promise<Chapter>;
  submitForReview(input: SubmitStoryCommand): Promise<Story>;
  setChapterPublication(input: SetChapterPublicationCommand): Promise<Chapter>;
}
