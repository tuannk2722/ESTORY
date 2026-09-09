import "server-only";
import type { Prisma, PrismaClient, UserSettings } from "@/generated/prisma/client";
import { PrismaStoryRepository } from "@/lib/repositories/prisma-story-repository";
import { PrismaStoryCommandRepository } from "@/lib/repositories/prisma-story-command-repository";
import { loadRuntimePrismaClient } from "@/lib/repositories/prisma-read-client";
import { databaseJson } from "@/lib/db/json-fields";
import { readerSettingsSchema, readerStateSchema, type GuestImport, type ReaderMutation, type ReaderState } from "@/lib/reader-state/schema";
import { mergeSettings } from "@/lib/reader-state/settings";
import type { ReaderSettings } from "@/types/settings";
import { conflict, mapCommandDatabaseError, notFound } from "./command-error";

function settingsFromRow(row: UserSettings): ReaderSettings {
  return readerSettingsSchema.parse({
    effects_enabled: row.effectsEnabled, effects_by_category: databaseJson.effectsByCategory.read(row.effectsByCategory),
    intensity_multiplier: row.intensityMultiplier, reduced_motion: row.reducedMotion,
    font_size: row.fontSize, font_family: row.fontFamily, theme: row.theme,
  });
}
function settingsData(settings: ReaderSettings) {
  return {
    effectsEnabled: settings.effects_enabled, effectsByCategory: databaseJson.effectsByCategory.write(settings.effects_by_category),
    intensityMultiplier: settings.intensity_multiplier, reducedMotion: settings.reduced_motion,
    fontSize: settings.font_size, fontFamily: settings.font_family, theme: settings.theme,
  };
}
function nextRevision(previous: Date) { return new Date(Math.max(Date.now(), previous.getTime() + 1)); }

/** Personal persistence only. All Story public reads go through StoryRepository. */
export class ReaderStateService {
  constructor(private readonly clientSource: () => Promise<PrismaClient> = loadRuntimePrismaClient) {}

