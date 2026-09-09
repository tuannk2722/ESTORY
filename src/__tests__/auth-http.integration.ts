import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { createServer } from "node:net";
import { once } from "node:events";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production");
let stage = "initialization";
let serverError = "";

async function availablePort() {
  const listener = createServer();
  listener.listen(0, "127.0.0.1");
  await once(listener, "listening");
  const address = listener.address();
  assert.ok(address && typeof address !== "string");
  await new Promise<void>((resolve, reject) => listener.close((error) => error ? reject(error) : resolve()));
  return address.port;
}

async function run() {
  const { prisma } = await import("@/lib/db/prisma");
  const { storyRepository } = await import("@/lib/repositories");
  const [story] = await storyRepository.getAllPublic();
  assert.ok(story?.chapters[0], "HTTP smoke requires the existing public JSON seed");
  const suffix = randomUUID();
  const ids: string[] = [];
  let server: ChildProcess | undefined;
  const port = await availablePort();
  const origin = `http://localhost:${port}`;
  const fixtureSlug = `auth-http-${suffix}`;
  const fixtureChapter = `auth-http-chapter-${suffix}`;
  const editor = `/api/stories/${fixtureSlug}/chapters/${fixtureChapter}/editor`;
  const page = `/author/stories/${story.id}/${story.chapters[0].id}`;
  const tokens = { reader: randomUUID(), author: randomUUID(), admin: randomUUID(), expired: randomUUID() };
  const cookie = (token: string) => `authjs.session-token=${token}`;
  const request = (path: string, init?: RequestInit) => fetch(`${origin}${path}`, { redirect: "manual", ...init, signal: AbortSignal.timeout(20_000) });
  try {
    stage = "create disposable sessions";
    for (const role of ["READER", "AUTHOR", "ADMIN"] as const) {
      const user = await prisma.user.create({ data: { email: `http-${role}-${suffix}@example.invalid`, role } });
      ids.push(user.id);
      await prisma.session.create({ data: { userId: user.id, sessionToken: tokens[role.toLowerCase() as "reader" | "author" | "admin"], expires: new Date(Date.now() + 300_000) } });
    }
    await prisma.session.create({ data: { userId: ids[0], sessionToken: tokens.expired, expires: new Date(Date.now() - 60_000) } });
    await prisma.story.create({ data: {
      slug: fixtureSlug, authorId: ids[2], authorDisplayName: "HTTP fixture", title: "HTTP fixture",
      description: "Fixture", genre: [], chapters: { create: { id: fixtureChapter, title: "Fixture", order: 1 } },
    } });
    stage = "production server startup";
    server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--port", String(port)], {
      windowsHide: true, stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, NODE_ENV: "production", AUTH_URL: origin,
        AUTH_SECRET: randomBytes(32).toString("base64"),
        AUTH_GOOGLE_ID: "http-test-fixture", AUTH_GOOGLE_SECRET: "http-test-fixture",
        AUTH_GITHUB_ID: "http-test-fixture", AUTH_GITHUB_SECRET: "http-test-fixture",
        R2_ACCOUNT_ID: "", R2_ACCESS_KEY_ID: "", R2_SECRET_ACCESS_KEY: "",
        R2_BUCKET_NAME: "", R2_PUBLIC_BASE_URL: "", R2_KEY_PREFIX: "" },
    });
    // Inspect log markers without ever printing raw server/adapter output.
    let leakedCredential = false;
    const secrets = [process.env.DATABASE_URL, process.env.DIRECT_URL, ...Object.values(tokens)].filter((value): value is string => Boolean(value));
    const inspectLog = (data: Buffer) => {
      const output = data.toString();
      if (secrets.some((secret) => output.includes(secret))) leakedCredential = true;
      const configurationError = output.match(/(?:Missing|Invalid) server environment: [A-Z_, ]+/);
      if (configurationError) serverError = configurationError[0];
    };
    server.stdout?.on("data", inspectLog);
    server.stderr?.on("data", inspectLog);
    let ready = false;
    for (let attempt = 0; attempt < 60; attempt++) {
      if (server.exitCode !== null) throw new Error("HTTP smoke server exited before startup");
      try { if ((await request("/")).status === 200) { ready = true; break; } } catch { /* Wait for Next startup. */ }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    assert.ok(ready, "HTTP smoke server did not become ready");
    stage = "public reads and auth endpoints";
    assert.equal((await request(`/stories/${story.id}/${story.chapters[0].id}`)).status, 200);
    assert.equal((await request(`/api/stories/${story.id}`)).status, 200);
    assert.equal((await request(`/api/scenes?storyId=${story.id}&chapterId=${story.chapters[0].id}`)).status, 200);
    assert.deepEqual(Object.keys(await (await request("/api/auth/providers")).json()).sort(), ["github", "google"]);
    assert.equal((await request("/api/auth/signin")).status, 200);
    assert.equal(await (await request("/api/auth/session")).json(), null);

    stage = "proxy redirects";
    for (const path of [page, "/admin", "/author"]) {
      const response = await request(path);
      assert.equal(response.status, 307);
      const location = new URL(response.headers.get("location")!, origin);
      assert.equal(location.pathname, "/api/auth/signin");
      assert.equal(location.searchParams.get("callbackUrl"), path);
    }
    stage = "unauthenticated API guards";
    for (const token of [undefined, "forged", tokens.expired]) {
      const headers: Record<string, string> = token ? { cookie: cookie(token) } : {};
      for (const method of ["GET", "PUT"]) {
        const response = await request(editor, { method, headers, ...(method === "PUT" ? { body: "invalid-json" } : {}) });
        assert.equal(response.status, 401);
        assert.equal((await response.json()).error.code, "UNAUTHENTICATED");
      }
    }
    stage = "role and page guards";
    for (const role of ["reader", "author"] as const) {
      for (const method of ["GET", "PUT"]) {
        const response = await request(editor, { method, headers: { cookie: cookie(tokens[role]) } });
        const inaccessible = role === "author" && method === "GET";
        assert.equal(response.status, inaccessible ? 404 : 403);
        assert.equal((await response.json()).error.code, inaccessible ? "NOT_FOUND" : "FORBIDDEN");
      }
      assert.equal((await request(page, { headers: { cookie: cookie(tokens[role]) } })).status, role === "author" ? 404 : 307);
    }
    assert.equal((await request(page, { headers: { cookie: cookie("forged") } })).status, 307);
    assert.equal((await request(editor, { headers: { cookie: cookie(tokens.admin) } })).status, 200);
    // P3-07 owns the editor client bootstrap round-trip; this test checks its DAL API.
    assert.equal((await request(editor, { method: "PUT", headers: { cookie: cookie(tokens.admin), origin: "https://untrusted.invalid" }, body: "{}" })).status, 403);
    assert.equal((await request(editor, { method: "PUT", headers: { cookie: cookie(tokens.admin), origin, "content-type": "application/json" }, body: "invalid-json" })).status, 400);

    stage = "media upload route guards";
    const uploadBody = JSON.stringify({ purpose: "story_cover", file: { name: "cover.png", contentType: "image/png", size: 24 } });
    let upload = await request("/api/upload/presign", { method: "POST", headers: { origin, "content-type": "application/json" }, body: uploadBody });
    assert.equal(upload.status, 401);
    assert.equal((await upload.json()).error.code, "UNAUTHENTICATED");
    upload = await request("/api/upload/presign", { method: "POST", headers: { cookie: cookie(tokens.reader), origin: "https://untrusted.invalid", "content-type": "application/json" }, body: uploadBody });
    assert.equal(upload.status, 403);
    upload = await request("/api/upload/presign", { method: "POST", headers: { cookie: cookie(tokens.reader), origin, "content-type": "application/json" }, body: uploadBody });
    assert.equal(upload.status, 503);
    assert.equal((await upload.json()).error.code, "MEDIA_STORAGE_UNAVAILABLE");

    stage = "session freshness and projection";
    const readSession = async () => (await request("/api/auth/session", { headers: { cookie: cookie(tokens.reader) } })).json();
    let session = await readSession();
    assert.equal(session.user.id, ids[0]);
    assert.equal(session.user.role, "reader");
    assert.deepEqual(Object.keys(session).sort(), ["expires", "user"]);
    assert.deepEqual(Object.keys(session.user).sort(), ["email", "id", "image", "name", "role"]);
    await prisma.user.update({ where: { id: ids[0] }, data: { role: "ADMIN" } });
    session = await readSession();
    assert.equal(session.user.role, "admin");
    await prisma.user.update({ where: { id: ids[0] }, data: { role: "READER" } });
    stage = "CSRF and client session tampering";
    const csrf = await request("/api/auth/csrf");
    const csrfToken = (await csrf.json()).csrfToken;
    const csrfCookie = csrf.headers.getSetCookie().map((value) => value.split(";")[0]).join("; ");
    const combinedCookie = `${cookie(tokens.reader)}; ${csrfCookie}`;
    const update = await request("/api/auth/session", { method: "POST", headers: { cookie: combinedCookie, "content-type": "application/json", origin }, body: JSON.stringify({ csrfToken, data: { user: { role: "admin", id: ids[2] } } }) });
    assert.equal(update.status, 200);
    assert.equal((await update.json()).user.role, "reader", "Client session updates cannot elevate roles");
    assert.equal((await readSession()).user.id, ids[0]);
    const forgedSignout = await request("/api/auth/signout", { method: "POST", headers: { cookie: cookie(tokens.reader), "content-type": "application/x-www-form-urlencoded" }, body: "csrfToken=forged" });
    assert.equal(forgedSignout.status, 302);
    assert.ok(await prisma.session.findUnique({ where: { sessionToken: tokens.reader } }), "Invalid CSRF must not sign out the user");
    const signout = await request("/api/auth/signout", { method: "POST", headers: { cookie: combinedCookie, "content-type": "application/x-www-form-urlencoded", origin }, body: new URLSearchParams({ csrfToken, callbackUrl: "https://untrusted.invalid" }) });
    assert.equal(signout.status, 302);
    assert.equal(new URL(signout.headers.get("location")!, origin).origin, origin);
    assert.equal(await readSession(), null);
    assert.equal(leakedCredential, false, "Server logs must not contain connection strings or session tokens");
    console.log("Auth HTTP integration passed: public guest reads, providers/signin, proxy/page guards, API 401/403, admin read, origin/CSRF, session projection/fresh roles/update tampering/signout and safe logs.");
  } finally {
    if (server && server.exitCode === null) {
      const stopped = once(server, "exit");
      server.kill();
      await stopped;
    }
    await prisma.chapter.deleteMany({ where: { story: { slug: fixtureSlug, authorId: { in: ids } } } });
    await prisma.story.deleteMany({ where: { slug: fixtureSlug, authorId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await prisma.$disconnect();
  }
}

run().catch((error: unknown) => {
  // Assertion messages contain only status/shape checks, never response payloads.
  console.error(error instanceof assert.AssertionError ? `Auth HTTP assertion failed: ${error.message}` : "Auth HTTP integration failed; check database and production build.");
  console.error(`Stage: ${stage}${serverError ? `; ${serverError}` : ""}`);
  if (error instanceof Error) {
    const frame = error.stack?.split("\n").slice(1).find((line) => line.includes("auth-http.integration.ts:"));
    if (frame) console.error(frame.trim());
  }
  process.exitCode = 1;
});
