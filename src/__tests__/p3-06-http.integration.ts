import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { randomUUID, randomBytes } from "node:crypto";
import { createServer } from "node:net";
import { once } from "node:events";
import { loadEnvConfig } from "@next/env";
import { MAX_COMMAND_BODY_BYTES } from "@/lib/http/command-response";
import { snapshotConfig } from "./fixtures/scene-fixtures";
import { EditorSaveError, saveEditorAggregate } from "@/lib/editor/editorTransport";
import { sceneToDraft, draftToScene } from "@/lib/scenes/sceneDraft";
import { databaseJson } from "@/lib/db/json-fields";
import { resolve } from "node:path";
import { storyCoverUploadFixture } from "./fixtures/media-upload-fixtures";

loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production");
let stage = "initialize";

async function run() {
  const { prisma } = await import("@/lib/db/prisma");
  const prefix = `p3-06-http-${randomUUID()}`;
  const users = ["owner", "outsider", "admin", "blank"].map((role) => `${prefix}-${role}`);
  const tokens = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];
  let server: ChildProcess | undefined;
  let origin = "";
  let leakedSecret = false;
  let failedServer = false;
  const stop = async () => {
    if (server && server.exitCode === null) {
      const exited = once(server, "exit");
      server.kill();
      await exited;
    }
  };
  const request = (path: string, init?: RequestInit) => fetch(`${origin}${path}`, { redirect: "manual", ...init, signal: AbortSignal.timeout(40_000) });
  const headers = (actor = 0) => ({ cookie: `authjs.session-token=${tokens[actor]}`, origin, "content-type": "application/json" });
  async function start(writes: boolean) {
    const listener = createServer();
    listener.listen(0, "127.0.0.1");
    await once(listener, "listening");
    const address = listener.address();
    assert.ok(address && typeof address !== "string");
    const port = address.port;
    await new Promise<void>((resolve, reject) => listener.close((error) => error ? reject(error) : resolve()));
    origin = `http://localhost:${port}`;
    server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--port", String(port)], {
      windowsHide: true, stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env, NODE_ENV: "production", AUTH_URL: origin,
        AUTH_SECRET: randomBytes(32).toString("base64"),
        AUTH_GOOGLE_ID: "fixture", AUTH_GOOGLE_SECRET: "fixture",
        AUTH_GITHUB_ID: "fixture", AUTH_GITHUB_SECRET: "fixture",
        PHASE3_STORY_READ_SOURCE: "prisma", PHASE3_SCENE_READ_SOURCE: "prisma",
        PHASE3_STORY_WRITE_SOURCE: writes ? "prisma" : "json", PHASE3_SHADOW_READ: "false",
      },
    });
    const secrets = [process.env.DATABASE_URL, process.env.DIRECT_URL, ...tokens].filter((value): value is string => Boolean(value));
    const inspect = (chunk: Buffer) => {
      const text = chunk.toString();
      if (secrets.some((secret) => text.includes(secret))) leakedSecret = true;
      if (text.includes("COMMAND_REQUEST_FAILED")) failedServer = true;
    };
    server.stdout?.on("data", inspect);
    server.stderr?.on("data", inspect);
    for (let attempt = 0; attempt < 80; attempt++) {
      if (server.exitCode !== null) throw new Error("SERVER_START_FAILED");
      try { if ((await request("/api/auth/providers")).status === 200) return; } catch { /* Wait for startup. */ }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    throw new Error("SERVER_START_TIMEOUT");
  }
  async function json(path: string, method: string, body: unknown, status = 200, actor = 0) {
    const response = await request(path, { method, headers: headers(actor), body: JSON.stringify(body) });
    assert.equal(response.status, status);
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    const result = await response.json();
    if (status >= 400) {
      assert.deepEqual(Object.keys(result), ["error"]);
      assert.equal(typeof result.error.code, "string");
    } else {
      assert.deepEqual(Object.keys(result).sort(), ["data", "meta"]);
      assert.equal(typeof result.meta.updatedAt, "string");
    }
    return result;
  }
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
  try {
    stage = "fixtures";
    for (const [index, id] of users.entries()) {
      await prisma.user.create({ data: {
        id, email: `${id}@example.invalid`, name: index === 3 ? null : "Fixture Profile",
        role: index === 2 ? "ADMIN" : index === 1 ? "AUTHOR" : "READER",
        sessions: { create: { sessionToken: tokens[index], expires: new Date(Date.now() + 1_800_000) } },
      } });
    }
    await start(true);
    stage = "create validation and role promotion";
    const metadata = { title: "HTTP story", description: "Fixture description", genre: ["Fantasy"] };
    const ownerCover = await createCover(users[0]);
    const outsiderCover = await createCover(users[1]);
    const blankCover = await createCover(users[3]);
    const create = { metadata, coverUploadId: ownerCover.id, byline: " Hàn Mặc Tử ", chapters: [{ title: "One" }, { title: "Two" }] };
    await json("/api/stories", "POST", { ...create, actorId: users[2] }, 400);
    await json("/api/stories", "POST", { ...create, coverUploadId: blankCover.id, byline: " " }, 400, 3);
    assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: users[3] } })).role, "READER");
    assert.equal(await prisma.story.count({ where: { authorId: users[3] } }), 0);
    assert.equal((await prisma.mediaUpload.findUniqueOrThrow({ where: { id: blankCover.id } })).status, "COMPLETED");
    let created = await json("/api/stories", "POST", create, 201);
    assert.equal(created.data.author, "Hàn Mặc Tử");
    assert.equal(created.data.cover_image, ownerCover.url);
    const storyId: string = created.data.id;
    const chapterId: string = created.data.chapters[0].id;
    const secondId: string = created.data.chapters[1].id;
    const base = `/api/stories/${storyId}`;
    const chapter = `${base}/chapters/${chapterId}`;
    const editor = `${chapter}/editor`;
    const revision = (value: { meta: { updatedAt: string } }) => ({ expectedUpdatedAt: value.meta.updatedAt });
    assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: users[0] } })).role, "AUTHOR");
    assert.equal((await request(base)).status, 404, "A draft must not be publicly readable");
    const initialManage = await (await request(`${base}/manage`, { headers: headers() })).json();
    assert.equal(initialManage.data.story.id, storyId);
    assert.equal(initialManage.data.rejectionReason, null);
    assert.equal(initialManage.meta.updatedAt, created.meta.updatedAt);
    assert.equal(initialManage.data.story.chapters[0].blockCount, 0);
    assert.equal(initialManage.data.story.chapters[0].effectCount, 0);
    assert.ok(!("blocks" in initialManage.data.story.chapters[0]));
    assert.ok(!("view_count" in initialManage.data.story));
    const ownerDashboard = await (await request("/api/stories", { headers: headers() })).json();
    assert.deepEqual(ownerDashboard.data.map((item: { story: { id: string } }) => item.story.id), [storyId]);
    assert.equal(ownerDashboard.data[0].updatedAt, created.meta.updatedAt);
    assert.equal(ownerDashboard.data[0].rejectionReason, null);
    assert.ok(!("blocks" in ownerDashboard.data[0].story.chapters[0]));
    assert.equal((await request("/api/stories", { headers: headers(3) })).status, 403);

    stage = "all mutations reject unauthenticated callers";
    const mutations = [
      ["/api/stories", "POST"], [base, "PUT"], [base, "DELETE"],
      ...["submit-review", "cancel-review", "archive", "restore"].map((action) => [`${base}/${action}`, "POST"]),
      [`${base}/chapters`, "POST"], [`${base}/chapters/reorder`, "PATCH"],
      [chapter, "PUT"], [chapter, "PATCH"], [chapter, "DELETE"],
      [`${chapter}/publish`, "PATCH"], [`${chapter}/scenes`, "PUT"], [editor, "PUT"],
    ];
    for (const [path, method] of mutations) {
      const response = await request(path, { method, body: "invalid-json" });
      assert.equal(response.status, 401);
      assert.equal((await response.json()).error.code, "UNAUTHENTICATED");
    }
    stage = "ownership origin and malformed requests";
    const foreign = await json("/api/stories", "POST", { ...create, coverUploadId: outsiderCover.id }, 201, 1);
    assert.equal((await request(`${base}/manage`, { headers: headers(1) })).status, 404);
    await json(base, "PUT", { ...revision(created), metadata }, 404, 1);
    await json(`${base}/chapters/${foreign.data.chapters[0].id}`, "PATCH", { ...revision(created), title: "Swap" }, 404);
    assert.equal((await request(editor, { method: "PUT", headers: { ...headers(), origin: "https://evil.invalid" }, body: "{}" })).status, 403);
    assert.equal((await request(editor, { method: "PUT", headers: headers(), body: "{" })).status, 400);
    await json(editor, "PUT", { chapter: {}, scenes: [], revision: "legacy" }, 400);
    await json(editor, "PUT", { ...revision(created), blocks: [], scenes: [] }, 400);
    await json(editor, "PUT", { ...revision(created), blocks: [], scenes: [], actorId: users[2] }, 400);
    await json(base, "PUT", { ...revision(created), metadata: { ...metadata, cover_image: "https://untrusted.invalid/cover.png" } }, 400);
    const oversized = await request(editor, { method: "PUT", headers: headers(), body: '"' + "a".repeat(MAX_COMMAND_BODY_BYTES) + '"' });
    assert.equal(oversized.status, 413);
    assert.equal((await oversized.json()).error.code, "PAYLOAD_TOO_LARGE");

    stage = "cover claim HTTP boundaries and management list";
    const crossOwnerCover = await createCover(users[1]);
    const wrongPurposeCover = await createCover(users[0], { purpose: "personal_background" });
    const pendingCover = await createCover(users[0], { status: "pending" });
    await json(base, "PUT", { ...revision(created), coverUploadId: crossOwnerCover.id, metadata }, 404);
    await json(base, "PUT", { ...revision(created), coverUploadId: wrongPurposeCover.id, metadata }, 404);
    await json(base, "PUT", { ...revision(created), coverUploadId: pendingCover.id, metadata }, 409);
    await json(base, "PUT", { ...revision(created), coverUploadId: ownerCover.id, metadata }, 409);
    const unchangedManage = await (await request(`${base}/manage`, { headers: headers() })).json();
    assert.equal(unchangedManage.meta.updatedAt, created.meta.updatedAt);
    const replacementCover = await createCover(users[0]);
    created = await json(base, "PUT", { ...revision(created), coverUploadId: replacementCover.id, metadata });
    assert.equal(created.data.cover_image, replacementCover.url);
    assert.ok(!("view_count" in created.data));
    assert.ok(!("blocks" in created.data.chapters[0]));
    created = await json(base, "PUT", {
      ...revision(created),
      metadata: { ...metadata, cover_position: { x: 25, y: 75 } },
    });
    assert.deepEqual(created.data.cover_position, { x: 25, y: 75 });
    created = await json(base, "PUT", { ...revision(created), metadata: { ...metadata, title: "Cover and focal point preserved" } });
    assert.equal(created.data.cover_image, replacementCover.url);
    assert.deepEqual(created.data.cover_position, { x: 25, y: 75 });
    const centeredReplacement = await createCover(users[0]);
    created = await json(base, "PUT", {
      ...revision(created),
      coverUploadId: centeredReplacement.id,
      metadata: { ...metadata, title: "Replacement resets omitted focal point" },
    });
    assert.equal(created.data.cover_image, centeredReplacement.url);
    assert.equal(created.data.cover_position, undefined);

    const rejectedAt = new Date(Date.now() + 1_000);
    await prisma.story.update({
      where: { slug: foreign.data.id },
      data: { status: "REJECTED", rejectionReason: "Cần sửa phần kết", updatedAt: rejectedAt },
    });
    const outsiderDashboard = await (await request("/api/stories", { headers: headers(1) })).json();
    assert.deepEqual(outsiderDashboard.data.map((item: { story: { id: string } }) => item.story.id), [foreign.data.id]);
    assert.equal(outsiderDashboard.data[0].rejectionReason, "Cần sửa phần kết");
    assert.equal(outsiderDashboard.data[0].updatedAt, rejectedAt.toISOString());
    const adminDashboard = await (await request("/api/stories", { headers: headers(2) })).json();
    assert.deepEqual(adminDashboard.data, [], "Admin dashboard must not list other authors' stories");
    const rejectedManage = await (await request(`/api/stories/${foreign.data.id}/manage`, { headers: headers(1) })).json();
    assert.equal(rejectedManage.data.rejectionReason, "Cần sửa phần kết");
    const adminManage = await (await request(`/api/stories/${foreign.data.id}/manage`, { headers: headers(2) })).json();
    assert.equal(adminManage.data.story.id, foreign.data.id);

    stage = "editor snapshot save and conflict";
    const blocks = [{ id: `${prefix}-block`, type: "paragraph", text: "HTTP content", effects: [] }];
    const presetId = `${prefix}-preset`;
    await prisma.scenePreset.create({ data: { id: presetId, label: "Snapshot source", moodTags: [], status: "ACTIVE", renderConfig: databaseJson.presetRenderConfig.write(snapshotConfig()), sourceChecksum: "fixture" } });
    const scene = { id: `${prefix}-scene`, chapter_id: chapterId, start_block_id: blocks[0].id, end_block_id: blocks[0].id, based_on_preset_id: presetId, render_config: snapshotConfig() };
    const saved = await json(editor, "PUT", { ...revision(created), blocks, scenes: [scene] });
    assert.deepEqual(saved.data.scenes, [scene]);
    await json(editor, "PUT", { ...revision(created), blocks, scenes: [scene] }, 409);
    const textEdit = await json(chapter, "PUT", { ...revision(saved), blocks: [{ ...blocks[0], text: "New text" }] });
    // P3-07: use the exact client serializer/parser against real commands.
    await prisma.scenePreset.update({ where: { id: presetId }, data: { status: "ARCHIVED", renderConfig: databaseJson.presetRenderConfig.write({ ...snapshotConfig(), palette: { ...snapshotConfig().palette, accent: "#123456" } }) } });
    const reloaded = await (await request(editor, { headers: headers() })).json();
    assert.deepEqual(reloaded.data.scenes, [scene]);
    assert.equal(reloaded.meta.updatedAt, textEdit.meta.updatedAt);
    const roundTripped = draftToScene(sceneToDraft(reloaded.data.scenes[0]), {
      id: scene.id, chapterId, startBlockId: scene.start_block_id, endBlockId: scene.end_block_id,
    });
    const browserRequest: typeof fetch = (url, init) => {
      const requestHeaders = new Headers(init?.headers);
      for (const [key, value] of Object.entries(headers())) requestHeaders.set(key, value);
      return request(String(url), { ...init, headers: requestHeaders });
    };
    const clientSaved = await saveEditorAggregate(storyId, reloaded.data.chapter, [roundTripped], reloaded.meta.updatedAt, browserRequest);
    assert.deepEqual(clientSaved.data.scenes, [scene]);
    await assert.rejects(saveEditorAggregate(storyId, reloaded.data.chapter, [roundTripped], reloaded.meta.updatedAt, browserRequest), (error: unknown) => error instanceof EditorSaveError && error.status === 409);
    const editorPage = `/author/stories/${storyId}/${chapterId}`;
    const page = await request(editorPage, { headers: headers() });
    assert.equal(page.status, 200);
    const html = await page.text();
    assert.ok(html.includes("New text") && html.includes(scene.id) && html.includes(clientSaved.meta.updatedAt));
    assert.equal((await request(editorPage, { headers: headers(1) })).status, 404);
    assert.equal((await request(`/stories/${storyId}/${chapterId}`)).status, 404, "Draft stays private");
    // Simulate moderation fixture without adding a moderation command/UI.
    await prisma.story.update({ where: { slug: storyId }, data: { status: "PUBLISHED" } });
    await prisma.chapter.update({ where: { id: chapterId }, data: { status: "PUBLISHED" } });
    const reader = await request(`/stories/${storyId}/${chapterId}`);
    assert.equal(reader.status, 200);
    const readerHtml = await reader.text();
    assert.ok(readerHtml.includes("New text") && readerHtml.includes(scene.id));
    assert.ok(!readerHtml.includes("sceneLibrary"), "Reader bootstrap excludes catalog payload");
    assert.equal((await request(`/stories/${storyId}/${secondId}`)).status, 404, "Draft sibling stays private");
    await prisma.story.update({
      where: { slug: storyId },
      data: { coverPositionX: 25, coverPositionY: 75 },
    });
    if (process.env.P3_07_PLAYWRIGHT_MODULE) {
      const browserScript = resolve("scripts/p3-07-browser-smoke.cjs");
      const { runP307BrowserSmoke } = await import(browserScript);
      await runP307BrowserSmoke({ origin, storyId, chapterId, token: tokens[0], makeDraft: async () => {
        await prisma.story.update({ where: { slug: storyId }, data: { status: "DRAFT" } });
        await prisma.chapter.update({ where: { id: chapterId }, data: { status: "DRAFT" } });
      } });
    }
    if (process.env.P3_10_PLAYWRIGHT_MODULE) {
      const browserScript = resolve("scripts/p3-10-browser-smoke.cjs");
      const { runP310BrowserSmoke } = await import(browserScript);
      await runP310BrowserSmoke({
        origin,
        readerToken: tokens[3],
        readerCoverUploadId: blankCover.id,
        outsiderStoryId: foreign.data.id,
        adminToken: tokens[2],
        publicStoryId: storyId,
        publicCoverPosition: { x: 25, y: 75 },
      });
      assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: users[3] } })).role, "AUTHOR");
    }
    await prisma.story.update({ where: { slug: storyId }, data: { status: "DRAFT" } });
    await prisma.chapter.update({ where: { id: chapterId }, data: { status: "DRAFT" } });
    const afterSmoke = await (await request(editor, { headers: headers() })).json();
    await json(`${chapter}/scenes`, "PUT", { ...revision(afterSmoke), scenes: [scene, { ...scene, id: `${prefix}-overlap` }] }, 400);
    created = await json(`${base}/submit-review`, "POST", revision(afterSmoke));
    assert.equal(created.data.status, "pending_review");
    await json(editor, "PUT", { ...revision(created), blocks, scenes: [scene] }, 409);
    const adminEdit = await json(base, "PUT", { ...revision(created), metadata: { ...metadata, title: "Admin edit" } }, 200, 2);
    assert.equal(adminEdit.data.author, "Hàn Mặc Tử");
    created = await json(`${base}/cancel-review`, "POST", revision(adminEdit));

    stage = "chapter endpoints";
    const insertedChapter = await json(`${base}/chapters`, "POST", {
      ...revision(created),
      title: "Inserted after first",
      afterChapterId: chapterId,
    }, 201);
    assert.equal(insertedChapter.data.order, 2);
    assert.deepEqual(
      { blockCount: insertedChapter.data.blockCount, effectCount: insertedChapter.data.effectCount },
      { blockCount: 0, effectCount: 0 },
    );
    assert.ok(!("blocks" in insertedChapter.data));
    const afterInsertion = await (await request(`${base}/manage`, { headers: headers() })).json();
    assert.deepEqual(afterInsertion.data.story.chapters.map((item: { id: string }) => item.id), [
      chapterId,
      insertedChapter.data.id,
      secondId,
    ]);
    await json(`${base}/chapters`, "POST", {
      ...revision(insertedChapter),
      title: "Foreign anchor",
      afterChapterId: foreign.data.chapters[0].id,
    }, 404);
    const newChapter = await json(`${base}/chapters`, "POST", { ...revision(insertedChapter), title: "Three" }, 201);
    const reordered = await json(`${base}/chapters/reorder`, "PATCH", { ...revision(newChapter), chapterIds: [secondId, chapterId, insertedChapter.data.id, newChapter.data.id] });
    assert.ok(reordered.data.every((item: Record<string, unknown>) => Object.keys(item).sort().join(",") === "id,order"));
    const renamed = await json(chapter, "PATCH", { ...revision(reordered), title: "Renamed" });
    assert.ok(!("blocks" in renamed.data));
    const published = await json(`${chapter}/publish`, "PATCH", { ...revision(renamed), status: "published" });
    assert.ok(!("blocks" in published.data));
    const removed = await json(`${base}/chapters/${newChapter.data.id}`, "DELETE", revision(published));
    assert.equal(removed.data, null);
    const sceneRemoved = await json(`${chapter}/scenes`, "PUT", { ...revision(removed), scenes: [] });
    assert.deepEqual(sceneRemoved.data, []);

    stage = "story DELETE HTTP state, authorization and cleanup";
    const deleteCover = await createCover(users[1]);
    const disposable = await json("/api/stories", "POST", {
      ...create,
      coverUploadId: deleteCover.id,
      metadata: { ...metadata, title: "HTTP disposable" },
      chapters: [{ title: "Disposable" }],
    }, 201, 1);
    const disposableChapterId: string = disposable.data.chapters[0].id;
    const disposableRow = await prisma.story.findUniqueOrThrow({ where: { slug: disposable.data.id } });
    const disposableBlockId = `${prefix}-disposable-block`;
    await prisma.storyBlock.create({ data: {
      id: disposableBlockId, chapterId: disposableChapterId, type: "paragraph", text: "Disposable", order: 0,
      effects: { create: { id: `${prefix}-disposable-effect`, type: "particle_rain", category: "visual", intensity: 0.5, durationMs: 1000 } },
    } });
    await prisma.scene.create({ data: {
      id: `${prefix}-disposable-scene`, chapterId: disposableChapterId,
      startBlockId: disposableBlockId, endBlockId: disposableBlockId,
      renderConfig: databaseJson.sceneRenderConfig.write(snapshotConfig()),
    } });
    await prisma.bookmark.create({ data: { userId: users[0], storyId: disposableRow.id } });
    await prisma.readingProgress.create({ data: {
      userId: users[0], storyId: disposableRow.id, chapterId: disposableChapterId, blockId: disposableBlockId,
    } });
    await prisma.story.update({
      where: { id: disposableRow.id },
      data: { status: "PUBLISHED", updatedAt: new Date(Date.now() + 2_000) },
    });
    const publishedDisposable = await (await request(`/api/stories/${disposable.data.id}/manage`, { headers: headers(1) })).json();
    await json(`/api/stories/${disposable.data.id}`, "DELETE", revision(publishedDisposable), 409, 1);
    await prisma.story.update({
      where: { id: disposableRow.id },
      data: { status: "ARCHIVED", updatedAt: new Date(Date.now() + 3_000) },
    });
    const archivedDisposable = await (await request(`/api/stories/${disposable.data.id}/manage`, { headers: headers(1) })).json();
    await json(`/api/stories/${disposable.data.id}`, "DELETE", revision(archivedDisposable), 404);
    await json(`/api/stories/${disposable.data.id}`, "DELETE", revision(publishedDisposable), 409, 2);
    const deleted = await json(`/api/stories/${disposable.data.id}`, "DELETE", revision(archivedDisposable), 200, 2);
    assert.equal(deleted.data, null);
    assert.equal(await prisma.story.count({ where: { id: disposableRow.id } }), 0);
    assert.equal(await prisma.chapter.count({ where: { storyId: disposableRow.id } }), 0);
    assert.equal(await prisma.storyBlock.count({ where: { id: disposableBlockId } }), 0);
    assert.equal(await prisma.effect.count({ where: { id: `${prefix}-disposable-effect` } }), 0);
    assert.equal(await prisma.scene.count({ where: { id: `${prefix}-disposable-scene` } }), 0);
    assert.equal(await prisma.bookmark.count({ where: { storyId: disposableRow.id } }), 0);
    assert.equal(await prisma.readingProgress.count({ where: { storyId: disposableRow.id } }), 0);
    assert.equal((await prisma.mediaUpload.findUniqueOrThrow({ where: { id: deleteCover.id } })).status, "CLAIMED");

    stage = "write-off flag rejects both new and former editor writes";
    await stop();
    const before = await prisma.story.findUniqueOrThrow({ where: { slug: storyId } });
    const beforeCount = await prisma.story.count({ where: { authorId: { in: users } } });
    await start(false);
    await json(editor, "PUT", { ...revision(sceneRemoved), blocks, scenes: [] }, 503);
    await json(base, "PUT", { ...revision(sceneRemoved), metadata }, 503);
    await json("/api/stories", "POST", create, 503);
    await json(base, "PUT", { ...revision(sceneRemoved), metadata }, 404, 1);
    assert.equal((await prisma.story.findUniqueOrThrow({ where: { slug: storyId } })).updatedAt.toISOString(), before.updatedAt.toISOString());
    assert.equal(await prisma.story.count({ where: { authorId: { in: users } } }), beforeCount);
    assert.equal(leakedSecret, false);
    assert.equal(failedServer, false);
    console.log("P3-06/P3-10 HTTP integration passed: authenticated owner/admin guards, upload-backed cover contracts, management projections, Story DELETE cleanup, envelopes, editor/state/chapter routes, 413 and disabled-write rejection.");
    console.log("P3-07 HTTP regression passed: client save/reload, archived provenance, owner draft page, public snapshot Reader and draft sibling boundary.");
  } finally {
    await stop();
    await prisma.$transaction(async (tx) => {
      await tx.effect.deleteMany({ where: { block: { chapter: { story: { authorId: { in: users } } } } } });
      await tx.storyBlock.deleteMany({ where: { chapter: { story: { authorId: { in: users } } } } });
      await tx.bookmark.deleteMany({ where: { OR: [{ userId: { in: users } }, { story: { authorId: { in: users } } }] } });
      await tx.readingProgress.deleteMany({ where: { OR: [{ userId: { in: users } }, { story: { authorId: { in: users } } }] } });
      await tx.chapter.deleteMany({ where: { story: { authorId: { in: users } } } });
      await tx.story.deleteMany({ where: { authorId: { in: users } } });
      await tx.scenePreset.deleteMany({ where: { id: `${prefix}-preset` } });
      await tx.user.deleteMany({ where: { id: { in: users } } });
    });
    await prisma.$disconnect();
  }
}
run().catch((error: unknown) => {
  console.error(`P3-06 HTTP integration failed at: ${stage}`);
  if (error instanceof Error) {
    if (error instanceof EditorSaveError) console.error(`Client save status: ${error.status}; code: ${error.code}`);
    const line = error.stack?.split("\n").find((entry) => entry.includes("p3-06-http.integration.ts:"));
    if (line) console.error(line.trim());
  }
  process.exitCode = 1;
});
