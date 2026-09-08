import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { randomUUID, randomBytes } from "node:crypto";
import { createServer } from "node:net";
import { once } from "node:events";
import { loadEnvConfig } from "@next/env";
import { MAX_COMMAND_BODY_BYTES } from "@/lib/http/command-response";
import { snapshotConfig } from "./fixtures/scene-fixtures";

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
    const metadata = { title: "HTTP story", description: "Fixture description", cover_image: "/cover.svg", genre: ["Fantasy"] };
    const create = { metadata, byline: " Hàn Mặc Tử ", chapters: [{ title: "One" }, { title: "Two" }] };
    await json("/api/stories", "POST", { ...create, actorId: users[2] }, 400);
    await json("/api/stories", "POST", { ...create, byline: " " }, 400, 3);
    assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: users[3] } })).role, "READER");
    assert.equal(await prisma.story.count({ where: { authorId: users[3] } }), 0);
    let created = await json("/api/stories", "POST", create, 201);
    assert.equal(created.data.author, "Hàn Mặc Tử");
    const storyId: string = created.data.id;
    const chapterId: string = created.data.chapters[0].id;
    const secondId: string = created.data.chapters[1].id;
    const base = `/api/stories/${storyId}`;
    const chapter = `${base}/chapters/${chapterId}`;
    const editor = `${chapter}/editor`;
    const revision = (value: { meta: { updatedAt: string } }) => ({ expectedUpdatedAt: value.meta.updatedAt });
    assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: users[0] } })).role, "AUTHOR");
    assert.equal((await request(base)).status, 404, "A draft must not be publicly readable");
    assert.equal((await request(`${base}/manage`, { headers: headers() })).status, 200);

    stage = "all mutations reject unauthenticated callers";
    const mutations = [
      ["/api/stories", "POST"], [base, "PUT"],
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
    const foreign = await json("/api/stories", "POST", create, 201, 1);
    assert.equal((await request(`${base}/manage`, { headers: headers(1) })).status, 404);
    await json(base, "PUT", { ...revision(created), metadata }, 404, 1);
    await json(`${base}/chapters/${foreign.data.chapters[0].id}`, "PATCH", { ...revision(created), title: "Swap" }, 404);
    assert.equal((await request(editor, { method: "PUT", headers: { ...headers(), origin: "https://evil.invalid" }, body: "{}" })).status, 403);
    assert.equal((await request(editor, { method: "PUT", headers: headers(), body: "{" })).status, 400);
    await json(editor, "PUT", { chapter: {}, scenes: [], revision: "legacy" }, 400);
    await json(editor, "PUT", { ...revision(created), blocks: [], scenes: [] }, 400);
    await json(editor, "PUT", { ...revision(created), blocks: [], scenes: [], actorId: users[2] }, 400);
    const oversized = await request(editor, { method: "PUT", headers: headers(), body: '"' + "a".repeat(MAX_COMMAND_BODY_BYTES) + '"' });
    assert.equal(oversized.status, 413);
    assert.equal((await oversized.json()).error.code, "PAYLOAD_TOO_LARGE");

    stage = "editor snapshot save and conflict";
    const blocks = [{ id: `${prefix}-block`, type: "paragraph", text: "HTTP content", effects: [] }];
    const scene = { id: `${prefix}-scene`, chapter_id: chapterId, start_block_id: blocks[0].id, end_block_id: blocks[0].id, render_config: snapshotConfig() };
    const saved = await json(editor, "PUT", { ...revision(created), blocks, scenes: [scene] });
    assert.deepEqual(saved.data.scenes, [scene]);
    await json(editor, "PUT", { ...revision(created), blocks, scenes: [scene] }, 409);
    const textEdit = await json(chapter, "PUT", { ...revision(saved), blocks: [{ ...blocks[0], text: "New text" }] });
    const reloaded = await (await request(editor, { headers: headers() })).json();
    assert.deepEqual(reloaded.data.scenes, [scene]);
    assert.equal(reloaded.meta.updatedAt, textEdit.meta.updatedAt);
    await json(`${chapter}/scenes`, "PUT", { ...revision(textEdit), scenes: [scene, { ...scene, id: `${prefix}-overlap` }] }, 400);
    created = await json(`${base}/submit-review`, "POST", revision(textEdit));
    assert.equal(created.data.status, "pending_review");
    await json(editor, "PUT", { ...revision(created), blocks, scenes: [scene] }, 409);
    const adminEdit = await json(base, "PUT", { ...revision(created), metadata: { ...metadata, title: "Admin edit" } }, 200, 2);
    assert.equal(adminEdit.data.author, "Hàn Mặc Tử");
    created = await json(`${base}/cancel-review`, "POST", revision(adminEdit));

    stage = "chapter endpoints";
    const newChapter = await json(`${base}/chapters`, "POST", { ...revision(created), title: "Three" }, 201);
    const reordered = await json(`${base}/chapters/reorder`, "PATCH", { ...revision(newChapter), chapterIds: [secondId, chapterId, newChapter.data.id] });
    const renamed = await json(chapter, "PATCH", { ...revision(reordered), title: "Renamed" });
    const published = await json(`${chapter}/publish`, "PATCH", { ...revision(renamed), status: "published" });
    const removed = await json(`${base}/chapters/${newChapter.data.id}`, "DELETE", revision(published));
    assert.equal(removed.data, null);
    const sceneRemoved = await json(`${chapter}/scenes`, "PUT", { ...revision(removed), scenes: [] });
    assert.deepEqual(sceneRemoved.data, []);

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
    console.log("P3-06 HTTP integration passed: every mutation authenticated, owner/admin/origin/ID guards, envelopes, byline, editor snapshot/stale update, state/chapter routes, 413 and disabled-write rejection.");
  } finally {
    await stop();
    await prisma.$transaction(async (tx) => {
      await tx.effect.deleteMany({ where: { block: { chapter: { story: { authorId: { in: users } } } } } });
      await tx.storyBlock.deleteMany({ where: { chapter: { story: { authorId: { in: users } } } } });
      await tx.chapter.deleteMany({ where: { story: { authorId: { in: users } } } });
      await tx.story.deleteMany({ where: { authorId: { in: users } } });
      await tx.user.deleteMany({ where: { id: { in: users } } });
    });
    await prisma.$disconnect();
  }
}
run().catch((error: unknown) => {
  console.error(`P3-06 HTTP integration failed at: ${stage}`);
  if (error instanceof Error) {
    const line = error.stack?.split("\n").find((entry) => entry.includes("p3-06-http.integration.ts:"));
    if (line) console.error(line.trim());
  }
  process.exitCode = 1;
});
