import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { once } from "node:events";
import { createServer } from "node:net";
import { loadEnvConfig } from "@next/env";
import { buildStorySearchText } from "@/lib/search/text-search";

loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production");
let stage = "initialize";

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
  const marker = `p311h${randomUUID().replaceAll("-", "")}`;
  const users = {
    reader: `${marker}-reader`,
    author: `${marker}-author`,
    admin: `${marker}-admin`,
  };
  const tokens = {
    reader: randomUUID(),
    author: randomUUID(),
    admin: randomUUID(),
  };
  const slugs: string[] = [];
  let server: ChildProcess | undefined;
  let origin = "";
  let leakedSecret = false;
  let internalFailure = false;
  const cookie = (token: string) => `authjs.session-token=${token}`;
  const request = (path: string, init?: RequestInit) => fetch(`${origin}${path}`, {
    redirect: "manual",
    ...init,
    signal: AbortSignal.timeout(40_000),
  });
  const actorHeaders = (actor: keyof typeof tokens, requestOrigin = origin) => ({
    cookie: cookie(tokens[actor]),
    origin: requestOrigin,
    "content-type": "application/json",
  });
  const stop = async () => {
    if (server && server.exitCode === null) {
      const exited = once(server, "exit");
      server.kill();
      await exited;
    }
    server = undefined;
  };
  const start = async (writes: boolean) => {
    const port = await availablePort();
    origin = `http://localhost:${port}`;
    server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--port", String(port)], {
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        NODE_ENV: "production",
        AUTH_URL: origin,
        AUTH_SECRET: randomBytes(32).toString("base64"),
        AUTH_GOOGLE_ID: "fixture",
        AUTH_GOOGLE_SECRET: "fixture",
        AUTH_GITHUB_ID: "fixture",
        AUTH_GITHUB_SECRET: "fixture",
        PHASE3_STORY_READ_SOURCE: "prisma",
        PHASE3_SCENE_READ_SOURCE: "prisma",
        PHASE3_STORY_WRITE_SOURCE: writes ? "prisma" : "json",
        PHASE3_SHADOW_READ: "false",
      },
    });
    const secrets = [
      process.env.DATABASE_URL,
      process.env.DIRECT_URL,
      ...Object.values(tokens),
    ].filter((value): value is string => Boolean(value));
    const inspect = (chunk: Buffer) => {
      const output = chunk.toString();
      if (secrets.some((secret) => output.includes(secret))) leakedSecret = true;
      if (output.includes("COMMAND_REQUEST_FAILED")) internalFailure = true;
    };
    server.stdout?.on("data", inspect);
    server.stderr?.on("data", inspect);
    for (let attempt = 0; attempt < 100; attempt++) {
      if (server.exitCode !== null) throw new Error("SERVER_START_FAILED");
      try {
        if ((await request("/api/auth/providers")).status === 200) return;
      } catch { /* Wait for startup. */ }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    throw new Error("SERVER_START_TIMEOUT");
  };
  const readJson = async (response: Response, expectedStatus: number) => {
    assert.equal(response.status, expectedStatus);
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    const body = await response.json();
    if (expectedStatus >= 400) {
      assert.deepEqual(Object.keys(body), ["error"]);
      assert.equal(typeof body.error.code, "string");
    }
    return body;
  };
  const createStory = async (key: string, status: "DRAFT" | "PENDING_REVIEW" | "PUBLISHED", submittedAt: Date | null) => {
    const slug = `${marker}-${key}`;
    const chapterId = `${marker}-${key}-chapter`;
    const blockId = `${marker}-${key}-block`;
    const title = `${key === "approve" ? "Đêm Giông" : key} ${marker}`;
    const byline = key === "approve" ? "Nguyễn Du" : `Bút danh ${marker}`;
    const created = await prisma.story.create({
      data: {
        slug,
        authorId: users.author,
        authorDisplayName: byline,
        title,
        searchTextNormalized: buildStorySearchText(title, byline),
        description: `Mô tả private ${marker}`,
        coverUrl: "/covers/local-test.svg",
        genre: ["Kỳ ảo"],
        status,
        submittedAt,
        chapters: {
          create: {
            id: chapterId,
            title: `Chương ${key}`,
            order: 1,
            blocks: {
              create: {
                id: blockId,
                type: "paragraph",
                text: `Nội dung private ${marker} ${key}`,
                order: 1,
              },
            },
          },
        },
      },
      select: { slug: true, updatedAt: true },
    });
    slugs.push(slug);
    return { ...created, chapterId };
  };

  try {
    stage = "create HTTP fixtures";
    for (const role of ["reader", "author", "admin"] as const) {
      await prisma.user.create({ data: {
        id: users[role],
        email: `${users[role]}@example.invalid`,
        name: role,
        role: role === "admin" ? "ADMIN" : role === "author" ? "AUTHOR" : "READER",
        sessions: {
          create: {
            sessionToken: tokens[role],
            expires: new Date(Date.now() + 1_800_000),
          },
        },
      } });
    }
    const approve = await createStory("approve", "PENDING_REVIEW", new Date(Date.now() - 1_000));
    const reject = await createStory("reject", "PENDING_REVIEW", new Date(Date.now() - 2_000));
    const stale = await createStory("stale", "PENDING_REVIEW", new Date(Date.now() - 3_000));
    const draft = await createStory("draft", "DRAFT", null);
    const published = await createStory("published", "PUBLISHED", new Date(Date.now() - 4_000));

    stage = "start production server with moderation writes";
    await start(true);

    stage = "admin page shell and page guards";
    const guestPage = await request("/admin/stories?q=test");
    assert.equal(guestPage.status, 307);
    const login = new URL(guestPage.headers.get("location")!, origin);
    assert.equal(login.pathname, "/api/auth/signin");
    assert.equal(login.searchParams.get("callbackUrl"), "/admin/stories?q=test");
    const readerPage = await request("/admin/stories", { headers: { cookie: cookie(tokens.reader) } });
    assert.equal(readerPage.status, 307);
    assert.equal(new URL(readerPage.headers.get("location")!, origin).pathname, "/");
    const adminPage = await request(`/admin/stories?q=${marker}&status=all`, {
      headers: { cookie: cookie(tokens.admin) },
    });
    assert.equal(adminPage.status, 200);
    const adminHtml = await adminPage.text();
    assert.ok(adminHtml.includes("Kiểm duyệt tác phẩm"));
    assert.ok(adminHtml.includes("Duyệt truyện"));
    assert.ok(adminHtml.includes("P3-12"));
    assert.equal(adminHtml.includes("Đang đọc"), false, "Admin shell must not render AppHeader navigation");

    stage = "list API authorization, repeat params, projection and cursor";
    let response = await request("/api/admin/stories");
    assert.equal((await readJson(response, 401)).error.code, "UNAUTHENTICATED");
    response = await request("/api/admin/stories", { headers: actorHeaders("reader") });
    assert.equal((await readJson(response, 403)).error.code, "FORBIDDEN");
    response = await request(`/api/admin/stories?q=${marker}&q=ignored&status=published&status=all` , {
      headers: actorHeaders("admin"),
    });
    const repeated = await readJson(response, 200);
    assert.deepEqual(repeated.data.items.map((item: { id: string }) => item.id), [published.slug]);
    response = await request(`/api/admin/stories?q=demgiong%20nguyen%20${marker}&status=all`, {
      headers: actorHeaders("admin"),
    });
    const searched = await readJson(response, 200);
    assert.deepEqual(searched.data.items.map((item: { id: string }) => item.id), [approve.slug]);
    assert.equal(JSON.stringify(searched).includes(`Nội dung private ${marker}`), false);
    assert.deepEqual(Object.keys(searched.data.items[0]).sort(), [
      "author", "blockCount", "chapterCount", "cover_image", "effectCount", "genre",
      "id", "status", "submittedAt", "title", "updatedAt",
    ]);
    response = await request(`/api/admin/stories?q=${marker}&status=all&limit=1`, {
      headers: actorHeaders("admin"),
    });
    const firstPage = await readJson(response, 200);
    assert.equal(firstPage.data.items.length, 1);
    assert.equal(typeof firstPage.data.nextCursor, "string");
    response = await request(`/api/admin/stories?q=${marker}&status=all&limit=1&cursor=${encodeURIComponent(firstPage.data.nextCursor)}`, {
      headers: actorHeaders("admin"),
    });
    const secondPage = await readJson(response, 200);
    assert.equal(secondPage.data.items.length, 1);
    assert.notEqual(firstPage.data.items[0].id, secondPage.data.items[0].id);

    stage = "detail API and private preview boundary";
    response = await request(`/api/admin/stories/${approve.slug}`);
    assert.equal((await readJson(response, 401)).error.code, "UNAUTHENTICATED");
    response = await request(`/api/admin/stories/${approve.slug}`, { headers: actorHeaders("author") });
    assert.equal((await readJson(response, 403)).error.code, "FORBIDDEN");
    response = await request(`/api/admin/stories/${approve.slug}`, { headers: actorHeaders("admin") });
    const approveDetail = await readJson(response, 200);
    assert.deepEqual(Object.keys(approveDetail).sort(), ["data", "meta"]);
    assert.equal(approveDetail.data.authorEmail, `${users.author}@example.invalid`);
    assert.equal(approveDetail.data.description, `Mô tả private ${marker}`);
    assert.equal("effectCounts" in approveDetail.data.chapters[0], false);
    assert.equal("blocks" in approveDetail.data.chapters[0], false);
    assert.equal((await request(`/stories/${approve.slug}/${approve.chapterId}`)).status, 404);
    assert.equal((await request(`/stories/${draft.slug}/${draft.chapterId}`)).status, 404);
    const pendingPreview = await request(`/admin/stories/${approve.slug}/chapters/${approve.chapterId}/preview`, {
      headers: { cookie: cookie(tokens.admin) },
    });
    assert.equal(pendingPreview.status, 200);
    const pendingPreviewHtml = await pendingPreview.text();
    assert.ok(pendingPreviewHtml.includes(`Nội dung private ${marker} approve`));
    assert.ok(pendingPreviewHtml.includes("data-reader-header"));
    assert.ok(!pendingPreviewHtml.includes("StoryVerse · Quản trị"));
    const draftPreview = await request(`/admin/stories/${draft.slug}/chapters/${draft.chapterId}/preview`, {
      headers: { cookie: cookie(tokens.admin) },
    });
    assert.equal(draftPreview.status, 200);

    stage = "mutation authorization, origin, validation, approve/reject and 409";
    const approvePath = `/api/admin/stories/${approve.slug}/approve`;
    response = await request(approvePath, {
      method: "POST",
      headers: { origin, "content-type": "application/json" },
      body: JSON.stringify({ expectedUpdatedAt: approveDetail.meta.updatedAt }),
    });
    assert.equal((await readJson(response, 401)).error.code, "UNAUTHENTICATED");
    response = await request(approvePath, {
      method: "POST",
      headers: actorHeaders("reader"),
      body: JSON.stringify({ expectedUpdatedAt: approveDetail.meta.updatedAt }),
    });
    assert.equal((await readJson(response, 403)).error.code, "FORBIDDEN");
    response = await request(approvePath, {
      method: "POST",
      headers: actorHeaders("admin", "https://untrusted.invalid"),
      body: JSON.stringify({ expectedUpdatedAt: approveDetail.meta.updatedAt }),
    });
    assert.equal((await readJson(response, 403)).error.code, "FORBIDDEN");
    response = await request(approvePath, {
      method: "POST",
      headers: { cookie: cookie(tokens.admin), origin, "content-type": "text/plain" },
      body: "{}",
    });
    assert.equal((await readJson(response, 400)).error.code, "INVALID_CONTENT_TYPE");
    response = await request(approvePath, {
      method: "POST",
      headers: actorHeaders("admin"),
      body: "invalid-json",
    });
    assert.equal((await readJson(response, 400)).error.code, "INVALID_JSON");
    response = await request(approvePath, {
      method: "POST",
      headers: actorHeaders("admin"),
      body: JSON.stringify({ expectedUpdatedAt: approveDetail.meta.updatedAt }),
    });
    const approved = await readJson(response, 200);
    assert.equal(approved.data.status, "published");
    assert.equal((await prisma.story.findUniqueOrThrow({ where: { slug: approve.slug } })).status, "PUBLISHED");

    response = await request(`/api/admin/stories/${reject.slug}`, { headers: actorHeaders("admin") });
    const rejectDetail = await readJson(response, 200);
    response = await request(`/api/admin/stories/${reject.slug}/reject`, {
      method: "POST",
      headers: actorHeaders("admin"),
      body: JSON.stringify({ expectedUpdatedAt: rejectDetail.meta.updatedAt, reason: "  Cần sửa phần kết.  " }),
    });
    const rejected = await readJson(response, 200);
    assert.equal(rejected.data.status, "rejected");
    assert.equal((await prisma.story.findUniqueOrThrow({ where: { slug: reject.slug } })).rejectionReason, "Cần sửa phần kết.");

    response = await request(`/api/admin/stories/${stale.slug}`, { headers: actorHeaders("admin") });
    const staleDetail = await readJson(response, 200);
    await prisma.story.update({ where: { slug: stale.slug }, data: { updatedAt: new Date(Date.now() + 5_000) } });
    response = await request(`/api/admin/stories/${stale.slug}/approve`, {
      method: "POST",
      headers: actorHeaders("admin"),
      body: JSON.stringify({ expectedUpdatedAt: staleDetail.meta.updatedAt }),
    });
    assert.equal((await readJson(response, 409)).error.code, "STALE_UPDATE");
    assert.equal((await prisma.story.findUniqueOrThrow({ where: { slug: stale.slug } })).status, "PENDING_REVIEW");

    stage = "write-off ordering and no mutation";
    await stop();
    await start(false);
    const currentStale = await prisma.story.findUniqueOrThrow({ where: { slug: stale.slug } });
    response = await request(`/api/admin/stories/${stale.slug}/approve`, {
      method: "POST",
      headers: actorHeaders("admin"),
      body: "invalid-json",
    });
    assert.equal((await readJson(response, 400)).error.code, "INVALID_JSON");
    response = await request(`/api/admin/stories/${stale.slug}/approve`, {
      method: "POST",
      headers: actorHeaders("admin"),
      body: JSON.stringify({ expectedUpdatedAt: currentStale.updatedAt.toISOString() }),
    });
    assert.equal((await readJson(response, 503)).error.code, "WRITES_DISABLED");
    assert.equal((await prisma.story.findUniqueOrThrow({ where: { slug: stale.slug } })).status, "PENDING_REVIEW");
    assert.equal(leakedSecret, false);
    assert.equal(internalFailure, false);

    console.log("P3-11 moderation HTTP integration passed: shell/page guards, list/detail/cursor projections, private preview, auth/origin/validation, decisions, 409 and write-off behavior.");
  } finally {
    await stop();
    await prisma.effect.deleteMany({ where: { block: { chapter: { story: { authorId: users.author } } } } });
    await prisma.scene.deleteMany({ where: { chapter: { story: { authorId: users.author } } } });
    await prisma.storyBlock.deleteMany({ where: { chapter: { story: { authorId: users.author } } } });
    await prisma.chapter.deleteMany({ where: { story: { authorId: users.author } } });
    await prisma.story.deleteMany({ where: { slug: { in: slugs }, authorId: users.author } });
    await prisma.user.deleteMany({ where: { id: { in: Object.values(users) } } });
    await prisma.$disconnect();
  }
}

run().catch((error: unknown) => {
  console.error(`P3-11 moderation HTTP integration failed at: ${stage}`);
  if (error instanceof assert.AssertionError) console.error(error.message);
  if (error instanceof Error) {
    const line = error.stack?.split("\n").find((entry) => entry.includes("p3-11-moderation-http.integration.ts:"));
    if (line) console.error(line.trim());
  }
  process.exitCode = 1;
});
