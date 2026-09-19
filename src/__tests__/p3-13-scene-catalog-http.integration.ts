import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import type { ChildProcess } from "node:child_process";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import { resolve } from "node:path";
import { loadEnvConfig } from "@next/env";
import { databaseJson } from "@/lib/db/json-fields";
import { SCENE_CATALOG_ADMIN_PAGE_SIZE } from "@/lib/validation/scene-catalog-schema";
import { seedSceneCatalogPaginationFixtures } from "./fixtures/scene-catalog-pagination-fixtures";

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
  const marker = `p313h${randomUUID().replaceAll("-", "")}`;
  const secretLabel = `catalog-content-${randomBytes(12).toString("hex")}`;
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
  const createdBackgroundIds = new Set<string>();
  const createdPaletteIds = new Set<string>();
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
  const stop = async () => {
    if (server && server.exitCode === null) {
      const exited = once(server, "exit");
      server.kill();
      await exited;
    }
    server = undefined;
  };

  try {
    stage = "fixtures";
    for (const role of ["reader", "author", "admin"] as const) {
      await prisma.user.create({ data: {
        id: users[role],
        email: `${users[role]}@example.invalid`,
        name: role,
        role: role === "admin" ? "ADMIN" : role === "author" ? "AUTHOR" : "READER",
        sessions: { create: { sessionToken: tokens[role], expires: new Date(Date.now() + 1_800_000) } },
      } });
    }
    const personalId = `${marker}-personal`;
    createdBackgroundIds.add(personalId);
    await prisma.backgroundAsset.create({ data: {
      id: personalId,
      label: `${secretLabel}-personal`,
      scope: "personal",
      source: "author_upload",
      ownerId: users.author,
      status: "ACTIVE",
      activatedAt: new Date(),
      moodTags: [marker],
      render: databaseJson.backgroundRender.write({
        render_data: { kind: "image", media_url: "https://media.example.invalid/personal.webp" },
        motion: "static",
      }),
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
    for (let attempt = 0; attempt < 100; attempt += 1) {
      if (server.exitCode !== null) throw new Error("SERVER_START_FAILED");
      try {
        if ((await request("/api/auth/providers")).status === 200) break;
      } catch { /* wait */ }
      await new Promise((resolve) => setTimeout(resolve, 250));
      if (attempt === 99) throw new Error("SERVER_START_TIMEOUT");
    }

    stage = "page and API authorization";
    const guestPage = await request("/admin/scene-library?tab=palettes");
    assert.equal(guestPage.status, 307);
    assert.equal(new URL(guestPage.headers.get("location")!, origin).searchParams.get("callbackUrl"), "/admin/scene-library?tab=palettes");
    assert.equal((await request("/admin/scene-library", { headers: { cookie: cookie(tokens.author) } })).status, 307);
    const page = await request("/admin/scene-library", { headers: { cookie: cookie(tokens.admin) } });
    assert.equal(page.status, 200);
    assert.ok((await page.text()).includes("Thư viện bối cảnh"));

    let response = await request("/api/admin/scene-library/backgrounds");
    assert.equal((await readJson(response, 401)).error.code, "UNAUTHENTICATED");
    response = await request("/api/admin/scene-library/backgrounds", { headers: actorHeaders("author") });
    assert.equal((await readJson(response, 403)).error.code, "FORBIDDEN");
    response = await request(`/api/admin/scene-library/backgrounds?q=${marker}`, { headers: actorHeaders("admin") });
    const isolated = await readJson(response, 200);
    assert.equal(isolated.data.items.some((item: { id: string }) => item.id === personalId), false);
    assert.equal(isolated.data.total, 0);

    const pageFixtures = await seedSceneCatalogPaginationFixtures(
      prisma, marker, SCENE_CATALOG_ADMIN_PAGE_SIZE + 1,
    );
    pageFixtures.backgroundIds.forEach((id) => createdBackgroundIds.add(id));
    pageFixtures.paletteIds.forEach((id) => createdPaletteIds.add(id));

    response = await request(`/api/admin/scene-library/backgrounds?q=${marker}`, { headers: actorHeaders("admin") });
    const firstBackgroundPage = await readJson(response, 200);
    assert.equal(firstBackgroundPage.data.items.length, SCENE_CATALOG_ADMIN_PAGE_SIZE);
    assert.equal(firstBackgroundPage.data.total, SCENE_CATALOG_ADMIN_PAGE_SIZE + 1);
    assert.equal(typeof firstBackgroundPage.data.nextCursor, "string");
    response = await request(
      `/api/admin/scene-library/backgrounds?q=${marker}&cursor=${encodeURIComponent(firstBackgroundPage.data.nextCursor)}`,
      { headers: actorHeaders("admin") },
    );
    const secondBackgroundPage = await readJson(response, 200);
    assert.equal(secondBackgroundPage.data.total, firstBackgroundPage.data.total);
    assert.equal(secondBackgroundPage.data.items.length, 1);
    assert.equal(
      secondBackgroundPage.data.items.some((item: { id: string }) =>
        firstBackgroundPage.data.items.some((first: { id: string }) => first.id === item.id)),
      false,
    );

    response = await request(`/api/admin/scene-library/palettes?q=${marker}`, { headers: actorHeaders("admin") });
    const firstPalettePage = await readJson(response, 200);
    assert.equal(firstPalettePage.data.items.length, SCENE_CATALOG_ADMIN_PAGE_SIZE);
    assert.equal(firstPalettePage.data.total, SCENE_CATALOG_ADMIN_PAGE_SIZE + 1);
    assert.equal(typeof firstPalettePage.data.nextCursor, "string");
    response = await request(
      `/api/admin/scene-library/palettes?q=${marker}&cursor=${encodeURIComponent(firstBackgroundPage.data.nextCursor)}`,
      { headers: actorHeaders("admin") },
    );
    const backgroundCursorOnPalette = await readJson(response, 200);
    assert.deepEqual(
      backgroundCursorOnPalette.data.items.map((item: { id: string }) => item.id),
      firstPalettePage.data.items.map((item: { id: string }) => item.id),
    );

    response = await request("/api/scene-library");
    assert.equal((await readJson(response, 401)).error.code, "UNAUTHENTICATED");
    response = await request("/api/scene-library", { headers: actorHeaders("reader") });
    assert.equal((await readJson(response, 403)).error.code, "FORBIDDEN");
    response = await request("/api/scene-library", { headers: actorHeaders("author") });
    const authorBefore = await readJson(response, 200);
    assert.deepEqual(Object.keys(authorBefore.data), ["backgrounds"]);
    assert.equal(authorBefore.data.backgrounds.some((item: { id: string }) => item.id === personalId), false);

    stage = "origin, strict DTO and background lifecycle";
    const createBody = {
      label: `Rừng Đêm ${secretLabel}`,
      moodTags: [marker],
      render: {
        kind: "gradient",
        angleDeg: 145,
        stops: [{ color: "#172554", position: 0 }, { color: "#020617", position: 1 }],
      },
    };
    response = await request("/api/admin/scene-library/backgrounds", {
      method: "POST",
      headers: actorHeaders("admin", "https://untrusted.invalid"),
      body: JSON.stringify(createBody),
    });
    assert.equal((await readJson(response, 403)).error.code, "FORBIDDEN");
    response = await request("/api/admin/scene-library/backgrounds", {
      method: "POST",
      headers: actorHeaders("admin"),
      body: JSON.stringify({ ...createBody, ownerId: users.admin }),
    });
    assert.equal((await readJson(response, 400)).error.code, "VALIDATION_ERROR");
    response = await request("/api/admin/scene-library/backgrounds", {
      method: "POST",
      headers: actorHeaders("admin"),
      body: JSON.stringify(createBody),
    });
    const created = await readJson(response, 201);
    createdBackgroundIds.add(created.data.id);
    assert.equal(created.data.status, "draft");
    assert.equal(created.data.scope, "global");
    assert.equal(created.data.can_hard_delete, true);

    const foldedQuery = encodeURIComponent(`DEM ${secretLabel.toUpperCase()} RUNG`);
    response = await request(`/api/admin/scene-library/backgrounds?q=${foldedQuery}`, {
      headers: actorHeaders("admin"),
    });
    const foldedSearch = await readJson(response, 200);
    assert.deepEqual(
      foldedSearch.data.items.map((item: { id: string }) => item.id),
      [created.data.id],
    );

    const backgroundPath = `/api/admin/scene-library/backgrounds/${created.data.id}`;
    response = await request(backgroundPath, {
      method: "PATCH",
      headers: actorHeaders("admin"),
      body: JSON.stringify({ action: "transition", status: "active", expectedUpdatedAt: created.meta.updatedAt }),
    });
    const activated = await readJson(response, 200);
    assert.ok(activated.data.activated_at);
    assert.equal(activated.data.impact.saved_scenes_unchanged, true);
    response = await request("/api/scene-library", { headers: actorHeaders("author") });
    assert.equal((await readJson(response, 200)).data.backgrounds.some((item: { id: string }) => item.id === created.data.id), true);

    response = await request(backgroundPath, {
      method: "PATCH",
      headers: actorHeaders("admin"),
      body: JSON.stringify({ action: "transition", status: "archived", expectedUpdatedAt: activated.meta.updatedAt }),
    });
    const archived = await readJson(response, 200);
    response = await request("/api/scene-library", { headers: actorHeaders("author") });
    assert.equal((await readJson(response, 200)).data.backgrounds.some((item: { id: string }) => item.id === created.data.id), false);
    response = await request(backgroundPath, {
      method: "DELETE",
      headers: actorHeaders("admin"),
      body: JSON.stringify({ expectedUpdatedAt: archived.meta.updatedAt }),
    });
    assert.equal((await readJson(response, 409)).error.code, "CATALOG_ITEM_WAS_ACTIVATED");

    stage = "retired palette catalog is read-only";
    const paletteBody = {
      label: `${secretLabel}-palette`,
      moodTags: ["warm"],
      colors: {
        primary: "#8B5CF6",
        secondary: "#0EA5E9",
        accent: "#F59E0B",
        background_tint: { color: "#0F172A", opacity: 0.35 },
      },
    };
    response = await request("/api/admin/scene-library/palettes", {
      method: "POST",
      headers: actorHeaders("admin", "https://untrusted.invalid"),
      body: JSON.stringify(paletteBody),
    });
    assert.equal((await readJson(response, 403)).error.code, "FORBIDDEN");
    response = await request("/api/admin/scene-library/palettes", {
      method: "POST",
      headers: actorHeaders("admin"),
      body: JSON.stringify(paletteBody),
    });
    assert.equal((await readJson(response, 410)).error.code, "PALETTE_CATALOG_RETIRED");
    const retainedPaletteId = firstPalettePage.data.items[0]?.id;
    assert.equal(typeof retainedPaletteId, "string");
    response = await request(`/api/admin/scene-library/palettes/${retainedPaletteId}`, {
      method: "PATCH",
      headers: actorHeaders("admin"),
      body: JSON.stringify({ action: "transition", status: "archived", expectedUpdatedAt: new Date().toISOString() }),
    });
    assert.equal((await readJson(response, 410)).error.code, "PALETTE_CATALOG_RETIRED");
    response = await request(`/api/admin/scene-library/palettes/${retainedPaletteId}`, {
      method: "DELETE",
      headers: actorHeaders("admin"),
      body: JSON.stringify({ expectedUpdatedAt: new Date().toISOString() }),
    });
    assert.equal((await readJson(response, 410)).error.code, "PALETTE_CATALOG_RETIRED");

    await new Promise((resolve) => setTimeout(resolve, 100));
    assert.equal(serverOutput.includes(secretLabel), false, "Structured logs must exclude mutable catalog content");
    for (const secret of [process.env.DATABASE_URL, process.env.DIRECT_URL, ...Object.values(tokens)]) {
      if (secret) assert.equal(serverOutput.includes(secret), false, "Server output must not expose credentials or sessions");
    }
    assert.equal(serverOutput.includes("COMMAND_REQUEST_FAILED"), false);
    assert.ok(serverOutput.includes("scene_catalog_admin_mutation"));
    if (process.env.P3_13_PLAYWRIGHT_MODULE) {
      stage = "browser smoke";
      const { runP313BrowserSmoke } = await import(resolve("scripts/p3-13-browser-smoke.cjs"));
      await runP313BrowserSmoke({ origin, adminToken: tokens.admin });
    }
    console.log("P3-13 Scene Catalog HTTP integration passed: page/API guards, origin/strict DTOs, Author active projection, lifecycle and impact.");
  } finally {
    await stop();
    await prisma.backgroundAsset.deleteMany({ where: { id: { in: [...createdBackgroundIds] } } });
    await prisma.colorPalette.deleteMany({ where: { id: { in: [...createdPaletteIds] } } });
    await prisma.user.deleteMany({ where: { id: { in: Object.values(users) } } });
    await prisma.$disconnect();
  }
}

run().catch((error: unknown) => {
  console.error(`P3-13 Scene Catalog HTTP integration failed at: ${stage}`);
  if (error instanceof assert.AssertionError) console.error(error.message);
  if (error instanceof Error) {
    if (!(error instanceof assert.AssertionError)) console.error(`${error.name}: ${error.message}`);
    const line = error.stack?.split("\n").find((entry) => entry.includes("p3-13-scene-catalog-http.integration.ts:"));
    if (line) console.error(line.trim());
  }
  process.exitCode = 1;
});
