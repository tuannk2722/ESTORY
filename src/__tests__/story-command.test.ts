import assert from "node:assert/strict";
import { z } from "zod";
import { requireStoryOwnerOrAdmin, requireChapterInStory, requireStoryMutable } from "@/lib/auth/story-policy";
import { AuthAccessError } from "@/lib/auth/policy";
import { CommandError, mapCommandDatabaseError } from "@/lib/services/command-error";
import {
  authorStoryListSchema,
  createChapterSchema,
  createStorySchema,
  deleteStorySchema,
  chapterOrderSchema,
  managedChapterSchema,
  managedStoryDataSchema,
  managedStorySchema,
  replaceEditorSchema,
  resolveStoryByline,
  updateStorySchema,
  validateCommand,
} from "@/lib/validation/story-command-schema";
import { commandFailure, commandResponse, MAX_COMMAND_BODY_BYTES, readCommandJson } from "@/lib/http/command-response";
import { parseEnvironment } from "@/lib/config/environment";

export async function runStoryCommandTests() {
  const errorStatus = (status: number) => (error: unknown) =>
    (error instanceof CommandError || error instanceof AuthAccessError) && error.status === status;
  const owner = { id: "owner", role: "author" as const, name: "Profile" };
  const admin = { ...owner, id: "admin", role: "admin" as const };
  const story = { id: "internal", slug: "story", authorId: owner.id, status: "DRAFT", updatedAt: new Date() };
  requireStoryOwnerOrAdmin(owner, story);
  requireStoryOwnerOrAdmin(admin, story);
  for (const value of [null, { ...story, authorId: "another" }]) {
    assert.throws(() => requireStoryOwnerOrAdmin(owner, value), errorStatus(404));
  }
  assert.throws(() => requireStoryOwnerOrAdmin({ ...owner, role: "reader" }, story), errorStatus(403));
  assert.throws(() => requireChapterInStory(story, { storyId: "swapped" }), errorStatus(404));
  assert.throws(() => requireChapterInStory(story, null), errorStatus(404));
  assert.throws(() => requireStoryMutable(owner, { ...story, status: "PENDING_REVIEW" }), errorStatus(409));
  requireStoryMutable(admin, { ...story, status: "PENDING_REVIEW" });
  assert.throws(() => requireStoryMutable(admin, { ...story, status: "ARCHIVED" }), errorStatus(409));
  assert.equal(resolveStoryByline(" Hàn Mặc Tử ", "Profile"), "Hàn Mặc Tử");
  assert.equal(resolveStoryByline(" J.K. Rowling ", null), "J.K. Rowling");
  for (const input of [undefined, "", " \n "]) assert.equal(resolveStoryByline(input, " Profile "), "Profile");
  for (const name of [null, "", " \t "]) assert.throws(() => resolveStoryByline(" ", name), (error: unknown) => {
    assert.ok(error instanceof CommandError);
    assert.ok(error.body.error.fieldErrors?.byline);
    return error.status === 400;
  });
  const create = { actorId: "owner", coverUploadId: "cover-upload", metadata: { title: "Title", description: "Description", genre: ["Fantasy"] }, chapters: [{ title: "Chapter" }] };
  validateCommand(createStorySchema, create);
  assert.deepEqual(validateCommand(createStorySchema, {
    ...create,
    metadata: { ...create.metadata, cover_position: { x: 0, y: 100 } },
  }).metadata.cover_position, { x: 0, y: 100 });
  for (const invalid of [
    { ...create, role: "admin" },
    { ...create, byline: 123 },
    { ...create, coverUploadId: " " },
    { ...create, chapters: [] },
    { ...create, metadata: { ...create.metadata, title: " " } },
    { ...create, metadata: { ...create.metadata, cover_image: "https://untrusted.invalid/cover.png" } },
    { ...create, metadata: { ...create.metadata, cover_position: { x: -1, y: 50 } } },
    { ...create, metadata: { ...create.metadata, cover_position: { x: 50, y: 101 } } },
  ]) {
    assert.throws(() => validateCommand(createStorySchema, invalid), errorStatus(400));
  }
  const context = { actorId: "owner", storyId: "story", expectedUpdatedAt: new Date().toISOString() };
  assert.equal(validateCommand(createChapterSchema, {
    ...context,
    title: "Inserted chapter",
    afterChapterId: "chapter-one",
  }).afterChapterId, "chapter-one");
  assert.equal(validateCommand(createChapterSchema, { ...context, title: "Appended chapter" }).afterChapterId, undefined);
  assert.throws(() => validateCommand(createChapterSchema, {
    ...context,
    title: "Invalid anchor",
    afterChapterId: " ",
  }), errorStatus(400));
  assert.deepEqual(validateCommand(updateStorySchema, { ...context, metadata: create.metadata }), { ...context, metadata: create.metadata });
  assert.equal(validateCommand(updateStorySchema, { ...context, coverUploadId: "new-cover", metadata: create.metadata }).coverUploadId, "new-cover");
  assert.throws(() => validateCommand(updateStorySchema, { ...context, metadata: { ...create.metadata, cover_image: "/cover.svg" } }), errorStatus(400));
  assert.deepEqual(validateCommand(deleteStorySchema, context), context);
  const storyData = {
    id: "story", title: "Title", author: "Author", description: "Description",
    cover_image: "https://media.invalid/cover.png", genre: ["Fantasy"], status: "rejected" as const,
    view_count: 0, chapters: [],
  };
  const managedChapter = {
    id: "chapter", title: "Chapter", order: 1, status: "draft" as const,
    blockCount: 2, effectCount: 3,
  };
  const managedStory = {
    id: storyData.id, title: storyData.title, author: storyData.author,
    description: storyData.description, cover_image: storyData.cover_image,
    genre: storyData.genre, status: storyData.status, chapters: [managedChapter],
  };
  assert.deepEqual(managedChapterSchema.parse(managedChapter), managedChapter);
  assert.deepEqual(chapterOrderSchema.parse({ id: managedChapter.id, order: 2 }), { id: "chapter", order: 2 });
  assert.deepEqual(managedStorySchema.parse(managedStory), managedStory);
  assert.deepEqual(managedStoryDataSchema.parse({ story: managedStory, rejectionReason: "Needs revision" }).rejectionReason, "Needs revision");
  assert.equal(authorStoryListSchema.parse([{ story: managedStory, rejectionReason: null, updatedAt: context.expectedUpdatedAt }]).length, 1);
  assert.throws(() => managedChapterSchema.parse({ ...managedChapter, blocks: [] }));
  assert.throws(() => managedStorySchema.parse({ ...managedStory, view_count: 0 }));
  assert.throws(() => validateCommand(replaceEditorSchema, { actorId: "owner", storyId: "story", chapterId: "chapter", chapter: {}, scenes: [], revision: "legacy" }), errorStatus(400));
  const prismaFlags = { DATABASE_URL: "postgresql://fixture:fixture@localhost/test", PHASE3_STORY_WRITE_SOURCE: "prisma", PHASE3_STORY_READ_SOURCE: "prisma", PHASE3_SCENE_READ_SOURCE: "prisma" };
  assert.doesNotThrow(() => parseEnvironment(prismaFlags));
  for (const key of ["PHASE3_STORY_READ_SOURCE", "PHASE3_SCENE_READ_SOURCE"]) {
    assert.throws(() => parseEnvironment({ ...prismaFlags, [key]: "json" }));
  }
  const request = (body: string, headers: Record<string, string> = {}) => new Request("https://app.invalid/", { method: "PUT", headers: { "content-type": "application/json", ...headers }, body });
  assert.deepEqual(await readCommandJson(request('{"title":"Tiếng Việt"}')), { title: "Tiếng Việt" });
  await assert.rejects(readCommandJson(request("{")), errorStatus(400));
  await assert.rejects(readCommandJson(request("{}", { "content-type": "text/plain" })), errorStatus(400));
  // Check byte counts, both honest Content-Length and an absent/underreported header.
  const exact = '"' + "a".repeat(MAX_COMMAND_BODY_BYTES - 2) + '"';
  assert.equal((await readCommandJson(request(exact)) as string).length, MAX_COMMAND_BODY_BYTES - 2);
  const lengths: Record<string, string>[] = [{}, { "content-length": "1" }, { "content-length": String(MAX_COMMAND_BODY_BYTES + 1) }];
  for (const headers of lengths) {
    await assert.rejects(readCommandJson(request('"' + "é".repeat(MAX_COMMAND_BODY_BYTES / 2) + '"', headers)), errorStatus(413));
  }
  for (const status of [400, 401, 403, 404, 409, 413, 429, 503] as const) {
    const response = commandFailure(new CommandError(status, "TEST_ERROR", "Safe message"));
    assert.equal(response.status, status);
    assert.deepEqual(await response.json(), { error: { code: "TEST_ERROR", message: "Safe message" } });
    assert.equal(response.headers.get("cache-control"), "private, no-store");
  }
  assert.throws(() => mapCommandDatabaseError({ code: "P2034", message: "PRIVATE_SQL" }), errorStatus(409));
  assert.throws(() => commandResponse(z.string(), { data: { internalId: "private" }, meta: { updatedAt: new Date().toISOString() } }));
  console.log("story-command.test.ts: guards, byline, strict input/output, flags, JSON and byte-limit/error boundaries passed");
}
