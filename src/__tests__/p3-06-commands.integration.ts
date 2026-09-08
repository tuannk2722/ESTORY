import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { loadEnvConfig } from "@next/env";
import { PrismaStoryCommandService } from "@/lib/services/prisma-story-command-service";
import { PrismaChapterCommandService } from "@/lib/services/prisma-chapter-command-service";
import { PrismaSceneCommandService } from "@/lib/services/prisma-scene-command-service";
import { StoryCommandTransactions } from "@/lib/services/story-command-context";
import { PrismaStoryCommandRepository } from "@/lib/repositories/prisma-story-command-repository";
import { StoryDataAccess } from "@/lib/services/story-dal";
import { AuthAccessError } from "@/lib/auth/policy";
import { CommandError } from "@/lib/services/command-error";
import type { CommandResult } from "@/lib/services/story-command-service";
import type { Scene } from "@/types/scene";
import type { StoryBlock } from "@/types/story";
import { snapshotConfig } from "./fixtures/scene-fixtures";

loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production");
let stage = "initialize";

async function run() {
  const { prisma } = await import("@/lib/db/prisma");
  const prefix = `p3-06-${randomUUID()}`;
  const owner = `${prefix}-owner`, outsider = `${prefix}-outsider`, admin = `${prefix}-admin`, blank = `${prefix}-blank`;
  const users = [owner, outsider, admin, blank];
  const service = new PrismaStoryCommandService();
  const chapters = new PrismaChapterCommandService();
  const scenes = new PrismaSceneCommandService();
  const dal = new StoryDataAccess();
  const errorStatus = (status: number) => (error: unknown) =>
    (error instanceof CommandError || error instanceof AuthAccessError) && error.status === status;
  const metadata = { title: "Thử nghiệm P3-06", description: "Test content", cover_image: "/cover.svg", genre: ["Fantasy"] };
  let createdAudioDefinition = false;
  try {
    await prisma.user.createMany({ data: [
      { id: owner, email: `${owner}@example.invalid`, name: "Profile", role: "READER" },
      { id: outsider, email: `${outsider}@example.invalid`, name: "Other", role: "AUTHOR" },
      { id: admin, email: `${admin}@example.invalid`, name: "Admin", role: "ADMIN" },
      { id: blank, email: `${blank}@example.invalid`, role: "READER" },
    ] });
    stage = "create and byline atomicity";
    await assert.rejects(service.createStoryWithChapters({ actorId: blank, metadata, chapters: [{ title: "One" }], byline: " " }), errorStatus(400));
    assert.equal(await prisma.story.count({ where: { authorId: blank } }), 0);
    assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: blank } })).role, "READER");
    let result = await service.createStoryWithChapters({ actorId: owner, metadata, byline: " Hàn Mặc Tử ", chapters: [{ title: "One" }, { title: "Two" }] });
    assert.equal(result.data.author, "Hàn Mặc Tử");
    assert.equal(result.data.status, "draft");
    assert.ok(result.data.chapters.every((chapter) => chapter.status === "draft" && chapter.blocks.length === 0));
    assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: owner } })).role, "AUTHOR");
    const fallback = await service.createStoryWithChapters({ actorId: outsider, metadata, byline: " ", chapters: [{ title: "Other" }] });
    assert.equal(fallback.data.author, "Other");
    const slug = result.data.id;
    const [first, second] = result.data.chapters;
    const context = (current: CommandResult<unknown>, actorId = owner) => ({ actorId, storyId: slug, expectedUpdatedAt: current.meta.updatedAt });
    const chapterContext = (current: CommandResult<unknown>, chapterId = first.id, actorId = owner) => ({ ...context(current, actorId), chapterId });
    const block = (suffix: string): StoryBlock => ({ id: `${prefix}-${suffix}`, type: "paragraph", text: "Content", effects: [] });
    const blocks = [block("one"), block("two")];
    const scene: Scene = { id: `${prefix}-scene`, chapter_id: first.id, start_block_id: blocks[0].id, end_block_id: blocks[1].id, render_config: snapshotConfig() };

    stage = "ownership role and ID swapping";
    await assert.rejects(dal.getStory(outsider, slug), errorStatus(404));
    await assert.rejects(dal.getStory(owner, "missing-story"), errorStatus(404));
    await assert.rejects(dal.getStory(blank, slug), errorStatus(403));
    await assert.rejects(service.updateStoryMetadata({ ...context(result, outsider), metadata }), errorStatus(404));
    await assert.rejects(chapters.updateChapterMetadata({ ...chapterContext(result, fallback.data.chapters[0].id), title: "Swapped" }), errorStatus(404));
    const internal = await prisma.story.findUniqueOrThrow({ where: { slug } });
    assert.notEqual(internal.id, slug);
    await assert.rejects(dal.getStory(owner, internal.id), errorStatus(404));
    assert.equal((await dal.getStory(admin, slug)).data.id, slug);
    assert.ok(!("authorId" in result.data));
    await assert.rejects(service.submitForReview(context(result)), errorStatus(409));

    stage = "aggregate save snapshot and stale revision";
    const saved = await scenes.replaceEditor({ ...chapterContext(result), blocks, scenes: [scene] });
    assert.deepEqual(saved.data.scenes, [scene]);
    await assert.rejects(scenes.replaceEditor({ ...chapterContext(result), blocks, scenes: [scene] }), errorStatus(409));
    const changed = await service.replaceChapterContent({ ...chapterContext(saved), blocks: blocks.map((b) => ({ ...b, text: "Changed" })) });
    assert.deepEqual((await dal.getEditor(owner, slug, first.id)).data.scenes, [scene]);
    const beforeFailure = await dal.getEditor(owner, slug, first.id);
    stage = "range malformed JSON and transaction rollback";
    for (const bad of [
      { ...scene, start_block_id: "missing-block" },
      { ...scene, chapter_id: second.id },
      { ...scene, render_config: { ...scene.render_config, schema_version: 99 } },
      { ...scene, render_config: "malformed-json" },
    ]) {
      await assert.rejects(scenes.replaceEditor({ ...chapterContext(changed), blocks, scenes: [bad as Scene] }), errorStatus(400));
    }
    await assert.rejects(scenes.replaceChapterScenes({ ...chapterContext(changed), scenes: [scene, { ...scene, id: `${prefix}-overlap` }] }), errorStatus(400));
    await assert.rejects(service.replaceChapterContent({ ...chapterContext(changed), blocks: [blocks[0]] }), errorStatus(400));
    assert.deepEqual(await dal.getEditor(owner, slug, first.id), beforeFailure);
    class FailingScenes extends PrismaStoryCommandRepository {
      override async replaceScenes(chapterId: string, values: Scene[]) {
        await super.replaceScenes(chapterId, values);
        throw new Error("INJECTED_AFTER_AGGREGATE_WRITE");
      }
    }
    const failing = new PrismaSceneCommandService(new StoryCommandTransactions(async () => prisma, (tx) => new FailingScenes(tx)));
    await assert.rejects(failing.replaceEditor({ ...chapterContext(changed), blocks, scenes: [] }), /INJECTED_AFTER_AGGREGATE_WRITE/);
    assert.deepEqual(await dal.getEditor(owner, slug, first.id), beforeFailure);

    stage = "cross-chapter block and scene IDs";
    const secondSaved = await scenes.replaceEditor({ ...chapterContext(changed, second.id), blocks: [block("other")], scenes: [] });
    await assert.rejects(scenes.replaceEditor({ ...chapterContext(secondSaved, second.id), blocks, scenes: [] }), errorStatus(404));
    await assert.rejects(scenes.replaceChapterScenes({ ...chapterContext(secondSaved, second.id), scenes: [{ ...scene, chapter_id: second.id, start_block_id: `${prefix}-other`, end_block_id: `${prefix}-other` }] }), errorStatus(404));

    stage = "pending review and admin override";
    result = await service.submitForReview(context(secondSaved));
    assert.equal(result.data.status, "pending_review");
    for (const mutation of [
      () => service.updateStoryMetadata({ ...context(result), metadata }),
      () => chapters.createChapter({ ...context(result), title: "Blocked" }),
      () => chapters.reorderChapters({ ...context(result), chapterIds: [second.id, first.id] }),
      () => chapters.deleteChapter(chapterContext(result)),
      () => service.setChapterPublication({ ...chapterContext(result), status: "published" }),
      () => scenes.replaceChapterScenes({ ...chapterContext(result), scenes: [] }),
      () => service.replaceChapterContent({ ...chapterContext(result), blocks }),
    ]) await assert.rejects(mutation(), errorStatus(409));
    const adminEdit = await service.updateStoryMetadata({ ...context(result, admin), metadata: { ...metadata, title: "Admin edit" } });
    assert.equal(adminEdit.data.author, "Hàn Mặc Tử");
    result = await service.cancelReview(context(adminEdit));
    assert.equal(result.data.status, "draft");
    await assert.rejects(service.cancelReview(context(result)), errorStatus(409));

    stage = "chapter lifecycle and last-published rule";
    const newChapter = await chapters.createChapter({ ...context(result), title: "Third" });
    const reordered = await chapters.reorderChapters({ ...context(newChapter), chapterIds: [newChapter.data.id, second.id, first.id] });
    assert.deepEqual(reordered.data.map((chapter) => chapter.order), [1, 2, 3]);
    const renamed = await chapters.updateChapterMetadata({ ...chapterContext(reordered, newChapter.data.id), title: "Renamed" });
    const removed = await chapters.deleteChapter(chapterContext(renamed, newChapter.data.id));
    const published = await service.setChapterPublication({ ...chapterContext(removed), status: "published" });
    // Fixture simulates the P3-11 moderation result; no moderation command is exposed here.
    await prisma.story.update({ where: { slug }, data: { status: "PUBLISHED" } });
    let publicStory = await dal.getStory(owner, slug);
    assert.equal(published.data.status, "published");
    await assert.rejects(service.setChapterPublication({ ...chapterContext(publicStory), status: "draft" }), errorStatus(409));
    await assert.rejects(chapters.deleteChapter(chapterContext(publicStory)), errorStatus(409));
    result = await service.archiveStory(context(publicStory));
    assert.equal(result.data.status, "archived");
    await assert.rejects(service.updateStoryMetadata({ ...context(result), metadata }), errorStatus(409));
    result = await service.restoreStory(context(result));
    assert.equal(result.data.status, "draft");

    stage = "concurrent sibling changes serialize at Story";
    const concurrent = await Promise.allSettled([
      chapters.updateChapterMetadata({ ...chapterContext(result), title: "Race A" }),
      chapters.updateChapterMetadata({ ...chapterContext(result, second.id), title: "Race B" }),
    ]);
    assert.equal(concurrent.filter((item) => item.status === "fulfilled").length, 1);
    const rejected = concurrent.find((item) => item.status === "rejected");
    assert.ok(rejected?.status === "rejected" && errorStatus(409)(rejected.reason));
    publicStory = await dal.getStory(owner, slug);
    const deleteSecond = await chapters.deleteChapter(chapterContext(publicStory, second.id));
    await assert.rejects(chapters.deleteChapter(chapterContext(deleteSecond)), errorStatus(409));

    stage = "personal audio reference ownership";
    const audioDefinition = await prisma.effectDefinition.findUnique({ where: { effectId: "audio" } });
    if (!audioDefinition) {
      await prisma.effectDefinition.create({ data: { effectId: "audio", label: "Audio" } });
      createdAudioDefinition = true;
    }
    if (audioDefinition?.isActive !== false) {
      const foreign = await prisma.audioAsset.create({ data: { ownerId: outsider, source: "upload", title: "Private", url: "/private.mp3", durationMs: 1000 } });
      const audioBlock: StoryBlock = { ...blocks[0], effects: [{ id: `${prefix}-audio-effect`, type: "audio", category: "audio", intensity: 1, duration_ms: 1000, audio_src: foreign.url, audio_asset_id: foreign.id }] };
      await assert.rejects(scenes.replaceEditor({ ...chapterContext(deleteSecond), blocks: [audioBlock], scenes: [] }), errorStatus(404));
    }
    const { storyRepository, sceneRepository } = await import("@/lib/repositories");
    await assert.rejects(storyRepository.save(result.data), errorStatus(503));
    await assert.rejects(sceneRepository.replaceLegacyChapterScenes(slug, first.id, []), errorStatus(503));
    console.log("P3-06 DB integration passed: byline/role atomicity, owner/admin/membership, state machine, stale/concurrent writes, aggregate rollback, Scene integrity, chapter rules and blocked legacy writes.");
  } finally {
    // Only records owned by this test's unique user IDs; no migrated source mutation.
    await prisma.$transaction(async (tx) => {
      await tx.effect.deleteMany({ where: { block: { chapter: { story: { authorId: { in: users } } } } } });
      await tx.storyBlock.deleteMany({ where: { chapter: { story: { authorId: { in: users } } } } });
      await tx.chapter.deleteMany({ where: { story: { authorId: { in: users } } } });
      await tx.story.deleteMany({ where: { authorId: { in: users } } });
      await tx.user.deleteMany({ where: { id: { in: users } } });
      if (createdAudioDefinition) await tx.effectDefinition.delete({ where: { effectId: "audio" } });
    });
    await prisma.$disconnect();
  }
}
run().catch((error: unknown) => {
  console.error(`P3-06 DB integration failed at: ${stage}`);
  if (error instanceof CommandError) console.error(`Command code: ${error.body.error.code}`);
  if (error instanceof Error) {
    const line = error.stack?.split("\n").find((entry) => entry.includes("p3-06-commands.integration.ts:"));
    if (line) console.error(line.trim());
  }
  process.exitCode = 1;
});
