import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { loadEnvConfig } from "@next/env";
import { AuthAccessError } from "@/lib/auth/policy";
import { databaseJson } from "@/lib/db/json-fields";
import { PrismaStoryCommandRepository } from "@/lib/repositories/prisma-story-command-repository";
import { PrismaStoryRepository } from "@/lib/repositories/prisma-story-repository";
import { buildStorySearchText } from "@/lib/search/text-search";
import { CommandError } from "@/lib/services/command-error";
import { StoryCommandTransactions } from "@/lib/services/story-command-context";
import { StoryDataAccess } from "@/lib/services/story-dal";
import { StoryModerationService } from "@/lib/services/story-moderation-service";
import { snapshotConfig } from "./fixtures/scene-fixtures";

loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production");
let stage = "initialize";

async function run() {
  const { prisma } = await import("@/lib/db/prisma");
  const marker = `p311m${randomUUID().replaceAll("-", "")}`;
  const authorId = `${marker}-author`;
  const adminId = `${marker}-admin`;
  const readerId = `${marker}-reader`;
  const userIds = [authorId, adminId, readerId];
  const dal = new StoryDataAccess();
  const moderation = new StoryModerationService();
  const statusError = (status: number) => (error: unknown) =>
    (error instanceof CommandError || error instanceof AuthAccessError) && error.status === status;

  type FixtureStatus = "DRAFT" | "PENDING_REVIEW" | "PUBLISHED" | "REJECTED" | "ARCHIVED";
  const createdSlugs: string[] = [];
  const createFixture = async (options: {
    key: string;
    title: string;
    status: FixtureStatus;
    submittedAt?: Date | null;
    createdAt: Date;
    withContent?: boolean;
  }) => {
    const slug = `${marker}-${options.key}`;
    const chapterId = `${marker}-${options.key}-chapter`;
    const blockId = `${marker}-${options.key}-block`;
    const author = options.key === "primary" ? "Nguyễn Du" : `Bút danh ${marker}`;
    const effects = options.withContent ? [
      { id: `${blockId}-visual`, type: "particle_rain", category: "visual", intensity: 0.5, durationMs: 1_000 },
      { id: `${blockId}-audio`, type: "audio", category: "audio", intensity: 0.5, durationMs: 1_000, audioSrc: "https://media.example.invalid/ambient.mp3" },
      { id: `${blockId}-motion`, type: "screen_shake", category: "motion", intensity: 0.5, durationMs: 1_000 },
      { id: `${blockId}-transition`, type: "transition_fade", category: "transition", intensity: 0.5, durationMs: 1_000 },
    ] : [];
    const story = await prisma.story.create({
      data: {
        slug,
        authorId,
        authorDisplayName: author,
        title: `${options.title} ${marker}`,
        searchTextNormalized: buildStorySearchText(`${options.title} ${marker}`, author),
        description: options.withContent ? `Mô tả bí mật ${marker}` : "Moderation fixture",
        coverUrl: "/covers/local-test.svg",
        coverPositionX: 25,
        coverPositionY: 75,
        genre: ["Kỳ ảo", "Tâm lý"],
        status: options.status,
        submittedAt: options.submittedAt,
        createdAt: options.createdAt,
        updatedAt: options.createdAt,
        chapters: {
          create: {
            id: chapterId,
            title: `Chương ${options.key}`,
            order: 1,
            blocks: options.withContent ? {
              create: {
                id: blockId,
                type: "paragraph",
                text: `Nội dung bí mật ${marker}`,
                order: 1,
                effects: { create: effects },
              },
            } : undefined,
          },
        },
      },
      select: { id: true, slug: true, updatedAt: true },
    });
    if (options.withContent) {
      await prisma.scene.create({
        data: {
          id: `${marker}-${options.key}-scene`,
          chapterId,
          startBlockId: blockId,
          endBlockId: blockId,
          renderConfig: databaseJson.sceneRenderConfig.write(snapshotConfig()),
        },
      });
    }
    createdSlugs.push(slug);
    return { ...story, chapterId, blockId };
  };

  try {
    stage = "create fixtures";
    await prisma.user.createMany({ data: [
      { id: authorId, email: `${authorId}@example.invalid`, name: "Author", role: "AUTHOR" },
      { id: adminId, email: `${adminId}@example.invalid`, name: "Admin", role: "ADMIN" },
      { id: readerId, email: `${readerId}@example.invalid`, name: "Reader", role: "READER" },
    ] });
    const base = Date.now() - 86_400_000;
    const primary = await createFixture({
      key: "primary",
      title: "Đêm Giông",
      status: "PENDING_REVIEW",
      submittedAt: new Date(base + 8_000),
      createdAt: new Date(base + 1_000),
      withContent: true,
    });
    const pendingOld = await createFixture({
      key: "pending-old",
      title: "Pending old",
      status: "PENDING_REVIEW",
      submittedAt: new Date(base + 4_000),
      createdAt: new Date(base + 2_000),
    });
    const rejectTarget = await createFixture({
      key: "reject",
      title: "Reject target",
      status: "PENDING_REVIEW",
      submittedAt: new Date(base + 6_000),
      createdAt: new Date(base + 3_000),
    });
    const rollbackTarget = await createFixture({
      key: "rollback",
      title: "Rollback target",
      status: "PENDING_REVIEW",
      submittedAt: new Date(base + 5_000),
      createdAt: new Date(base + 4_000),
    });
    const published = await createFixture({
      key: "published",
      title: "Published",
      status: "PUBLISHED",
      submittedAt: new Date(base + 7_000),
      createdAt: new Date(base + 5_000),
    });
    const draft = await createFixture({
      key: "draft",
      title: "Draft preview",
      status: "DRAFT",
      submittedAt: null,
      createdAt: new Date(base + 6_000),
      withContent: true,
    });
    await createFixture({
      key: "rejected",
      title: "Rejected",
      status: "REJECTED",
      submittedAt: new Date(base + 3_000),
      createdAt: new Date(base + 7_000),
    });
    await createFixture({
      key: "archived",
      title: "Archived",
      status: "ARCHIVED",
      submittedAt: null,
      createdAt: new Date(base + 8_000),
    });

    stage = "admin authorization, summary and list projection";
    await assert.rejects(
      dal.listModerationStories(readerId, { q: marker, status: "all", cursor: null, limit: 20 }),
      statusError(403),
    );
    const summary = await dal.getModerationSummary(adminId);
    assert.deepEqual(summary, {
      pendingReview: await prisma.story.count({ where: { status: "PENDING_REVIEW" } }),
      published: await prisma.story.count({ where: { status: "PUBLISHED" } }),
      rejected: await prisma.story.count({ where: { status: "REJECTED" } }),
    });
    const pending = await dal.listModerationStories(adminId, {
      q: marker,
      status: "pending_review",
      cursor: null,
      limit: 20,
    });
    assert.deepEqual(
      pending.items.map((item) => item.id),
      [primary.slug, rejectTarget.slug, rollbackTarget.slug, pendingOld.slug],
    );
    assert.equal(pending.total, 4);
    assert.deepEqual(Object.keys(pending.items[0]).sort(), [
      "author", "blockCount", "chapterCount", "cover_image", "cover_position", "effectCount",
      "genre", "id", "status", "submittedAt", "title", "updatedAt",
    ]);
    assert.equal(JSON.stringify(pending.items).includes(`Nội dung bí mật ${marker}`), false);
    assert.equal(JSON.stringify(pending.items).includes("effects"), false);

    stage = "Unicode compact search, status filter and keyset cursor";
    const searched = await dal.listModerationStories(adminId, {
      q: `demgiong nguyen ${marker}`,
      status: "all",
      cursor: null,
      limit: 20,
    });
    assert.deepEqual(searched.items.map((item) => item.id), [primary.slug]);
    assert.deepEqual(
      (await dal.listModerationStories(adminId, {
        q: marker,
        status: "draft",
        cursor: null,
        limit: 20,
      })).items.map((item) => item.id),
      [draft.slug],
    );
    const pagedIds: string[] = [];
    let cursor: string | null = null;
    do {
      const page = await dal.listModerationStories(adminId, {
        q: marker,
        status: "all",
        cursor,
        limit: 2,
      });
      pagedIds.push(...page.items.map((item) => item.id));
      cursor = page.nextCursor;
    } while (cursor);
    assert.equal(pagedIds.length, createdSlugs.length);
    assert.equal(new Set(pagedIds).size, createdSlugs.length);
    assert.deepEqual(pagedIds.slice(0, 4), [
      primary.slug,
      rejectTarget.slug,
      rollbackTarget.slug,
      pendingOld.slug,
    ]);

    stage = "detail counts and private pending/draft preview";
    const detail = await dal.getModerationDetail(adminId, primary.slug);
    assert.equal(detail.data.authorEmail, `${authorId}@example.invalid`);
    assert.equal(detail.data.description, `Mô tả bí mật ${marker}`);
    assert.equal(detail.data.chapters[0].blockCount, 1);
    assert.equal(detail.data.chapters[0].effectCount, 4);
    assert.equal("effectCounts" in detail.data.chapters[0], false);
    assert.equal("blocks" in detail.data.chapters[0], false);
    await assert.rejects(dal.getModerationDetail(readerId, primary.slug), statusError(403));
    const pendingPreview = await dal.getModerationPreview(adminId, primary.slug, primary.chapterId);
    assert.equal(pendingPreview.data.chapter.blocks[0].text, `Nội dung bí mật ${marker}`);
    assert.equal(pendingPreview.data.scenes.length, 1);
    const draftPreview = await dal.getModerationPreview(adminId, draft.slug, draft.chapterId);
    assert.equal(draftPreview.data.chapter.blocks[0].text, `Nội dung bí mật ${marker}`);
    await assert.rejects(
      dal.getModerationPreview(readerId, draft.slug, draft.chapterId),
      statusError(403),
    );

    stage = "stale and state transition conflicts";
    await assert.rejects(moderation.approve({
      actorId: adminId,
      storyId: primary.slug,
      expectedUpdatedAt: new Date(0).toISOString(),
    }), statusError(409));
    await assert.rejects(moderation.reject({
      actorId: adminId,
      storyId: published.slug,
      expectedUpdatedAt: published.updatedAt.toISOString(),
      reason: "Không thể từ chối trạng thái này.",
    }), statusError(409));
    await assert.rejects(moderation.approve({
      actorId: authorId,
      storyId: primary.slug,
      expectedUpdatedAt: primary.updatedAt.toISOString(),
    }), statusError(403));

    stage = "approve and reject transactions";
    const approved = await moderation.approve({
      actorId: adminId,
      storyId: primary.slug,
      expectedUpdatedAt: primary.updatedAt.toISOString(),
    });
    assert.equal(approved.data.status, "published");
    const approvedRow = await prisma.story.findUniqueOrThrow({
      where: { slug: primary.slug },
      include: { chapters: true },
    });
    assert.equal(approvedRow.status, "PUBLISHED");
    assert.equal(approvedRow.reviewedById, adminId);
    assert.ok(approvedRow.reviewedAt);
    assert.ok(approvedRow.chapters.every((chapter) => chapter.status === "PUBLISHED"));
    const publicRepository = new PrismaStoryRepository(async () => prisma);
    assert.equal((await publicRepository.getPublicById(primary.slug))?.id, primary.slug);

    const rejected = await moderation.reject({
      actorId: adminId,
      storyId: rejectTarget.slug,
      expectedUpdatedAt: rejectTarget.updatedAt.toISOString(),
      reason: "  Cần bổ sung kết thúc rõ ràng.  ",
    });
    assert.equal(rejected.data.status, "rejected");
    const rejectedRow = await prisma.story.findUniqueOrThrow({ where: { slug: rejectTarget.slug } });
    assert.equal(rejectedRow.status, "REJECTED");
    assert.equal(rejectedRow.rejectionReason, "Cần bổ sung kết thúc rõ ràng.");
    assert.equal(rejectedRow.reviewedById, adminId);
    assert.equal(await publicRepository.getPublicById(rejectTarget.slug), null);

    stage = "atomic rollback after decision writes";
    class FailingApproveRepository extends PrismaStoryCommandRepository {
      override async approveStory(
        ...args: Parameters<PrismaStoryCommandRepository["approveStory"]>
      ): ReturnType<PrismaStoryCommandRepository["approveStory"]> {
        await super.approveStory(...args);
        throw new Error("INJECTED_AFTER_APPROVE");
      }
    }
    const failingModeration = new StoryModerationService(new StoryCommandTransactions(
      async () => prisma,
      (tx) => new FailingApproveRepository(tx),
    ));
    await assert.rejects(failingModeration.approve({
      actorId: adminId,
      storyId: rollbackTarget.slug,
      expectedUpdatedAt: rollbackTarget.updatedAt.toISOString(),
    }), /INJECTED_AFTER_APPROVE/);
    const rolledBack = await prisma.story.findUniqueOrThrow({
      where: { slug: rollbackTarget.slug },
      include: { chapters: true },
    });
    assert.equal(rolledBack.status, "PENDING_REVIEW");
    assert.equal(rolledBack.reviewedAt, null);
    assert.equal(rolledBack.reviewedById, null);
    assert.ok(rolledBack.chapters.every((chapter) => chapter.status === "DRAFT"));

    console.log("P3-11 moderation DB integration passed: admin boundaries, projection/search/filter/cursor, private preview, counts, transitions, stale conflicts and atomic rollback.");
  } finally {
    await prisma.effect.deleteMany({ where: { block: { chapter: { story: { authorId } } } } });
    await prisma.scene.deleteMany({ where: { chapter: { story: { authorId } } } });
    await prisma.storyBlock.deleteMany({ where: { chapter: { story: { authorId } } } });
    await prisma.chapter.deleteMany({ where: { story: { authorId } } });
    await prisma.story.deleteMany({ where: { authorId } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  }
}

run().catch((error: unknown) => {
  console.error("P3-11 moderation DB integration failed; inspect the stage without logging database payloads.");
  console.error(`Stage: ${stage}`);
  if (error instanceof assert.AssertionError) console.error(error.message);
  const code = error && typeof error === "object" && "code" in error ? String(error.code) : null;
  if (code) console.error(`Code: ${code}`);
  if (error instanceof Error) {
    const frame = error.stack?.split("\n").find((line) => line.includes("p3-11-moderation.integration.ts:"));
    if (frame) console.error(frame.trim());
  }
  process.exitCode = 1;
});
