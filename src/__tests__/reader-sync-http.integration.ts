import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { once } from "node:events";
import { createServer } from "node:net";
import { resolve } from "node:path";
import { loadEnvConfig } from "@next/env";
import { DEFAULT_READER_SETTINGS } from "@/lib/reader-state/settings";
import type { ReaderOperation, ReaderState } from "@/lib/reader-state/schema";
import { createReaderSyncFixture } from "./fixtures/reader-sync-fixtures";

loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production");
let stage = "connect";
async function availablePort() {
  const listener = createServer(); listener.listen(0, "127.0.0.1"); await once(listener, "listening");
  const address = listener.address(); assert.ok(address && typeof address !== "string");
  await new Promise<void>((done) => listener.close(() => done())); return address.port;
}
async function run() {
  const { prisma } = await import("@/lib/db/prisma");
  let fixture: Awaited<ReturnType<typeof createReaderSyncFixture>> | undefined;
  let server: ChildProcess | undefined;
  try {
    fixture = await createReaderSyncFixture(prisma);
    const f = fixture;
    const tokens = f.users.map(() => randomUUID());
    for (const [index, userId] of f.users.entries()) await prisma.session.create({ data: { userId, sessionToken: tokens[index], expires: new Date(Date.now() + 1_800_000) } });
    const expired = randomUUID();
    await prisma.session.create({ data: { userId: f.users[0], sessionToken: expired, expires: new Date(Date.now() - 1000) } });
    const port = await availablePort(), origin = `http://localhost:${port}`;
    stage = "server startup";
    server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--port", String(port)], {
      windowsHide: true, stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, NODE_ENV: "production", AUTH_URL: origin,
        AUTH_SECRET: randomBytes(32).toString("base64"), AUTH_GOOGLE_ID: "sync-fixture", AUTH_GOOGLE_SECRET: "sync-fixture",
        AUTH_GITHUB_ID: "sync-fixture", AUTH_GITHUB_SECRET: "sync-fixture", PHASE3_STORY_READ_SOURCE: "prisma", PHASE3_SCENE_READ_SOURCE: "prisma",
        PHASE3_STORY_WRITE_SOURCE: "json", PHASE3_SHADOW_READ: "false" },
    });
    let leaked = false;
    const secrets = [process.env.DATABASE_URL, process.env.DIRECT_URL, ...tokens, expired].filter((value): value is string => Boolean(value));
    const inspect = (chunk: Buffer) => { if (secrets.some((value) => chunk.toString().includes(value))) leaked = true; };
    server.stdout?.on("data", inspect); server.stderr?.on("data", inspect);
    const request = (path: string, init: RequestInit = {}) => fetch(`${origin}${path}`, { ...init, redirect: "manual", signal: AbortSignal.timeout(45_000) });
    let ready = false;
    for (let attempt = 0; attempt < 60; attempt++) {
      try { if ((await request("/api/auth/session")).status === 200) { ready = true; break; } } catch { /* Await child startup. */ }
      await new Promise((done) => setTimeout(done, 500));
    }
    assert.ok(ready);
    const headers = (index = 0) => ({ cookie: `authjs.session-token=${tokens[index]}`, "x-reader-user": f.users[index], origin, "content-type": "application/json" });
    const endpoint = "/api/reader-state";
    const guest = { settings: { ...DEFAULT_READER_SETTINGS, reduced_motion: true, theme: "sepia" },
      progress: [{ story_id: f.slug(), chapter_id: f.chapter(), block_id: f.block(), status: "reading", updated_at: "2026-09-08T01:00:00.000Z" }],
      bookmarks: [{ story_id: f.slug(), created_at: "2026-09-08T01:00:00.000Z" }] };
    stage = "guest / forged / expired sessions";
    for (const token of [undefined, "forged", expired]) for (const method of ["GET", "POST", "PATCH"]) {
      const response = await request(endpoint, { method, headers: token ? { cookie: `authjs.session-token=${token}` } : {} });
      assert.equal(response.status, 401); assert.equal((await response.json()).error.code, "UNAUTHENTICATED");
    }
    stage = "origin / payload / actor validation";
    assert.equal((await request(endpoint, { method: "POST", headers: { ...headers(), origin: "https://untrusted.invalid" }, body: "{}" })).status, 403);
    assert.equal((await request(endpoint, { method: "POST", headers: headers(), body: "invalid-json" })).status, 400);
    assert.equal((await request(endpoint, { method: "POST", headers: headers(), body: JSON.stringify({ expectedUserId: f.users[0], guest, userId: f.users[1] }) })).status, 400);
    assert.equal((await request(endpoint, { method: "POST", headers: headers(), body: JSON.stringify({ expectedUserId: f.users[0], guest: { ...guest, settings: { ...guest.settings, reduced_motion: "false" } } }) })).status, 400);
    assert.equal((await request(endpoint, { method: "POST", headers: headers(), body: "x".repeat(4_000_001) })).status, 413);
    stage = "first login with content writes disabled";
    const initial = await request(endpoint, { headers: headers() });
    assert.equal(initial.headers.get("cache-control"), "private, no-store"); assert.equal((await initial.json()).data, null);
    let response = await request(endpoint, { method: "POST", headers: headers(), body: JSON.stringify({ expectedUserId: f.users[0], guest }) });
    assert.equal(response.status, 200);
    let snapshot = (await response.json()).data as ReaderState;
    assert.equal(snapshot.settings.reduced_motion, true); assert.equal(snapshot.progress.length, 1); assert.equal(snapshot.bookmarks.length, 1);
    const mutate = (value: ReaderState, operation: ReaderOperation, index = 0) => request(endpoint, { method: "PATCH", headers: headers(index), body: JSON.stringify({ expectedUserId: value.userId, expectedUpdatedAt: value.updatedAt, operation }) });
    const old = snapshot;
    response = await mutate(snapshot, { kind: "bookmark", storyId: f.slug(), saved: false }); assert.equal(response.status, 200);
    snapshot = (await response.json()).data;
    assert.equal(snapshot.bookmarks.length, 0); assert.equal(snapshot.progress.length, 1);
    response = await mutate(old, { kind: "settings", patch: { theme: "dark" } }); assert.equal(response.status, 409);
    stage = "second device / empty DB wins";
    response = await request(endpoint, { method: "POST", headers: headers(), body: JSON.stringify({ expectedUserId: f.users[0], guest }) });
    snapshot = (await response.json()).data;
    assert.equal(snapshot.bookmarks.length, 0);
    stage = "account switch race / no actor spoofing";
    response = await mutate(snapshot, { kind: "settings", patch: { theme: "light" } }, 1);
    assert.equal(response.status, 409); assert.equal((await response.json()).error.code, "ACCOUNT_CHANGED");
    response = await request(endpoint, { headers: { ...headers(1), "x-reader-user": f.users[0] } }); assert.equal(response.status, 409);
    response = await request(endpoint, { method: "POST", headers: headers(1), body: JSON.stringify({ expectedUserId: f.users[1], guest: { settings: DEFAULT_READER_SETTINGS, bookmarks: [], progress: [] } }) });
    assert.equal(response.status, 200); assert.deepEqual((await response.json()).data.bookmarks, []);
    assert.equal(await prisma.userSettings.count({ where: { userId: f.users[1], theme: "light" } }), 0);
    stage = "chapter membership / invalid block";
    response = await mutate(snapshot, { kind: "progress", progress: { story_id: f.slug(), chapter_id: f.chapter(1), block_id: f.block(1), status: "reading" } });
    assert.equal(response.status, 404);
    response = await mutate(snapshot, { kind: "progress", progress: { story_id: f.slug(), chapter_id: f.chapter(), block_id: "missing-block", status: "reading" } });
    assert.equal(response.status, 404);
    assert.equal((await (await request(endpoint, { headers: headers() })).json()).data.updatedAt, snapshot.updatedAt);
    if (process.env.P3_08_PLAYWRIGHT_MODULE) {
      stage = "browser lifecycle";
      const { runP308BrowserSmoke } = await import(resolve("scripts/p3-08-browser-smoke.cjs"));
      await runP308BrowserSmoke({ origin, storyId: f.slug(), chapterId: f.chapter(), blockIds: Array.from({ length: 5 }, (_, block) => f.block(0, 0, block)),
        tokens: tokens.slice(0, 3), users: f.users.slice(0, 3), renewSession: async (index: number) => {
          const token = randomUUID(); secrets.push(token);
          await prisma.session.create({ data: { userId: f.users[index], sessionToken: token, expires: new Date(Date.now() + 1_800_000) } });
          return token;
        } });
    }
    stage = "stale content HTTP";
    await prisma.chapter.update({ where: { id: f.chapter() }, data: { status: "DRAFT" } });
    snapshot = (await (await request(endpoint, { headers: headers() })).json()).data;
    assert.deepEqual(snapshot.progress, []);
    response = await mutate(snapshot, { kind: "progress", progress: { story_id: f.slug(), chapter_id: f.chapter(), block_id: f.block(), status: "reading" } });
    assert.equal(response.status, 404);
    assert.equal(leaked, false);
    console.log("P3-08 HTTP: session/origin/validation, bootstrap, account race, revisions and stale content passed");
  } finally {
    if (server && server.exitCode === null) { server.kill(); await Promise.race([once(server, "exit"), new Promise((done) => setTimeout(done, 5000))]); }
    await fixture?.cleanup(); await prisma.$disconnect();
  }
}
run().catch((error: unknown) => {
  console.error(`P3-08 HTTP failed at: ${stage}`);
  if (error instanceof Error) {
    const line = error.stack?.split("\n").find((entry) => entry.includes("reader-sync-http.integration.ts:"));
    if (line) console.error(line.trim());
  }
  process.exitCode = 1;
});
