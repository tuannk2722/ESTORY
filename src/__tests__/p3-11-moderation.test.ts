import assert from "node:assert/strict";
import {
  decodeModerationCursor,
  encodeModerationCursor,
} from "@/lib/repositories/story-moderation-query";
import {
  moderationChapterSchema,
  moderationListItemSchema,
  moderationListQuerySchema,
  parseModerationSearchParams,
  rejectStorySchema,
} from "@/lib/validation/story-moderation-schema";

export async function runP311ModerationTests() {
  assert.deepEqual(parseModerationSearchParams({}), {
    q: "",
    status: "pending_review",
    cursor: null,
    limit: 20,
  });
  assert.deepEqual(parseModerationSearchParams({
    q: ["  Đêm   Giông  ", "ignored"],
    status: ["published", "all"],
    cursor: ["bad+cursor", "ignored"],
    limit: ["999", "1"],
  }), {
    q: "Đêm Giông",
    status: "published",
    cursor: null,
    limit: 50,
  });
  assert.equal(
    moderationListQuerySchema.safeParse({
      q: "🌙".repeat(100), status: "all", cursor: null, limit: 20,
    }).success,
    true,
  );
  assert.equal(
    moderationListQuerySchema.safeParse({
      q: "🌙".repeat(101), status: "all", cursor: null, limit: 20,
    }).success,
    false,
  );

  const query = { q: "Đêm Giông", status: "all" as const, cursor: null, limit: 1 };
  const cursorValue = {
    rank: 0,
    submittedAt: "2026-09-13T08:00:00.000Z",
    createdAt: "2026-09-12T08:00:00.000Z",
    id: "internal-story-id",
  };
  const encoded = encodeModerationCursor(query, cursorValue);
  assert.deepEqual(decodeModerationCursor({ ...query, cursor: encoded }), cursorValue);
  assert.equal(decodeModerationCursor({ ...query, q: "khác", cursor: encoded }), null);
  assert.equal(decodeModerationCursor({ ...query, status: "published", cursor: encoded }), null);

  assert.equal(rejectStorySchema.safeParse({
    expectedUpdatedAt: "2026-09-13T08:00:00.000Z",
    reason: "     ",
  }).success, false);
  assert.equal(rejectStorySchema.safeParse({
    expectedUpdatedAt: "2026-09-13T08:00:00.000Z",
    reason: "  Cần bổ sung kết thúc.  ",
  }).data?.reason, "Cần bổ sung kết thúc.");

  const projected = moderationListItemSchema.parse({
    id: "story-id",
    title: "Tác phẩm",
    author: "Bút danh",
    cover_image: "/covers/local.svg",
    genre: ["Kỳ ảo"],
    submittedAt: null,
    chapterCount: 1,
    blockCount: 2,
    effectCount: 3,
    status: "pending_review",
    updatedAt: "2026-09-13T08:00:00.000Z",
  });
  assert.equal(projected.cover_image, "/covers/local.svg");
  assert.equal(moderationListItemSchema.safeParse({ ...projected, blocks: ["leak"] }).success, false);

  const chapter = moderationChapterSchema.parse({
    id: "chapter-id",
    title: "Chương 1",
    order: 1,
    status: "draft",
    blockCount: 2,
    effectCount: 3,
  });
  assert.equal(chapter.effectCount, 3);
  assert.equal(moderationChapterSchema.safeParse({
    ...chapter,
    effectCounts: { visual: 1, audio: 1, motion: 1, transition: 0 },
  }).success, false);

  console.log("p3-11-moderation.test.ts: params, query-bound cursor, decision validation and lean projections passed");
}
