import "server-only";
import type { CreateStoryWithChaptersCommand, UpdateStoryMetadataCommand, StoryCommandContext, StoryCommandService, ReplaceChapterContentCommand, SetChapterPublicationCommand } from "./story-command-service";
import { createStorySchema, managedStorySchema, updateStorySchema, storyContextSchema, storyReadyMetadataSchema, storySchema, validateCommand, resolveStoryByline } from "@/lib/validation/story-command-schema";
import { StoryCommandTransactions } from "./story-command-context";
import { PrismaChapterCommandService } from "./prisma-chapter-command-service";
import { PrismaSceneCommandService } from "./prisma-scene-command-service";
import { conflict, notFound } from "./command-error";
import { DEFAULT_COVER_POSITION } from "@/lib/story-cover";

export class PrismaStoryCommandService implements StoryCommandService {
  constructor(private readonly transactions = new StoryCommandTransactions()) {}

  async createStoryWithChapters(command: CreateStoryWithChaptersCommand) {
    const input = validateCommand(createStorySchema, command);
    return this.transactions.transaction(async (repository) => {
      const actor = await repository.getActor(input.actorId);
      const byline = resolveStoryByline(input.byline, actor.name);
      const coverUrl = await repository.claimStoryCover(actor.id, input.coverUploadId, new Date());
      const created = await repository.createStory(actor, input.metadata, coverUrl, byline, input.chapters);
      return {
        data: storySchema.parse(await repository.getById(created.slug) ?? notFound()),
        meta: { updatedAt: created.updatedAt.toISOString() },
      };
    });
  }
  async updateStoryMetadata(command: UpdateStoryMetadataCommand) {
    const input = validateCommand(updateStorySchema, command);
    return this.transactions.mutate(input, true, async ({ repository, story }, updatedAt) => {
      const coverUrl = input.coverUploadId === undefined
        ? undefined
        : await repository.claimStoryCover(input.actorId, input.coverUploadId, updatedAt);
      const metadata = input.coverUploadId !== undefined && input.metadata.cover_position === undefined
        ? { ...input.metadata, cover_position: DEFAULT_COVER_POSITION }
        : input.metadata;
      await repository.updateMetadata(story.id, metadata, coverUrl, updatedAt);
      const managed = await repository.getStoryManagementRecord(story.slug) ?? notFound();
      return managedStorySchema.parse(managed.story);
    });
  }
  private async transition(command: StoryCommandContext, action: "submit" | "cancel" | "archive" | "restore") {
    const input = validateCommand(storyContextSchema, command);
    return this.transactions.mutate(input, false, async ({ repository, story }, updatedAt) => {
      const from: Record<typeof action, string[]> = {
        submit: ["DRAFT", "REJECTED"], cancel: ["PENDING_REVIEW"], archive: ["PUBLISHED"], restore: ["ARCHIVED"],
      };
      if (!from[action].includes(story.status)) conflict("INVALID_STORY_STATE", "This action is unavailable in the current story state.");
      if (action === "submit") {
        const full = await repository.getById(story.slug) ?? notFound();
        const metadata = {
          title: full.title,
          description: full.description,
          cover_image: full.cover_image,
          cover_position: full.cover_position,
          genre: full.genre,
        };
        if (!storyReadyMetadataSchema.safeParse(metadata).success || !full.author.trim() || !full.chapters.some((chapter) => chapter.blocks.length > 0)) {
          conflict("STORY_NOT_READY", "Provide complete story metadata and at least one chapter with content before submission.");
        }
      }
      await repository.setStoryState(story.id, action === "submit" ? "PENDING_REVIEW" : action === "archive" ? "ARCHIVED" : "DRAFT", updatedAt);
      const managed = await repository.getStoryManagementRecord(story.slug) ?? notFound();
      return managedStorySchema.parse(managed.story);
    });
  }
  submitForReview(command: StoryCommandContext) { return this.transition(command, "submit"); }
  cancelReview(command: StoryCommandContext) { return this.transition(command, "cancel"); }
  archiveStory(command: StoryCommandContext) { return this.transition(command, "archive"); }
  restoreStory(command: StoryCommandContext) { return this.transition(command, "restore"); }
  async deleteStory(command: StoryCommandContext) {
    const input = validateCommand(storyContextSchema, command);
    return this.transactions.mutate(input, false, async ({ repository, story }) => {
      if (!["DRAFT", "ARCHIVED"].includes(story.status)) {
        conflict("INVALID_STORY_STATE", "Only draft or archived stories can be permanently deleted.");
      }
      await repository.deleteStory(story.id);
      return null;
    });
  }
  replaceChapterContent(command: ReplaceChapterContentCommand) {
    return new PrismaSceneCommandService(this.transactions).replaceChapterContent(command);
  }
  setChapterPublication(command: SetChapterPublicationCommand) {
    return new PrismaChapterCommandService(this.transactions).setChapterPublication(command);
  }
}
