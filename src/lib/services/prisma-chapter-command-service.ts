import "server-only";
import type { ChapterCommandService, CreateChapterCommand, UpdateChapterMetadataCommand, ReorderChaptersCommand, DeleteChapterCommand } from "./chapter-command-service";
import type { SetChapterPublicationCommand } from "./story-command-service";
import { StoryCommandTransactions } from "./story-command-context";
import { chapterSchema, managedChapterSchema, createChapterSchema, updateChapterSchema, reorderChaptersSchema, chapterContextSchema, publishChapterSchema, validateCommand } from "@/lib/validation/story-command-schema";
import { CommandError, conflict, notFound } from "./command-error";

export class PrismaChapterCommandService implements ChapterCommandService {
  constructor(private readonly transactions = new StoryCommandTransactions()) {}

  async createChapter(command: CreateChapterCommand) {
    const input = validateCommand(createChapterSchema, command);
    return this.transactions.mutate(input, true, async ({ repository, story }) => {
      const chapters = await repository.listChapters(story.id);
      const chapterIds = chapters.map((chapter) => chapter.id);
      const anchorIndex = input.afterChapterId === undefined
        ? chapterIds.length - 1
        : chapterIds.indexOf(input.afterChapterId);
      if (input.afterChapterId !== undefined && anchorIndex < 0) notFound();

      const created = await repository.createChapter(story.id, input.title, chapters.length + 1);
      const nextChapterIds = [...chapterIds];
      nextChapterIds.splice(anchorIndex + 1, 0, created.id);
      // Create + placement are one Story-scoped transaction and also normalize legacy gaps.
      await repository.reorderChapters(nextChapterIds);
      return managedChapterSchema.parse(
        await repository.getChapterManagementSummary(story.id, created.id) ?? notFound(),
      );
    });
  }
  async updateChapterMetadata(command: UpdateChapterMetadataCommand) {
    const input = validateCommand(updateChapterSchema, command);
    return this.transactions.mutate(input, true, async ({ repository, story }) => {
      await repository.renameChapter(input.chapterId, input.title);
      return managedChapterSchema.parse(
        await repository.getChapterManagementSummary(story.id, input.chapterId) ?? notFound(),
      );
    });
  }
  async reorderChapters(command: ReorderChaptersCommand) {
    const input = validateCommand(reorderChaptersSchema, command);
    return this.transactions.mutate(input, true, async ({ repository, story }) => {
      const chapters = await repository.listChapters(story.id);
      if (new Set(input.chapterIds).size !== input.chapterIds.length) {
        throw new CommandError(400, "VALIDATION_ERROR", "Chapter IDs must be unique");
      }
      const existingIds = new Set(chapters.map((chapter) => chapter.id));
      if (input.chapterIds.some((id) => !existingIds.has(id))) notFound();
      if (chapters.length !== input.chapterIds.length) conflict("CHAPTER_SET_CHANGED", "Reorder must include every chapter exactly once.");
      await repository.reorderChapters(input.chapterIds);
      return input.chapterIds.map((id, index) => ({ id, order: index + 1 }));
    });
  }
  async deleteChapter(command: DeleteChapterCommand) {
    const input = validateCommand(chapterContextSchema, command);
    return this.transactions.mutate(input, true, async ({ repository, story }) => {
      const chapters = await repository.listChapters(story.id);
      if (chapters.length <= 1) conflict("LAST_CHAPTER", "A story must retain at least one chapter.");
      const remaining = chapters.filter((chapter) => chapter.id !== input.chapterId);
      if (story.status === "PUBLISHED" && !remaining.some((chapter) => chapter.status === "PUBLISHED")) {
        conflict("LAST_PUBLISHED_CHAPTER", "A public story must retain a published chapter.");
      }
      await repository.deleteChapter(input.chapterId);
      await repository.reorderChapters(remaining.map((chapter) => chapter.id));
      return null;
    });
  }
  async setChapterPublication(command: SetChapterPublicationCommand) {
    const input = validateCommand(publishChapterSchema, command);
    return this.transactions.mutate(input, true, async ({ repository, story }) => {
      if (story.status === "PUBLISHED" && input.status === "draft") {
        const chapters = await repository.listChapters(story.id);
        if (!chapters.some((chapter) => chapter.id !== input.chapterId && chapter.status === "PUBLISHED")) {
          conflict("LAST_PUBLISHED_CHAPTER", "A public story must retain a published chapter.");
        }
      }
      await repository.publishChapter(input.chapterId, input.status);
      // Keep the existing full-content validation before a chapter can become public.
      chapterSchema.parse(await repository.getChapter(story.slug, input.chapterId));
      return managedChapterSchema.parse(
        await repository.getChapterManagementSummary(story.id, input.chapterId) ?? notFound(),
      );
    });
  }
}
