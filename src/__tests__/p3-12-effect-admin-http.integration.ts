import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { once } from "node:events";
import { createServer } from "node:net";
import { resolve } from "node:path";
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
  const marker = `p312h${randomUUID().replaceAll("-", "")}`;
  const contentSecret = `effect-content-${randomBytes(12).toString("hex")}`;
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
  const effectId = "screen_blur" as const;
  const original = await prisma.effectDefinition.findUniqueOrThrow({ where: { effectId } });
  const createdKeywordIds = new Set<string>();
  const storySlug = `${marker}-story`;
  const chapterId = `${marker}-chapter`;
  let server: ChildProcess | undefined;
  let origin = "";
  let serverOutput = "";
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

  try {
    stage = "create HTTP fixtures";
    for (const role of ["reader", "author", "admin"] as const) {
      await prisma.user.create({ data: {
        id: users[role],
        email: `${users[role]}@example.invalid`,
        name: role,
        role: role === "admin" ? "ADMIN" : role === "author" ? "AUTHOR" : "READER",
        sessions: { create: { sessionToken: tokens[role], expires: new Date(Date.now() + 1_800_000) } },
      } });
    }
    await prisma.story.create({ data: {
      slug: storySlug,
      authorId: users.author,
      authorDisplayName: "P3-12 Author",
      title: `P3-12 aggregate ${marker}`,
      searchTextNormalized: buildStorySearchText(`P3-12 aggregate ${marker}`, "P3-12 Author"),
      description: "Effect aggregate fixture",
      coverUrl: "/covers/local-test.svg",
      genre: ["Kỳ ảo"],
      status: "DRAFT",
      chapters: { create: { id: chapterId, title: "Chapter", order: 1 } },
    } });

    stage = "start production server";
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
        PHASE3_STORY_WRITE_SOURCE: "prisma",
        PHASE3_SHADOW_READ: "false",
      },
    });
    const inspect = (chunk: Buffer) => { serverOutput += chunk.toString(); };
    server.stdout?.on("data", inspect);
    server.stderr?.on("data", inspect);
    for (let attempt = 0; attempt < 100; attempt++) {
      if (server.exitCode !== null) throw new Error("SERVER_START_FAILED");
      try {
        if ((await request("/api/auth/providers")).status === 200) break;
      } catch { /* Wait for startup. */ }
      await new Promise((resolve) => setTimeout(resolve, 250));
      if (attempt === 99) throw new Error("SERVER_START_TIMEOUT");
    }

    stage = "page and list authorization";
    const guestPage = await request("/admin/effects?q=rain");
    assert.equal(guestPage.status, 307);
    const login = new URL(guestPage.headers.get("location")!, origin);
    assert.equal(login.pathname, "/api/auth/signin");
    assert.equal(login.searchParams.get("callbackUrl"), "/admin/effects?q=rain");
    const readerPage = await request("/admin/effects", { headers: { cookie: cookie(tokens.reader) } });
    assert.equal(readerPage.status, 307);
    const adminPage = await request("/admin/effects", { headers: { cookie: cookie(tokens.admin) } });
    assert.equal(adminPage.status, 200);
    const adminHtml = await adminPage.text();
    assert.ok(adminHtml.includes("Thư viện hiệu ứng"));
    assert.equal(adminHtml.includes("Create Effect"), false);

    let response = await request("/api/admin/effects");
    assert.equal((await readJson(response, 401)).error.code, "UNAUTHENTICATED");
    response = await request("/api/admin/effects", { headers: actorHeaders("author") });
    assert.equal((await readJson(response, 403)).error.code, "FORBIDDEN");
    response = await request(`/api/admin/effects?q=screen%20blur&category=visual&status=all`, {
      headers: actorHeaders("admin"),
    });
    const listed = await readJson(response, 200);
    assert.deepEqual(listed.data.items.map((item: { id: string }) => item.id), [effectId]);
    assert.equal(listed.data.items[0].category, "visual");
    assert.equal(listed.data.capabilities.canCreateEffect, false);
    assert.equal(listed.data.capabilities.canEditTechnicalFields, false);

    stage = "author catalog and single editor aggregate";
    response = await request("/api/effect-catalog", { headers: actorHeaders("reader") });
    assert.equal((await readJson(response, 403)).error.code, "FORBIDDEN");
    response = await request("/api/effect-catalog", { headers: actorHeaders("author") });
    const authorCatalog = await readJson(response, 200);
    assert.ok(authorCatalog.data.effects.some((effect: { id: string }) => effect.id === effectId));
    response = await request(`/api/stories/${storySlug}/chapters/${chapterId}/editor`, {
      headers: actorHeaders("author"),
    });
    const editor = await readJson(response, 200);
    assert.deepEqual(Object.keys(editor.data).sort(), ["chapter", "effectCatalog", "scenes"]);
    assert.ok(Array.isArray(editor.data.effectCatalog.effects));
    assert.ok(Array.isArray(editor.data.effectCatalog.keywords));
    const audioDefinition = editor.data.effectCatalog.effects.find((entry: { id: string }) => entry.id === "audio");
    assert.ok(audioDefinition?.is_active);
    assert.equal("created_at" in audioDefinition, false);
    assert.equal("updated_at" in audioDefinition, false);

    stage = "audio admin mutations are rejected";
    for (const [path, method, body] of [
      ["/api/admin/effects", "PATCH", { effectId: "audio", label: "Forbidden audio", description: "", isActive: false, expectedUpdatedAt: original.updatedAt.toISOString() }],
      ["/api/admin/effects/audio/keywords", "POST", { keyword: "audio", weight: 50, expectedUpdatedAt: original.updatedAt.toISOString() }],
      ["/api/admin/effects/audio/keywords", "PATCH", { keywordId: "legacy", keyword: "audio", weight: 50, expectedUpdatedAt: original.updatedAt.toISOString() }],
      ["/api/admin/effects/audio/keywords", "DELETE", { keywordId: "legacy", expectedUpdatedAt: original.updatedAt.toISOString() }],
    ] as const) {
      response = await request(path, { method, headers: actorHeaders("admin"), body: JSON.stringify(body) });
      assert.equal((await readJson(response, 400)).error.code, "VALIDATION_ERROR");
    }

    stage = "audio block, scene and aggregate persistence";
    const audio = { id: `${marker}-block-audio`, type: "audio", category: "audio", audio_src: "/audio/gentle_rain_falling.mp3", intensity: 0.6, duration_ms: 1500, loop: false };
    const blocks = [{ id: `${marker}-block`, type: "paragraph", text: "Audio snapshot fixture", effects: [audio] }];
    const scene = {
      id: `${marker}-scene`, chapter_id: chapterId, start_block_id: blocks[0].id, end_block_id: blocks[0].id,
      render_config: {
        schema_version: 1,
        background: { motion: "static", render_data: { kind: "image", media_url: "/covers/local-test.svg" } },
        palette: { primary: "#ffffff", secondary: "#eeeeee", accent: "#cccccc", background_tint: { color: "#000000", opacity: 0.2 } },
        ambient_effects: [{ ...audio, id: `${marker}-scene-audio`, loop: true }],
      },
    };
    const chapterPath = `/api/stories/${storySlug}/chapters/${chapterId}`;
    let revision: string = editor.meta.updatedAt;
    const saveAudio = async (suffix: string, body: object, expectedStatus = 200) => {
      const result = await readJson(await request(chapterPath + suffix, {
        method: "PUT", headers: actorHeaders("author"), body: JSON.stringify({ ...body, expectedUpdatedAt: revision }),
      }), expectedStatus);
      if (expectedStatus === 200) revision = result.meta.updatedAt;
      return result;
    };
    await saveAudio("", { blocks });
    await saveAudio("/scenes", { scenes: [scene] });
    const savedAudio = await saveAudio("/editor", { blocks, scenes: [scene] });
    assert.deepEqual(savedAudio.data.chapter.blocks, blocks);
    assert.deepEqual(savedAudio.data.scenes, [scene]);
    assert.equal((await prisma.effect.findUniqueOrThrow({ where: { id: audio.id } })).audioSrc, audio.audio_src);
    await saveAudio("/scenes", { scenes: [{ ...scene, render_config: { ...scene.render_config, ambient_effects: [{ ...scene.render_config.ambient_effects[0], loop: false }] } }] }, 400);
    await saveAudio("", { blocks: [{ ...blocks[0], effects: [{ ...audio, audio_src: "javascript:alert(1)" }] }] }, 400);
    const ownAsset = await prisma.audioAsset.create({ data: { ownerId: users.author, source: "upload", title: "Own audio", url: "/audio/own-test.mp3", durationMs: 1000 } });
    const foreignAsset = await prisma.audioAsset.create({ data: { ownerId: users.admin, source: "upload", title: "Foreign audio", url: "/audio/foreign-test.mp3", durationMs: 1000 } });
    await saveAudio("", { blocks: [{ ...blocks[0], effects: [{ ...audio, audio_asset_id: foreignAsset.id, audio_src: foreignAsset.url }] }] }, 404);
    await saveAudio("", { blocks: [{ ...blocks[0], effects: [{ ...audio, audio_asset_id: ownAsset.id, audio_src: foreignAsset.url }] }] }, 404);
    await saveAudio("", { blocks: [{ ...blocks[0], effects: [{ ...audio, audio_asset_id: ownAsset.id, audio_src: ownAsset.url }] }] });
    // Restore built-in source before browser testing the real editor.
    await saveAudio("/editor", { blocks, scenes: [scene] });

    if (process.env.P3_12_PLAYWRIGHT_MODULE) {
      stage = "browser smoke";
      const browserKeyword = await prisma.effectKeywordSuggestion.create({ data: {
        effectId,
        keyword: `${marker} browser`,
        normalizedKeyword: `${marker} browser`,
        weight: 50,
      } });
      createdKeywordIds.add(browserKeyword.id);
      const sceneKeyword = await prisma.effectKeywordSuggestion.create({ data: {
        effectId: "particle_rain", keyword: `${marker} ambient`, normalizedKeyword: `${marker} ambient`, weight: 1,
      } });
      createdKeywordIds.add(sceneKeyword.id);
      const rain = await prisma.effectDefinition.findUniqueOrThrow({ where: { effectId: "particle_rain" } });
      assert.ok(rain.isActive, "Browser fixture needs active rain for scene search");
      const { runP312BrowserSmoke } = await import(resolve("scripts/p3-12-browser-smoke.cjs"));
      await runP312BrowserSmoke({ origin, adminToken: tokens.admin, effectId, authorToken: tokens.author,
        editorPath: `/author/stories/${storySlug}/${chapterId}`, keywordQuery: browserKeyword.keyword,
        sceneKeywordQuery: sceneKeyword.keyword, effectLabel: original.label, sceneEffectLabel: rain.label });
    }

    stage = "origin, strict mutation and inactive projection";
    response = await request("/api/admin/effects", {
      method: "PATCH",
      headers: actorHeaders("admin", "https://untrusted.invalid"),
      body: JSON.stringify({
        effectId,
        label: contentSecret,
        description: contentSecret,
        isActive: false,
        expectedUpdatedAt: original.updatedAt.toISOString(),
      }),
    });
    assert.equal((await readJson(response, 403)).error.code, "FORBIDDEN");
    response = await request("/api/admin/effects", {
      method: "PATCH",
      headers: actorHeaders("admin"),
      body: JSON.stringify({
        effectId,
        label: contentSecret,
        description: contentSecret,
        isActive: false,
        expectedUpdatedAt: original.updatedAt.toISOString(),
        category: "audio",
      }),
    });
    assert.equal((await readJson(response, 400)).error.code, "VALIDATION_ERROR");
    response = await request("/api/admin/effects", {
      method: "PATCH",
      headers: actorHeaders("admin"),
      body: JSON.stringify({
        effectId,
        label: contentSecret,
        description: contentSecret,
        isActive: false,
        expectedUpdatedAt: original.updatedAt.toISOString(),
      }),
    });
    const disabled = await readJson(response, 200);
    assert.equal(disabled.data.is_active, false);
    response = await request("/api/effect-catalog", { headers: actorHeaders("author") });
    const disabledCatalog = await readJson(response, 200);
    assert.equal(disabledCatalog.data.effects.some((effect: { id: string }) => effect.id === effectId), false);
    assert.equal(disabledCatalog.data.keywords.some((entry: { effect_id: string }) => entry.effect_id === effectId), false);

    stage = "keyword CRUD, duplicate and stale revision";
    const keywordPath = `/api/admin/effects/${effectId}/keywords`;
    response = await request(keywordPath, {
      method: "POST",
      headers: actorHeaders("admin"),
      body: JSON.stringify({ keyword: `MƯA ${contentSecret}`, weight: 64, expectedUpdatedAt: disabled.meta.updatedAt }),
    });
    const created = await readJson(response, 201);
    const keyword = created.data.keywords.find((entry: { keyword: string }) => entry.keyword.includes(contentSecret));
    assert.ok(keyword);
    createdKeywordIds.add(keyword.id);
    const keywordFound = await readJson(await request(`/api/admin/effects?q=${encodeURIComponent(`mua ${contentSecret}`)}&status=inactive`, { headers: actorHeaders("admin") }), 200);
    assert.deepEqual(keywordFound.data.items.map((entry: { id: string }) => entry.id), [effectId]);
    response = await request(keywordPath, {
      method: "POST",
      headers: actorHeaders("admin"),
      body: JSON.stringify({ keyword: `  ｍưa   ${contentSecret} `, weight: 80, expectedUpdatedAt: created.meta.updatedAt }),
    });
    assert.equal((await readJson(response, 409)).error.code, "DUPLICATE_EFFECT_KEYWORD");
    response = await request(keywordPath, {
      method: "PATCH",
      headers: actorHeaders("admin"),
      body: JSON.stringify({
        keywordId: keyword.id,
        keyword: `Updated ${contentSecret}`,
        weight: 78,
        expectedUpdatedAt: created.meta.updatedAt,
      }),
    });
    const updated = await readJson(response, 200);
    assert.equal(updated.data.keywords.find((entry: { id: string }) => entry.id === keyword.id).weight, 78);
    response = await request(keywordPath, {
      method: "DELETE",
      headers: actorHeaders("admin"),
      body: JSON.stringify({ keywordId: keyword.id, expectedUpdatedAt: created.meta.updatedAt }),
    });
    assert.equal((await readJson(response, 409)).error.code, "STALE_UPDATE");
    response = await request(keywordPath, {
      method: "DELETE",
      headers: actorHeaders("admin"),
      body: JSON.stringify({ keywordId: keyword.id, expectedUpdatedAt: updated.meta.updatedAt }),
    });
    const deleted = await readJson(response, 200);
    createdKeywordIds.delete(keyword.id);
    assert.equal(deleted.data.keywords.some((entry: { id: string }) => entry.id === keyword.id), false);

    stage = "clear description through route and service validation";
    response = await request("/api/admin/effects", {
      method: "PATCH",
      headers: actorHeaders("admin"),
      body: JSON.stringify({
        effectId,
        label: contentSecret,
        description: "   ",
        isActive: false,
        expectedUpdatedAt: deleted.meta.updatedAt,
      }),
    });
    const cleared = await readJson(response, 200);
    assert.equal(cleared.data.description, undefined);
    assert.equal((await prisma.effectDefinition.findUniqueOrThrow({ where: { effectId } })).description, null);

    await new Promise((resolve) => setTimeout(resolve, 100));
    assert.equal(serverOutput.includes(contentSecret), false, "Structured audit and error logs must exclude mutable content");
    for (const secret of [process.env.DATABASE_URL, process.env.DIRECT_URL, ...Object.values(tokens)]) {
      if (secret) assert.equal(serverOutput.includes(secret), false, "Server output must not expose credentials or session tokens");
    }
    assert.equal(serverOutput.includes("COMMAND_REQUEST_FAILED"), false);
    assert.ok(serverOutput.includes("effect_admin_mutation"));
    console.log("P3-12 Effect Admin HTTP integration passed: page/API guards, strict writes/origin, author aggregate, active filtering, keyword CRUD/duplicate/stale and safe logs.");
  } finally {
    await stop();
    if (createdKeywordIds.size > 0) {
      await prisma.effectKeywordSuggestion.deleteMany({ where: { id: { in: [...createdKeywordIds] } } });
    }
    await prisma.effectDefinition.update({
      where: { effectId },
      data: {
        label: original.label,
        description: original.description,
        isActive: original.isActive,
        updatedAt: original.updatedAt,
      },
    });
    await prisma.effect.deleteMany({ where: { block: { chapter: { story: { slug: storySlug } } } } });
    await prisma.scene.deleteMany({ where: { chapter: { story: { slug: storySlug } } } });
    await prisma.storyBlock.deleteMany({ where: { chapter: { story: { slug: storySlug } } } });
    await prisma.chapter.deleteMany({ where: { story: { slug: storySlug } } });
    await prisma.story.deleteMany({ where: { slug: storySlug } });
    await prisma.user.deleteMany({ where: { id: { in: Object.values(users) } } });
    await prisma.$disconnect();
  }
}

run().catch((error: unknown) => {
  console.error(`P3-12 Effect Admin HTTP integration failed at: ${stage}`);
  if (error instanceof assert.AssertionError) console.error(error.message);
  if (error instanceof Error) {
    const line = error.stack?.split("\n").find((entry) => entry.includes("p3-12-effect-admin-http.integration.ts:"));
    if (line) console.error(line.trim());
  }
  process.exitCode = 1;
});
