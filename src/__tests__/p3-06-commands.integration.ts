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
import type { Story, StoryBlock } from "@/types/story";
import type { ManagedStory } from "@/types/story-management";
import { databaseJson } from "@/lib/db/json-fields";
import { snapshotConfig } from "./fixtures/scene-fixtures";
import { storyCoverUploadFixture } from "./fixtures/media-upload-fixtures";

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
  const metadata = { title: "Thử nghiệm P3-06", description: "Test content", genre: ["Fantasy"] };
  let createdAudioDefinition = false;
  try {
    await prisma.user.createMany({ data: [
      { id: owner, email: `${owner}@example.invalid`, name: "Profile", role: "READER" },
      { id: outsider, email: `${outsider}@example.invalid`, name: "Other", role: "AUTHOR" },
      { id: admin, email: `${admin}@example.invalid`, name: "Admin", role: "ADMIN" },
      { id: blank, email: `${blank}@example.invalid`, role: "READER" },
    ] });
    let coverSequence = 0;
    const createCover = async (
      ownerId: string,
      options: Partial<Parameters<typeof storyCoverUploadFixture>[0]> = {},
    ) => {
      const id = `${prefix}-cover-${coverSequence++}`;
      const fixture = storyCoverUploadFixture({ id, ownerId, ...options });
      await prisma.mediaUpload.create({ data: fixture });
      return { id, url: fixture.result?.primary.url };
    };

    stage = "create, cover claim and byline atomicity";
    const rollbackCover = await createCover(blank);
    class FailingStoryCreate extends PrismaStoryCommandRepository {
      override async createStory(
        ...args: Parameters<PrismaStoryCommandRepository["createStory"]>
      ): ReturnType<PrismaStoryCommandRepository["createStory"]> {
        await super.createStory(...args);
        throw new Error("INJECTED_AFTER_STORY_CREATE");
      }
    }
    const failingCreate = new PrismaStoryCommandService(new StoryCommandTransactions(
      async () => prisma,
      (tx) => new FailingStoryCreate(tx),
    ));
    await assert.rejects(failingCreate.createStoryWithChapters({
      actorId: blank, coverUploadId: rollbackCover.id, metadata, chapters: [{ title: "One" }], byline: "Writer",
    }), /INJECTED_AFTER_STORY_CREATE/);
    assert.equal((await prisma.mediaUpload.findUniqueOrThrow({ where: { id: rollbackCover.id } })).status, "COMPLETED");
    assert.equal(await prisma.story.count({ where: { authorId: blank } }), 0);
    assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: blank } })).role, "READER");

    const invalidBylineCover = await createCover(blank);
    await assert.rejects(service.createStoryWithChapters({ actorId: blank, coverUploadId: invalidBylineCover.id, metadata, chapters: [{ title: "One" }], byline: " " }), errorStatus(400));
    assert.equal(await prisma.story.count({ where: { authorId: blank } }), 0);
    assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: blank } })).role, "READER");
    assert.equal((await prisma.mediaUpload.findUniqueOrThrow({ where: { id: invalidBylineCover.id } })).status, "COMPLETED");

    const ownerCover = await createCover(owner);
    const createdStory = await service.createStoryWithChapters({ actorId: owner, coverUploadId: ownerCover.id, metadata, byline: " Hàn Mặc Tử ", chapters: [{ title: "One" }, { title: "Two" }] });
    assert.equal(createdStory.data.author, "Hàn Mặc Tử");
    assert.equal(createdStory.data.cover_image, ownerCover.url);
    assert.equal((await prisma.mediaUpload.findUniqueOrThrow({ where: { id: ownerCover.id } })).status, "CLAIMED");
    assert.equal(createdStory.data.status, "draft");
    assert.ok(createdStory.data.chapters.every((chapter) => chapter.status === "draft" && chapter.blocks.length === 0));
    assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: owner } })).role, "AUTHOR");
    const outsiderStoryCover = await createCover(outsider);
    const fallback = await service.createStoryWithChapters({ actorId: outsider, coverUploadId: outsiderStoryCover.id, metadata, byline: " ", chapters: [{ title: "Other" }] });
    assert.equal(fallback.data.author, "Other");
    const slug = createdStory.data.id;
    const [first, second] = createdStory.data.chapters;
    let result: CommandResult<Story | ManagedStory> = createdStory;
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

    stage = "cover claim boundaries and management projections";
    const foreignCover = await createCover(outsider);
    const wrongPurposeCover = await createCover(owner, { purpose: "personal_background" });
    const pendingCover = await createCover(owner, { status: "pending" });
    for (const [coverUploadId, status] of [
      [foreignCover.id, 404],
      [wrongPurposeCover.id, 404],
      [pendingCover.id, 409],
      [ownerCover.id, 409],
    ] as const) {
      await assert.rejects(service.updateStoryMetadata({
        ...context(result), coverUploadId, metadata,
      }), errorStatus(status));
      assert.equal((await dal.getStory(owner, slug)).meta.updatedAt, result.meta.updatedAt);
    }
    const replacementCover = await createCover(owner);
    result = await service.updateStoryMetadata({ ...context(result), coverUploadId: replacementCover.id, metadata });
    assert.equal(result.data.cover_image, replacementCover.url);
    assert.equal((await prisma.mediaUpload.findUniqueOrThrow({ where: { id: replacementCover.id } })).status, "CLAIMED");
    result = await service.updateStoryMetadata({
      ...context(result),
      metadata: { ...metadata, cover_position: { x: 20, y: 80 } },
    });
    assert.deepEqual(result.data.cover_position, { x: 20, y: 80 });
    result = await service.updateStoryMetadata({ ...context(result), metadata: { ...metadata, title: "Cover and focal point preserved" } });
    assert.equal(result.data.cover_image, replacementCover.url);
    assert.deepEqual(result.data.cover_position, { x: 20, y: 80 });
    const centeredReplacement = await createCover(owner);
    result = await service.updateStoryMetadata({
      ...context(result),
      coverUploadId: centeredReplacement.id,
      metadata: { ...metadata, title: "Replacement resets omitted focal point" },
    });
    assert.equal(result.data.cover_image, centeredReplacement.url);
    assert.equal(result.data.cover_position, undefined);
    await assert.rejects(prisma.story.update({
      where: { slug },
      data: { coverPositionX: -1 },
    }), /constraint|range/i);
    assert.equal((await dal.getStory(owner, slug)).data.cover_position, undefined);

    const rejectionUpdatedAt = new Date(Date.now() + 1_000);
    await prisma.story.update({
      where: { slug: fallback.data.id },
      data: { status: "REJECTED", rejectionReason: "Bổ sung kết thúc", updatedAt: rejectionUpdatedAt },
    });
    const ownerList = await dal.getStoriesForAuthor(owner);
    assert.deepEqual(ownerList.map((item) => item.story.id), [slug]);
    assert.equal(ownerList[0].updatedAt, result.meta.updatedAt);
    assert.equal(ownerList[0].rejectionReason, null);
    assert.equal(ownerList[0].story.chapters[0].blockCount, 0);
    assert.equal(ownerList[0].story.chapters[0].effectCount, 0);
    assert.ok(!("blocks" in ownerList[0].story.chapters[0]));
    assert.ok(!("view_count" in ownerList[0].story));
    const outsiderList = await dal.getStoriesForAuthor(outsider);
    assert.deepEqual(outsiderList.map((item) => item.story.id), [fallback.data.id]);
    assert.equal(outsiderList[0].rejectionReason, "Bổ sung kết thúc");
    assert.equal(outsiderList[0].updatedAt, rejectionUpdatedAt.toISOString());
    assert.deepEqual(await dal.getStoriesForAuthor(admin), [], "Admin dashboard lists only stories owned by that admin");
    await assert.rejects(dal.getStoriesForAuthor(blank), errorStatus(403));
    assert.equal((await dal.getManagedStory(outsider, fallback.data.id)).data.rejectionReason, "Bổ sung kết thúc");
    assert.equal((await dal.getManagedStory(admin, fallback.data.id)).data.story.id, fallback.data.id);
    await assert.rejects(dal.getManagedStory(owner, fallback.data.id), errorStatus(404));
    await assert.rejects(service.submitForReview(context(result)), errorStatus(409));

    stage = "aggregate save snapshot and stale revision";
    const saved = await scenes.replaceEditor({ ...chapterContext(result), blocks, scenes: [scene] });
    assert.deepEqual(saved.data.scenes, [scene]);
    await prisma.effect.create({ data: {
      id: `${prefix}-projection-effect`, blockId: blocks[0].id,
      type: "particle_rain", category: "visual", intensity: 0.5, durationMs: 1_000,
    } });
    const managedAfterContent = await dal.getManagedStory(owner, slug);
    assert.equal(managedAfterContent.data.story.chapters[0].blockCount, 2);
    assert.equal(managedAfterContent.data.story.chapters[0].effectCount, 1);
    assert.ok(!("blocks" in managedAfterContent.data.story.chapters[0]));
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
    const insertedChapter = await chapters.createChapter({
      ...context(result),
      title: "Inserted after first",
      afterChapterId: first.id,
    });
    assert.equal(insertedChapter.data.order, 2);
    assert.deepEqual(
      (await dal.getStory(owner, slug)).data.chapters.map((chapter) => chapter.id),
      [first.id, insertedChapter.data.id, second.id],
    );

    class FailingChapterPlacement extends PrismaStoryCommandRepository {
      override async reorderChapters(ids: string[]) {
        await super.reorderChapters(ids);
        throw new Error("INJECTED_AFTER_CHAPTER_PLACEMENT");
      }
    }
    const failingChapterPlacement = new PrismaChapterCommandService(new StoryCommandTransactions(
      async () => prisma,
      (tx) => new FailingChapterPlacement(tx),
    ));
    await assert.rejects(failingChapterPlacement.createChapter({
      ...context(insertedChapter),
      title: "Rolled back insertion",
      afterChapterId: first.id,
    }), /INJECTED_AFTER_CHAPTER_PLACEMENT/);
    const afterPlacementFailure = await dal.getStory(owner, slug);
    assert.equal(afterPlacementFailure.meta.updatedAt, insertedChapter.meta.updatedAt);
    assert.deepEqual(
      afterPlacementFailure.data.chapters.map((chapter) => chapter.id),
      [first.id, insertedChapter.data.id, second.id],
    );

    await assert.rejects(chapters.createChapter({
      ...context(insertedChapter),
      title: "Foreign anchor",
      afterChapterId: fallback.data.chapters[0].id,
    }), errorStatus(404));
    assert.equal((await dal.getStory(owner, slug)).meta.updatedAt, insertedChapter.meta.updatedAt);
    const newChapter = await chapters.createChapter({ ...context(insertedChapter), title: "Third" });
    assert.deepEqual({ blockCount: newChapter.data.blockCount, effectCount: newChapter.data.effectCount }, { blockCount: 0, effectCount: 0 });
    const reordered = await chapters.reorderChapters({ ...context(newChapter), chapterIds: [newChapter.data.id, second.id, insertedChapter.data.id, first.id] });
    assert.deepEqual(reordered.data.map((chapter) => chapter.order), [1, 2, 3, 4]);
    assert.ok(reordered.data.every((chapter) => Object.keys(chapter).sort().join(",") === "id,order"));
    const renamed = await chapters.updateChapterMetadata({ ...chapterContext(reordered, newChapter.data.id), title: "Renamed" });
    assert.ok(!("blocks" in renamed.data));
    const removed = await chapters.deleteChapter(chapterContext(renamed, newChapter.data.id));
    const removedInserted = await chapters.deleteChapter(chapterContext(removed, insertedChapter.data.id));
    const published = await service.setChapterPublication({ ...chapterContext(removedInserted), status: "published" });
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

    stage = "story delete state, authorization and dependent cleanup";
    const deleteCover = await createCover(outsider);
    const deletable = await service.createStoryWithChapters({
      actorId: outsider,
      coverUploadId: deleteCover.id,
      metadata: { ...metadata, title: "Delete fixture" },
      chapters: [{ title: "Disposable" }],
    });
    const deleteSlug = deletable.data.id;
    const deleteChapterId = deletable.data.chapters[0].id;
    const deleteStoryRow = await prisma.story.findUniqueOrThrow({ where: { slug: deleteSlug } });
    const deleteBlockId = `${prefix}-delete-block`;
    await prisma.storyBlock.create({
      data: {
        id: deleteBlockId, chapterId: deleteChapterId, type: "paragraph", text: "Disposable", order: 0,
        effects: { create: { id: `${prefix}-delete-effect`, type: "particle_rain", category: "visual", intensity: 0.5, durationMs: 1000 } },
      },
    });
    await prisma.scene.create({ data: {
      id: `${prefix}-delete-scene`, chapterId: deleteChapterId,
      startBlockId: deleteBlockId, endBlockId: deleteBlockId,
      renderConfig: databaseJson.sceneRenderConfig.write(snapshotConfig()),
    } });
    await prisma.bookmark.create({ data: { userId: owner, storyId: deleteStoryRow.id } });
    await prisma.readingProgress.create({ data: {
      userId: owner, storyId: deleteStoryRow.id, chapterId: deleteChapterId, blockId: deleteBlockId,
    } });
    await prisma.story.update({ where: { id: deleteStoryRow.id }, data: { status: "PUBLISHED" } });
    const publishedDelete = await dal.getStory(outsider, deleteSlug);
    await assert.rejects(service.deleteStory({ actorId: outsider, storyId: deleteSlug, expectedUpdatedAt: publishedDelete.meta.updatedAt }), errorStatus(409));
    const archivedDelete = await service.archiveStory({ actorId: outsider, storyId: deleteSlug, expectedUpdatedAt: publishedDelete.meta.updatedAt });
    await assert.rejects(service.deleteStory({ actorId: owner, storyId: deleteSlug, expectedUpdatedAt: archivedDelete.meta.updatedAt }), errorStatus(404));
    await assert.rejects(service.deleteStory({ actorId: admin, storyId: deleteSlug, expectedUpdatedAt: publishedDelete.meta.updatedAt }), errorStatus(409));
    const deleted = await service.deleteStory({ actorId: admin, storyId: deleteSlug, expectedUpdatedAt: archivedDelete.meta.updatedAt });
    assert.equal(deleted.data, null);
    assert.equal(await prisma.story.count({ where: { id: deleteStoryRow.id } }), 0);
    assert.equal(await prisma.chapter.count({ where: { storyId: deleteStoryRow.id } }), 0);
    assert.equal(await prisma.storyBlock.count({ where: { id: deleteBlockId } }), 0);
    assert.equal(await prisma.effect.count({ where: { id: `${prefix}-delete-effect` } }), 0);
    assert.equal(await prisma.scene.count({ where: { id: `${prefix}-delete-scene` } }), 0);
    assert.equal(await prisma.bookmark.count({ where: { storyId: deleteStoryRow.id } }), 0);
    assert.equal(await prisma.readingProgress.count({ where: { storyId: deleteStoryRow.id } }), 0);
    assert.equal((await prisma.mediaUpload.findUniqueOrThrow({ where: { id: deleteCover.id } })).status, "CLAIMED");
    const draftDeleteCover = await createCover(owner);
    const draftDelete = await service.createStoryWithChapters({
      actorId: owner,
      coverUploadId: draftDeleteCover.id,
      metadata: { ...metadata, title: "Draft delete fixture" },
      chapters: [{ title: "Disposable draft" }],
    });
    assert.equal((await service.deleteStory({
      actorId: owner,
      storyId: draftDelete.data.id,
      expectedUpdatedAt: draftDelete.meta.updatedAt,
    })).data, null);

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
    await assert.rejects(storyRepository.save(createdStory.data), errorStatus(503));
    await assert.rejects(sceneRepository.replaceLegacyChapterScenes(slug, first.id, []), errorStatus(503));
    console.log("P3-06/P3-10 DB integration passed: atomic cover claim and role promotion, management projections, owner/admin guards, Story delete cleanup, state/concurrency, aggregate rollback, Scene integrity, chapter rules and blocked legacy writes.");
  } finally {
    // Only records owned by this test's unique user IDs; no migrated source mutation.
    await prisma.$transaction(async (tx) => {
      await tx.effect.deleteMany({ where: { block: { chapter: { story: { authorId: { in: users } } } } } });
      await tx.storyBlock.deleteMany({ where: { chapter: { story: { authorId: { in: users } } } } });
      await tx.bookmark.deleteMany({ where: { OR: [{ userId: { in: users } }, { story: { authorId: { in: users } } }] } });
      await tx.readingProgress.deleteMany({ where: { OR: [{ userId: { in: users } }, { story: { authorId: { in: users } } }] } });
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
