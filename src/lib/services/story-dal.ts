import "server-only";
import { z } from "zod";
import { AuthAccessError, hasMinimumRole } from "@/lib/auth/policy";
import { idSchema, validateCommand } from "@/lib/validation/story-command-schema";
import { authorizeStory, StoryCommandTransactions } from "./story-command-context";
import { notFound } from "./command-error";
import type { AuthorStoryListItem, ManagedStoryData } from "@/types/story-management";
import type { ModerationListQuery } from "@/types/story-moderation";
import { moderationListQuerySchema } from "@/lib/validation/story-moderation-schema";
import type { PrismaStoryCommandRepository } from "@/lib/repositories/prisma-story-command-repository";
import { EffectCatalogService } from "@/lib/effects/effect-catalog-service";

/** Authorized full reads and revision share one consistent database snapshot. */
export class StoryDataAccess {
  constructor(
    private readonly transactions = new StoryCommandTransactions(),
    private readonly effectCatalogService = new EffectCatalogService(),
  ) {}
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
      const [chapter, scenes, effectCatalog] = await Promise.all([
        repository.getChapter(storyId, chapterId),
        repository.getScenes(storyId, chapterId),
        this.effectCatalogService.getActiveCatalog(),
      ]);
      return { data: { chapter, scenes, effectCatalog }, meta: { updatedAt: story.updatedAt.toISOString() } };
    });
  }

  private requireAdmin(repository: PrismaStoryCommandRepository, actorId: string) {
    return repository.getActor(actorId).then((actor) => {
      if (actor.role !== "admin") throw new AuthAccessError(403);
      return actor;
    });
  }

  getModerationSummary(actorId: string) {
    validateCommand(z.strictObject({ actorId: idSchema }), { actorId });
    return this.transactions.transaction(async (repository) => {
      await this.requireAdmin(repository, actorId);
      return repository.getModerationSummary();
    });
  }

  listModerationStories(actorId: string, query: ModerationListQuery) {
    validateCommand(z.strictObject({ actorId: idSchema }), { actorId });
    const input = validateCommand(moderationListQuerySchema, query);
    return this.transactions.transaction(async (repository) => {
      await this.requireAdmin(repository, actorId);
      return repository.listModerationStories(input);
    });
  }

  getModerationDetail(actorId: string, storyId: string) {
    validateCommand(z.strictObject({ actorId: idSchema, storyId: idSchema }), { actorId, storyId });
    return this.transactions.transaction(async (repository) => {
      await this.requireAdmin(repository, actorId);
      const record = await repository.getModerationDetailRecord(storyId);
      if (!record) notFound();
      return {
        data: record.detail,
        meta: { updatedAt: record.updatedAt.toISOString() },
      };
    });
  }

  getModerationPreview(actorId: string, storyId: string, chapterId: string) {
    validateCommand(
      z.strictObject({ actorId: idSchema, storyId: idSchema, chapterId: idSchema }),
      { actorId, storyId, chapterId },
    );
    return this.transactions.transaction(async (repository) => {
      await this.requireAdmin(repository, actorId);
      const access = await repository.getAccessRecord(storyId);
      if (!access) notFound();
      const preview = await repository.getModerationPreviewRecord(storyId, chapterId);
      if (!preview) notFound();
      return { data: preview, meta: { updatedAt: access.updatedAt.toISOString() } };
    });
  }
}
