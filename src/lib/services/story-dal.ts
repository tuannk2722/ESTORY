import "server-only";
import { z } from "zod";
import { AuthAccessError, hasMinimumRole } from "@/lib/auth/policy";
import { idSchema, validateCommand } from "@/lib/validation/story-command-schema";
import { authorizeStory, StoryCommandTransactions } from "./story-command-context";
import { notFound } from "./command-error";
import type { AuthorStoryListItem, ManagedStoryData } from "@/types/story-management";

/** Authorized full reads and revision share one consistent database snapshot. */
export class StoryDataAccess {
  constructor(private readonly transactions = new StoryCommandTransactions()) {}
  authorize(actorId: string, storyId: string, chapterId?: string) {
    return this.transactions.transaction(async (repository) => {
      await authorizeStory(repository, actorId, storyId, chapterId);
    });
  }
  getStory(actorId: string, storyId: string) {
    validateCommand(z.strictObject({ actorId: idSchema, storyId: idSchema }), { actorId, storyId });
    return this.transactions.transaction(async (repository) => {
      const { story } = await authorizeStory(repository, actorId, storyId);
      return { data: await repository.getById(storyId) ?? notFound(), meta: { updatedAt: story.updatedAt.toISOString() } };
    });
  }
  getManagedStory(actorId: string, storyId: string) {
    validateCommand(z.strictObject({ actorId: idSchema, storyId: idSchema }), { actorId, storyId });
    return this.transactions.transaction(async (repository) => {
      const { story: access } = await authorizeStory(repository, actorId, storyId);
      const record = await repository.getStoryManagementRecord(storyId);
      if (!record || record.story.id !== storyId) notFound();
      const data: ManagedStoryData = {
        story: record.story,
        rejectionReason: record.rejectionReason,
      };
      return { data, meta: { updatedAt: access.updatedAt.toISOString() } };
    });
  }
  getStoriesForAuthor(actorId: string): Promise<AuthorStoryListItem[]> {
    validateCommand(z.strictObject({ actorId: idSchema }), { actorId });
    return this.transactions.transaction(async (repository) => {
      const actor = await repository.getActor(actorId);
      if (!hasMinimumRole(actor.role, "author")) throw new AuthAccessError(403);
      // Keep ownership centralized in the established repository boundary.
      const records = await repository.getStoryManagementRecordsForAuthor(actor.id);
      return records.map((record) => ({
        story: record.story,
        rejectionReason: record.rejectionReason,
        updatedAt: record.updatedAt.toISOString(),
      }));
    });
  }
  getEditor(actorId: string, storyId: string, chapterId: string) {
    validateCommand(z.strictObject({ actorId: idSchema, storyId: idSchema, chapterId: idSchema }), { actorId, storyId, chapterId });
    return this.transactions.transaction(async (repository) => {
      const { story } = await authorizeStory(repository, actorId, storyId, chapterId);
      const chapter = await repository.getChapter(storyId, chapterId);
      const scenes = await repository.getScenes(storyId, chapterId);
      return { data: { chapter, scenes }, meta: { updatedAt: story.updatedAt.toISOString() } };
    });
  }
}
