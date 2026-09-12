import "server-only";
import { randomUUID } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import type { Chapter, EffectConfig, StoryBlock } from "@/types/story";
import type { ManagedChapter, ManagedStory } from "@/types/story-management";
import type { Scene } from "@/types/scene";
import type { StoryActor, StoryAccessRecord } from "@/lib/auth/story-policy";
import { AuthAccessError } from "@/lib/auth/policy";
import { conflict, notFound } from "@/lib/services/command-error";
import type { StoryMetadata } from "@/lib/services/story-command-service";
import { databaseJson } from "@/lib/db/json-fields";
import { completedMediaUploadSchema } from "@/lib/validation/media-upload-schema";
import { normalizeCoverPosition } from "@/lib/story-cover";
import { consoleRepositoryReadObserver, failRepositoryRead } from "./read-observability";
import { PrismaStoryRepository } from "./prisma-story-repository";
import { PrismaSceneRepository } from "./prisma-scene-repository";

const managedChapterSelect = {
  id: true,
  title: true,
  order: true,
  status: true,
  blocks: {
    select: { _count: { select: { effects: true } } },
  },
} satisfies Prisma.ChapterSelect;

const managedStorySelect = {
  slug: true,
  title: true,
  authorDisplayName: true,
  description: true,
  coverUrl: true,
  coverPositionX: true,
  coverPositionY: true,
  genre: true,
  status: true,
  rejectionReason: true,
  updatedAt: true,
  chapters: {
    orderBy: [{ order: "asc" as const }, { id: "asc" as const }],
    select: managedChapterSelect,
  },
} satisfies Prisma.StorySelect;

type ManagedChapterRow = Prisma.ChapterGetPayload<{ select: typeof managedChapterSelect }>;
type ManagedStoryRow = Prisma.StoryGetPayload<{ select: typeof managedStorySelect }>;

const storyStatuses: Record<string, ManagedStory["status"]> = {
  DRAFT: "draft",
  PENDING_REVIEW: "pending_review",
  PUBLISHED: "published",
  REJECTED: "rejected",
  ARCHIVED: "archived",
};

const chapterStatuses: Record<string, ManagedChapter["status"]> = {
  DRAFT: "draft",
  PUBLISHED: "published",
};

function invalidManagementRead(code: string): never {
  return failRepositoryRead(consoleRepositoryReadObserver, code);
}

function mapManagedChapter(row: ManagedChapterRow): ManagedChapter {
  const status = chapterStatuses[row.status]
    ?? invalidManagementRead("P3_PRISMA_INVALID_MANAGED_CHAPTER_STATUS");
  const effectCount = row.blocks.reduce((count, block) => count + block._count.effects, 0);
  if (!row.id.trim() || !Number.isInteger(row.order) || row.order < 0 || effectCount < 0) {
    return invalidManagementRead("P3_PRISMA_INVALID_MANAGED_CHAPTER");
  }
  return {
    id: row.id,
    title: row.title,
    order: row.order,
    status,
    blockCount: row.blocks.length,
    effectCount,
  };
}

function mapManagedStoryRecord(row: ManagedStoryRow) {
  const status = storyStatuses[row.status]
    ?? invalidManagementRead("P3_PRISMA_INVALID_MANAGED_STORY_STATUS");
  if (
    !row.slug.trim()
    || !row.authorDisplayName.trim()
    || !Array.isArray(row.genre)
    || !Number.isFinite(row.coverPositionX)
    || !Number.isFinite(row.coverPositionY)
    || row.coverPositionX < 0
    || row.coverPositionX > 100
    || row.coverPositionY < 0
    || row.coverPositionY > 100
  ) {
    return invalidManagementRead("P3_PRISMA_INVALID_MANAGED_STORY");
  }
  const story: ManagedStory = {
    id: row.slug,
    title: row.title,
    author: row.authorDisplayName,
    description: row.description,
    ...(row.coverUrl === null ? {} : { cover_image: row.coverUrl }),
    ...(row.coverPositionX === 50 && row.coverPositionY === 50
      ? {}
      : { cover_position: { x: row.coverPositionX, y: row.coverPositionY } }),
    genre: [...row.genre],
    status,
    chapters: row.chapters.map(mapManagedChapter),
  };
  return {
    story,
    rejectionReason: row.rejectionReason,
    updatedAt: row.updatedAt,
  };
}