  private async transaction<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    const db = await this.clientSource();
    try { return await db.$transaction(work, { isolationLevel: "Serializable", maxWait: 10_000, timeout: 30_000 }); }
    catch (error) { return mapCommandDatabaseError(error); }
  }

  private async snapshot(tx: Prisma.TransactionClient, userId: string): Promise<ReaderState | null> {
    let settings = await tx.userSettings.findUnique({ where: { userId } });
    if (!settings) return null;
    const [progressRows, bookmarkRows] = await Promise.all([
      tx.readingProgress.findMany({ where: { userId }, include: { story: { select: { slug: true } } }, orderBy: { updatedAt: "desc" } }),
      tx.bookmark.findMany({ where: { userId }, include: { story: { select: { slug: true } } }, orderBy: { createdAt: "desc" } }),
    ]);
    const repository = new PrismaStoryRepository(tx);
    const stories = new Map<string, Awaited<ReturnType<typeof repository.getPublicById>>>();
    for (const slug of new Set([...progressRows, ...bookmarkRows].map((row) => row.story.slug))) {
      stories.set(slug, await repository.getPublicById(slug));
    }
    let changed = false;
    const progress: ReaderState["progress"] = [];
    for (const row of progressRows) {
      const chapter = stories.get(row.story.slug)?.chapters.find((item) => item.id === row.chapterId);
      if (!chapter?.blocks.length) {
        await tx.readingProgress.delete({ where: { id: row.id } });
        changed = true;
        continue;
      }
      const blockExists = chapter.blocks.some((block) => block.id === row.blockId);
      const blockId = blockExists ? row.blockId : chapter.blocks[0].id;
      if (!blockExists) {
        // Preserve last-read ordering when repairing content, but invalidate sync revision.
        await tx.readingProgress.update({ where: { id: row.id }, data: { blockId, status: "READING", updatedAt: row.updatedAt } });
        changed = true;
      }
      progress.push({ story_id: row.story.slug, chapter_id: row.chapterId, block_id: blockId,
        status: blockExists && row.status === "COMPLETED" ? "completed" : "reading", updated_at: row.updatedAt.toISOString() });
    }
    // Keep the independent bookmark record while hiding unavailable Story links.
    const bookmarks = bookmarkRows.filter((row) => stories.get(row.story.slug)).map((row) => ({
      user_id: userId, story_id: row.story.slug, created_at: row.createdAt.toISOString(),
    }));
    if (changed) settings = await tx.userSettings.update({ where: { userId }, data: { updatedAt: nextRevision(settings.updatedAt) } });
    return readerStateSchema.parse({ userId, settings: settingsFromRow(settings), progress, bookmarks, updatedAt: settings.updatedAt.toISOString() });
  }

  read(userId: string) { return this.transaction((tx) => this.snapshot(tx, userId)); }

  bootstrap(userId: string, guest: GuestImport) {
    return this.transaction(async (tx) => {
      if (!await tx.userSettings.findUnique({ where: { userId } })) {
        await tx.userSettings.create({ data: { userId, ...settingsData(guest.settings) } });
        const repository = new PrismaStoryCommandRepository(tx);
        for (const slug of new Set([...guest.progress, ...guest.bookmarks].map((item) => item.story_id))) {
          const story = await repository.getPublicById(slug);
          if (!story) continue;
          const record = await repository.getAccessRecord(slug) ?? notFound();
          const bookmark = guest.bookmarks.find((item) => item.story_id === slug);
          if (bookmark) await tx.bookmark.createMany({ data: [{ userId, storyId: record.id, createdAt: new Date(bookmark.created_at) }], skipDuplicates: true });
          const progress = guest.progress.filter((item) => item.story_id === slug).sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0];
          const chapter = story.chapters.find((item) => item.id === progress?.chapter_id);
          if (progress && chapter?.blocks.length) {
            const validBlock = chapter.blocks.some((block) => block.id === progress.block_id);
            const blockId = validBlock ? progress.block_id : chapter.blocks[0].id;
            const completed = validBlock && progress.status === "completed" && story.chapters.at(-1)?.id === chapter.id && chapter.blocks.at(-1)?.id === blockId;
            await tx.readingProgress.createMany({ data: [{ userId, storyId: record.id, chapterId: chapter.id, blockId,
              status: completed ? "COMPLETED" : "READING", updatedAt: new Date(progress.updated_at) }], skipDuplicates: true });
          }
        }
      }
      return (await this.snapshot(tx, userId))!;
    });
  }

  mutate(userId: string, input: ReaderMutation) {
    return this.transaction(async (tx) => {
      const settings = await tx.userSettings.findUnique({ where: { userId } });
      if (!settings || settings.updatedAt.toISOString() !== input.expectedUpdatedAt) conflict();
      const revision = nextRevision(settings.updatedAt);
      const updated = await tx.userSettings.updateMany({ where: { userId, updatedAt: settings.updatedAt }, data: { updatedAt: revision } });
      if (updated.count !== 1) conflict();
      const operation = input.operation;
      if (operation.kind === "settings") {
        await tx.userSettings.update({ where: { userId }, data: { ...settingsData(mergeSettings(settingsFromRow(settings), operation.patch)), updatedAt: revision } });
      } else {
        const slug = operation.kind === "bookmark" ? operation.storyId : operation.progress.story_id;
        const repository = new PrismaStoryCommandRepository(tx);
        const record = await repository.getAccessRecord(slug);
        if (!record) notFound();
        if (operation.kind === "bookmark" && !operation.saved) {
          await tx.bookmark.deleteMany({ where: { userId, storyId: record.id } });
        } else {
          const story = await repository.getPublicById(slug);
          if (!story) notFound();
          if (operation.kind === "bookmark") {
            await tx.bookmark.createMany({ data: [{ userId, storyId: record.id }], skipDuplicates: true });
          } else {
            const chapter = story.chapters.find((item) => item.id === operation.progress.chapter_id);
            if (!chapter?.blocks.some((block) => block.id === operation.progress.block_id)) notFound();
            const completed = operation.progress.status === "completed" && story.chapters.at(-1)?.id === chapter.id && chapter.blocks.at(-1)?.id === operation.progress.block_id;
            const data = { chapterId: chapter.id, blockId: operation.progress.block_id, status: completed ? "COMPLETED" as const : "READING" as const, updatedAt: revision };
            await tx.readingProgress.upsert({ where: { userId_storyId: { userId, storyId: record.id } }, create: { userId, storyId: record.id, ...data }, update: data });
          }
        }
      }
      return (await this.snapshot(tx, userId))!;
    });
  }
}
