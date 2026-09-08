import "server-only";
import { z } from "zod";
import type { ChapterCommandService, CreateChapterCommand, UpdateChapterMetadataCommand, ReorderChaptersCommand, DeleteChapterCommand } from "./chapter-command-service";
import type { SetChapterPublicationCommand } from "./story-command-service";
import { StoryCommandTransactions } from "./story-command-context";
import { chapterSchema, createChapterSchema, updateChapterSchema, reorderChaptersSchema, chapterContextSchema, publishChapterSchema, validateCommand } from "@/lib/validation/story-command-schema";
import { CommandError, conflict, notFound } from "./command-error";

export class PrismaChapterCommandService implements ChapterCommandService {
  constructor(private readonly transactions = new StoryCommandTransactions()) {}

  async createChapter(command: CreateChapterCommand) {
    const input = validateCommand(createChapterSchema, command);
    return this.transactions.mutate(input, true, async ({ repository, story }) => {
      const chapters = await repository.listChapters(story.id);
      const created = await repository.createChapter(story.id, input.title, chapters.length + 1);
      // Normalize legacy/non-contiguous order when appending.
      await repository.reorderChapters([...chapters.map((chapter) => chapter.id), created.id]);
      return chapterSchema.parse(await repository.getChapter(story.slug, created.id));
    });
  }
  async updateChapterMetadata(command: UpdateChapterMetadataCommand) {
    const input = validateCommand(updateChapterSchema, command);
    return this.transactions.mutate(input, true, async ({ repository, story }) => {
      await repository.renameChapter(input.chapterId, input.title);
      return chapterSchema.parse(await repository.getChapter(story.slug, input.chapterId));
    });
  }
  async reorderChapters(command: ReorderChaptersCommand) {
    const input = validateCommand(reorderChaptersSchema, command);
    return this.transactions.mutate(input, true, async ({ repository, story }) => {
      const chapters = await repository.listChapters(story.id);
      if (new Set(input.chapterIds).size !== input.chapterIds.length) {
        throw new CommandError(400, "VALIDATION_ERROR", "Chapter IDs must be unique");
      }
      if (input.chapterIds.some((id) => !chapters.some((chapter) => chapter.id === id))) notFound();
      if (chapters.length !== input.chapterIds.length) conflict("CHAPTER_SET_CHANGED", "Reorder must include every chapter exactly once.");
      await repository.reorderChapters(input.chapterIds);
      const updated = await repository.getById(story.slug) ?? notFound();
      return z.array(chapterSchema).parse(updated.chapters);
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
      return chapterSchema.parse(await repository.getChapter(story.slug, input.chapterId));
    });
  }
}