/** Transaction-scoped extension of StoryRepository; all content persistence stays here. */
export class PrismaStoryCommandRepository extends PrismaStoryRepository {
  constructor(private readonly tx: Prisma.TransactionClient) { super(tx); }

  async getActor(actorId: string): Promise<StoryActor> {
    const user = await this.tx.user.findUnique({ where: { id: actorId }, select: { id: true, role: true, name: true } });
    if (!user) throw new AuthAccessError(401);
    const roles = { READER: "reader", AUTHOR: "author", ADMIN: "admin" } as const;
    return { id: user.id, name: user.name, role: roles[user.role] };
  }
  getAccessRecord(slug: string) {
    return this.tx.story.findUnique({ where: { slug }, select: { id: true, slug: true, authorId: true, status: true, updatedAt: true } });
  }
  getChapterRecord(id: string, storyId: string) {
    return this.tx.chapter.findFirst({ where: { id, storyId }, select: { id: true, storyId: true, status: true, order: true } });
  }
  listChapters(storyId: string) {
    return this.tx.chapter.findMany({ where: { storyId }, orderBy: [{ order: "asc" }, { id: "asc" }], select: { id: true, status: true } });
  }
  getScenes(slug: string, chapterId: string) {
    return new PrismaSceneRepository(this.tx).getByChapter(slug, chapterId);
  }
  async getStoryManagementRecord(slug: string) {
    if (!slug.trim()) return null;
    const row = await this.tx.story.findUnique({ where: { slug }, select: managedStorySelect });
    return row ? mapManagedStoryRecord(row) : null;
  }
  async getStoryManagementRecordsForAuthor(authorId: string) {
    if (!authorId.trim()) return [];
    const rows = await this.tx.story.findMany({
      where: { authorId },
      orderBy: { slug: "asc" },
      select: managedStorySelect,
    });
    return rows.map(mapManagedStoryRecord);
  }
  async getChapterManagementSummary(storyId: string, chapterId: string) {
    if (!storyId.trim() || !chapterId.trim()) return null;
    const row = await this.tx.chapter.findFirst({
      where: { id: chapterId, storyId },
      select: managedChapterSelect,
    });
    return row ? mapManagedChapter(row) : null;
  }
  async getChapter(slug: string, chapterId: string): Promise<Chapter> {
    const story = await this.getById(slug);
    return story?.chapters.find((chapter) => chapter.id === chapterId) ?? notFound();
  }
  async advanceRevision(story: StoryAccessRecord, expectedUpdatedAt: string): Promise<Date> {
    if (story.updatedAt.toISOString() !== expectedUpdatedAt) conflict();
    const next = new Date(Math.max(Date.now(), story.updatedAt.getTime() + 1));
    const result = await this.tx.story.updateMany({ where: { id: story.id, updatedAt: story.updatedAt }, data: { updatedAt: next } });
    if (result.count !== 1) conflict();
    return next;
  }
  async claimStoryCover(actorId: string, uploadId: string, claimedAt: Date): Promise<string> {
    const upload = await this.tx.mediaUpload.findFirst({
      where: { id: uploadId, ownerId: actorId, purpose: "story_cover", mediaKind: "image" },
      select: { id: true, status: true, result: true },
    });
    if (!upload) notFound();
    if (upload.status !== "COMPLETED") {
      conflict("UPLOAD_NOT_CLAIMABLE", "The story cover upload is not ready to be claimed.");
    }
    const parsed = completedMediaUploadSchema.safeParse(upload.result);
    if (!parsed.success || parsed.data.kind !== "image" || !parsed.data.primary.contentType.startsWith("image/")) {
      conflict("UPLOAD_INVALID", "The completed story cover is invalid.");
    }
    const claimed = await this.tx.mediaUpload.updateMany({
      where: {
        id: upload.id,
        ownerId: actorId,
        purpose: "story_cover",
        mediaKind: "image",
        status: "COMPLETED",
      },
      data: { status: "CLAIMED", claimedAt },
    });
    if (claimed.count !== 1) {
      conflict("UPLOAD_NOT_CLAIMABLE", "The story cover upload is not ready to be claimed.");
    }
    return parsed.data.primary.url;
  }
  async createStory(actor: StoryActor, metadata: StoryMetadata, coverUrl: string, byline: string, chapters: Array<{ title: string }>) {
    const base = metadata.title.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[đĐ]/g, "d")
      .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 100) || "story";
    const coverPosition = normalizeCoverPosition(metadata.cover_position);
    const row = await this.tx.story.create({ data: {
      slug: `${base}-${randomUUID()}`, title: metadata.title, description: metadata.description,
      coverUrl, genre: metadata.genre, authorId: actor.id, authorDisplayName: byline,
      coverPositionX: coverPosition.x, coverPositionY: coverPosition.y,
      chapters: { create: chapters.map((chapter, index) => ({ title: chapter.title, order: index + 1 })) },
    }, select: { slug: true, updatedAt: true } });
    await this.tx.user.updateMany({ where: { id: actor.id, role: "READER" }, data: { role: "AUTHOR" } });
    return row;
  }
  updateMetadata(id: string, metadata: StoryMetadata, coverUrl: string | undefined, updatedAt: Date) {
    return this.tx.story.update({ where: { id }, data: {
      title: metadata.title, description: metadata.description, ...(coverUrl === undefined ? {} : { coverUrl }),
      ...(metadata.cover_position === undefined ? {} : {
        coverPositionX: metadata.cover_position.x,
        coverPositionY: metadata.cover_position.y,
      }),
      genre: metadata.genre, updatedAt,
    } });
  }
  setStoryState(id: string, status: "DRAFT" | "PENDING_REVIEW" | "ARCHIVED", updatedAt: Date) {
    return this.tx.story.update({ where: { id }, data: {
      status, updatedAt,
      ...(status === "PENDING_REVIEW" ? { submittedAt: updatedAt, reviewedAt: null, reviewedById: null, rejectionReason: null } : {}),
      ...(status === "DRAFT" ? { submittedAt: null, reviewedAt: null, reviewedById: null, rejectionReason: null } : {}),
    } });
  }
  createChapter(storyId: string, title: string, order: number) {
    return this.tx.chapter.create({ data: { storyId, title, order }, select: { id: true } });
  }
  renameChapter(id: string, title: string) { return this.tx.chapter.update({ where: { id }, data: { title } }); }
  publishChapter(id: string, status: "draft" | "published") {
    return this.tx.chapter.update({ where: { id }, data: { status: status === "published" ? "PUBLISHED" : "DRAFT" } });
  }
  async reorderChapters(ids: string[]) {
    if (ids.length === 0) return;
    const orderCases = ids.map((id, index) => Prisma.sql`WHEN ${id} THEN ${index + 1}`);
    await this.tx.$executeRaw(Prisma.sql`
      UPDATE "Chapter"
      SET "order" = CASE "id"
        ${Prisma.join(orderCases, " ")}
        ELSE "order"
      END
      WHERE "id" IN (${Prisma.join(ids)})
    `);
  }
  async deleteChapter(id: string) {
    await this.tx.effect.deleteMany({ where: { block: { chapterId: id } } });
    await this.tx.storyBlock.deleteMany({ where: { chapterId: id } });
    await this.tx.chapter.delete({ where: { id } }); // Scene FK cascades; stale progress is reconciled by public reads.
  }
  async deleteStory(id: string) {
    await this.tx.effect.deleteMany({ where: { block: { chapter: { storyId: id } } } });
    await this.tx.scene.deleteMany({ where: { chapter: { storyId: id } } });
    await this.tx.storyBlock.deleteMany({ where: { chapter: { storyId: id } } });
    await this.tx.bookmark.deleteMany({ where: { storyId: id } });
    await this.tx.readingProgress.deleteMany({ where: { storyId: id } });
    await this.tx.chapter.deleteMany({ where: { storyId: id } });
    await this.tx.story.delete({ where: { id } });
  }
  async assertContentIds(chapterId: string, blocks: StoryBlock[], scenes: Scene[]) {
    const blockIds = blocks.map((block) => block.id);
    const effects = blocks.flatMap((block) => block.effects);
    const [foreignBlock, foreignEffect, foreignScene] = await Promise.all([
      this.tx.storyBlock.findFirst({ where: { id: { in: blockIds }, chapterId: { not: chapterId } }, select: { id: true } }),
      this.tx.effect.findFirst({ where: { id: { in: effects.map((effect) => effect.id) }, block: { chapterId: { not: chapterId } } }, select: { id: true } }),
      this.tx.scene.findFirst({ where: { id: { in: scenes.map((scene) => scene.id) }, chapterId: { not: chapterId } }, select: { id: true } }),
    ]);
    if (foreignBlock || foreignEffect || foreignScene) notFound();
  }
  async assertEffectReferences(actorId: string, effects: EffectConfig[], existing: EffectConfig[]) {
    const retained = new Map(existing.map((effect) => [effect.id, effect]));
    const newlySelected = effects.filter((effect) => retained.get(effect.id)?.type !== effect.type);
    const active = await this.tx.effectDefinition.findMany({ where: {
      effectId: { in: newlySelected.map((effect) => effect.type) }, isActive: true,
    }, select: { effectId: true } });
    if (newlySelected.some((effect) => !active.some((row) => row.effectId === effect.type))) {
      conflict("EFFECT_UNAVAILABLE", "A newly selected effect is unavailable.");
    }
    for (const effect of effects) {
      if (!effect.audio_asset_id) continue;
      const old = retained.get(effect.id);
      if (old?.audio_asset_id === effect.audio_asset_id && old.audio_src === effect.audio_src) continue;
      const asset = await this.tx.audioAsset.findFirst({ where: { id: effect.audio_asset_id, ownerId: actorId }, select: { url: true } });
      if (!asset || asset.url !== effect.audio_src) notFound();
    }
  }
  async assertPresetReferences(scenes: Scene[], existing: Scene[]) {
    const retained = new Map(existing.map((scene) => [scene.id, scene.based_on_preset_id]));
    for (const scene of scenes) {
      if (!scene.based_on_preset_id || retained.get(scene.id) === scene.based_on_preset_id) continue;
      const preset = await this.tx.scenePreset.findFirst({ where: { id: scene.based_on_preset_id, status: "ACTIVE" }, select: { id: true } });
      if (!preset) notFound();
    }
  }
  async replaceBlocks(chapterId: string, blocks: StoryBlock[]) {
    await this.tx.effect.deleteMany({ where: { block: { chapterId } } });
    await this.tx.storyBlock.deleteMany({ where: { chapterId } });
    await this.tx.storyBlock.createMany({ data: blocks.map((block, order) => ({
      id: block.id, chapterId, type: block.type, text: block.text, moodTag: block.mood_tag, order,
    })) });
    const effects = blocks.flatMap((block) => block.effects.map((effect) => ({
      id: effect.id, blockId: block.id, type: effect.type, category: effect.category,
      intensity: effect.intensity, durationMs: effect.duration_ms, delayMs: effect.delay_ms,
      audioSrc: effect.audio_src, audioAssetId: effect.audio_asset_id, loop: effect.loop ?? false,
    })));
    if (effects.length) await this.tx.effect.createMany({ data: effects });
  }
  async replaceScenes(chapterId: string, scenes: Scene[]) {
    await this.tx.scene.deleteMany({ where: { chapterId } });
    if (scenes.length) await this.tx.scene.createMany({ data: scenes.map((scene) => ({
      id: scene.id, chapterId, startBlockId: scene.start_block_id, endBlockId: scene.end_block_id,
      basedOnPresetId: scene.based_on_preset_id, renderConfig: databaseJson.sceneRenderConfig.write(scene.render_config),
    })) });
  }
}
