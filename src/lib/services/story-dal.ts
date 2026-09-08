import "server-only";
import { z } from "zod";
import { idSchema, validateCommand } from "@/lib/validation/story-command-schema";
import { authorizeStory, StoryCommandTransactions } from "./story-command-context";
import { notFound } from "./command-error";

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
