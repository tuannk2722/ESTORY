import "server-only";
import { randomUUID } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import type { Chapter, EffectConfig, StoryBlock } from "@/types/story";
import type { Scene } from "@/types/scene";
import type { StoryActor, StoryAccessRecord } from "@/lib/auth/story-policy";
import { AuthAccessError } from "@/lib/auth/policy";
import { conflict, notFound } from "@/lib/services/command-error";
import type { StoryMetadata } from "@/lib/services/story-command-service";
import { databaseJson } from "@/lib/db/json-fields";
import { PrismaStoryRepository } from "./prisma-story-repository";
import { PrismaSceneRepository } from "./prisma-scene-repository";

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
  async createStory(actor: StoryActor, metadata: StoryMetadata, byline: string, chapters: Array<{ title: string }>) {
    const base = metadata.title.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[đĐ]/g, "d")
      .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 100) || "story";
    const row = await this.tx.story.create({ data: {
      slug: `${base}-${randomUUID()}`, title: metadata.title, description: metadata.description,
      coverUrl: metadata.cover_image, genre: metadata.genre, authorId: actor.id, authorDisplayName: byline,
      chapters: { create: chapters.map((chapter, index) => ({ title: chapter.title, order: index + 1 })) },
    }, select: { slug: true, updatedAt: true } });
    await this.tx.user.updateMany({ where: { id: actor.id, role: "READER" }, data: { role: "AUTHOR" } });
    return row;
  }
  updateMetadata(id: string, metadata: StoryMetadata, updatedAt: Date) {
    return this.tx.story.update({ where: { id }, data: {
      title: metadata.title, description: metadata.description, coverUrl: metadata.cover_image,
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
    for (const [index, id] of ids.entries()) await this.tx.chapter.update({ where: { id }, data: { order: index + 1 } });
  }
  async deleteChapter(id: string) {
    await this.tx.effect.deleteMany({ where: { block: { chapterId: id } } });
    await this.tx.storyBlock.deleteMany({ where: { chapterId: id } });
    await this.tx.chapter.delete({ where: { id } }); // Scene FK cascades; stale progress is reconciled by public reads.
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
