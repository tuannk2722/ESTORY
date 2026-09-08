import assert from "node:assert/strict";
import { z } from "zod";
import { requireStoryOwnerOrAdmin, requireChapterInStory, requireStoryMutable } from "@/lib/auth/story-policy";
import { AuthAccessError } from "@/lib/auth/policy";
import { CommandError, mapCommandDatabaseError } from "@/lib/services/command-error";
import { createStorySchema, resolveStoryByline, validateCommand, replaceEditorSchema } from "@/lib/validation/story-command-schema";
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
  const create = { actorId: "owner", metadata: { title: "Title", description: "Description", cover_image: "/cover.svg", genre: ["Fantasy"] }, chapters: [{ title: "Chapter" }] };
  validateCommand(createStorySchema, create);
  for (const invalid of [{ ...create, role: "admin" }, { ...create, byline: 123 }, { ...create, chapters: [] }, { ...create, metadata: { ...create.metadata, title: " " } }]) {
    assert.throws(() => validateCommand(createStorySchema, invalid), errorStatus(400));
  }
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
