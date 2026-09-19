import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { loadEnvConfig } from "@next/env";
import type { Prisma } from "@/generated/prisma/client";
import { AuthAccessError } from "@/lib/auth/policy";
import { databaseJson } from "@/lib/db/json-fields";
import {
  PrismaSceneCatalogAdminTransactions,
  PrismaSceneCatalogRepository,
} from "@/lib/repositories/prisma-scene-catalog-repository";
import { AdminSceneCatalogService, type SceneCatalogAdminAuditEvent } from "@/lib/services/admin-scene-catalog-service";
import { CommandError } from "@/lib/services/command-error";
import { SCENE_CATALOG_ADMIN_PAGE_SIZE } from "@/lib/validation/scene-catalog-schema";
import { seedSceneCatalogPaginationFixtures } from "./fixtures/scene-catalog-pagination-fixtures";

loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production");
let stage = "initialize";

const statusError = (status: number, code?: string) => (error: unknown) =>
  (error instanceof CommandError || error instanceof AuthAccessError)
  && error.status === status
  && (!code || error.body.error.code === code);

async function run() {
  const { prisma } = await import("@/lib/db/prisma");
  const marker = `p313d${randomUUID().replaceAll("-", "")}`;
  const adminId = `${marker}-admin`;
  const authorId = `${marker}-author`;
  const backgroundIds = new Set<string>();
  const paletteIds = new Set<string>();
  const uploadIds = new Set<string>();
  const audits: SceneCatalogAdminAuditEvent[] = [];
  const service = new AdminSceneCatalogService(
    new PrismaSceneCatalogAdminTransactions(async () => prisma),
    { log: (event) => audits.push(event) },
  );
  const adminQuery = {
    q: "",
    type: "all",
    motion: "all",
    status: "all",
    cursor: null,
  } as const;

  const createUpload = async (
    kind: "image" | "video",
    options: { poster?: boolean; valid?: boolean } = {},
  ) => {
    const id = `${marker}-${kind}-${randomUUID()}`;
    uploadIds.add(id);
    const poster = kind === "video" && options.poster;
    const result = {
      kind,
      primary: {
        url: `https://media.example.invalid/${id}.${kind === "image" ? "webp" : "mp4"}`,
        contentType: kind === "image" ? "image/webp" : "video/mp4",
        size: 1024,
      },
      ...(poster ? { poster: {
        url: `https://media.example.invalid/${id}-poster.webp`,
        contentType: "image/webp",
        size: 512,
      } } : {}),
    };
    await prisma.mediaUpload.create({ data: {
      id,
      ownerId: adminId,
      purpose: "global_background",
      mediaKind: kind,
      objectKey: `users/${adminId}/global/backgrounds/${id}`,
      contentType: kind === "image" ? "image/webp" : "video/mp4",
      expectedSize: 1024,
      ...(poster ? {
        posterObjectKey: `users/${adminId}/global/backgrounds/${id}-poster`,
        posterContentType: "image/webp",
        posterExpectedSize: 512,
      } : {}),
      status: "COMPLETED",
      result: (options.valid === false ? { bad: true } : result) as Prisma.InputJsonValue,
      completedAt: new Date(),
      expiresAt: new Date(Date.now() + 600_000),
    } });
    return id;
  };

  try {
    stage = "fixtures and exact role";
    await prisma.user.createMany({ data: [
      { id: adminId, email: `${adminId}@example.invalid`, role: "ADMIN", name: "P3-13 Admin" },
      { id: authorId, email: `${authorId}@example.invalid`, role: "AUTHOR", name: "P3-13 Author" },
    ] });
    await assert.rejects(service.listBackgrounds(authorId, adminQuery), statusError(403));

    const personalId = `${marker}-personal`;
    backgroundIds.add(personalId);
    await prisma.backgroundAsset.create({ data: {
      id: personalId,
      label: `Personal secret ${marker}`,
      scope: "personal",
      source: "author_upload",
      ownerId: authorId,
      status: "ACTIVE",
      activatedAt: new Date(),
      moodTags: [marker],
      render: databaseJson.backgroundRender.write({
        render_data: { kind: "image", media_url: "https://media.example.invalid/personal.webp" },
        motion: "static",
      }),
    } });
    const isolated = await service.listBackgrounds(adminId, { ...adminQuery, q: marker });
    assert.equal(isolated.items.some((item) => item.id === personalId), false);
    assert.equal(isolated.total, 0, "Personal backgrounds must not contribute to filtered totals");

    stage = "upload claims and strict new media semantics";
    const imageUpload = await createUpload("image");
    const image = await service.createBackground({
      actorId: adminId,
      label: `Rừng Đêm ${marker}`,
      moodTags: ["night"],
      render: { kind: "image", uploadId: imageUpload },
    });
    backgroundIds.add(image.data.id);
    assert.equal(image.data.status, "draft");
    assert.equal(image.data.render.motion, "static");
    assert.equal(image.data.render.render_data.kind, "image");
    assert.equal((await prisma.mediaUpload.findUniqueOrThrow({ where: { id: imageUpload } })).status, "CLAIMED");
    assert.equal(await prisma.backgroundAsset.findUniqueOrThrow({ where: { id: image.data.id } }).then((row) => row.scope), "global");

    const foldedSearch = await service.listBackgrounds(adminId, {
      ...adminQuery,
      q: `DEM ${marker.toUpperCase()} RUNG`,
    });
    assert.deepEqual(
      foldedSearch.items.map((item) => item.id),
      [image.data.id],
      "Catalog search must be accent/case-insensitive AND-token matching",
    );

    const pageFixtures = await seedSceneCatalogPaginationFixtures(
      prisma, marker, SCENE_CATALOG_ADMIN_PAGE_SIZE,
    );
    pageFixtures.backgroundIds.forEach((id) => backgroundIds.add(id));
    pageFixtures.paletteIds.forEach((id) => paletteIds.add(id));

    const backgroundPageQuery = { ...adminQuery, q: marker };
    const firstBackgroundPage = await service.listBackgrounds(adminId, backgroundPageQuery);
    assert.equal(firstBackgroundPage.items.length, SCENE_CATALOG_ADMIN_PAGE_SIZE);
    assert.equal(firstBackgroundPage.total, SCENE_CATALOG_ADMIN_PAGE_SIZE + 1);
    assert.ok(firstBackgroundPage.nextCursor);
    const secondBackgroundPage = await service.listBackgrounds(adminId, {
      ...backgroundPageQuery,
      cursor: firstBackgroundPage.nextCursor,
    });
    assert.equal(secondBackgroundPage.total, firstBackgroundPage.total);
    assert.equal(secondBackgroundPage.items.length, 1);
    assert.equal(
      secondBackgroundPage.items.some((item) => firstBackgroundPage.items.some((first) => first.id === item.id)),
      false,
      "Cursor pages must not overlap",
    );
    const mismatchedBackgroundCursor = await service.listBackgrounds(adminId, {
      ...adminQuery,
      q: `rung ${marker}`,
      cursor: firstBackgroundPage.nextCursor,
    });
    const matchingBackgroundFirstPage = await service.listBackgrounds(adminId, {
      ...adminQuery,
      q: `rung ${marker}`,
    });
    assert.deepEqual(
      mismatchedBackgroundCursor.items.map((item) => item.id),
      matchingBackgroundFirstPage.items.map((item) => item.id),
      "A cursor bound to another query must reset to the first page",
    );

    const videoUpload = await createUpload("video", { poster: true });
    const video = await service.createBackground({
      actorId: adminId,
      label: `Video ${marker}`,
      moodTags: [],
      render: { kind: "video", uploadId: videoUpload },
    });
    backgroundIds.add(video.data.id);
    assert.equal(video.data.render.motion, "looping");
    assert.ok(video.data.render.poster_frame);

    const invalidVideoUpload = await createUpload("video");
    await assert.rejects(service.createBackground({
      actorId: adminId,
      label: `Bad video ${marker}`,
      moodTags: [],
      render: { kind: "video", uploadId: invalidVideoUpload },
    }), statusError(409, "UPLOAD_INVALID"));
    assert.equal((await prisma.mediaUpload.findUniqueOrThrow({ where: { id: invalidVideoUpload } })).status, "COMPLETED", "Failed create must roll back its claim");

    const particlePoster = await createUpload("image");
    const particle = await service.createBackground({
      actorId: adminId,
      label: `Particle ${marker}`,
      moodTags: ["magic"],
      render: {
        kind: "particle_composition",
        compositionKey: "fireflies_green",
        config: {},
        motion: "looping",
        posterUploadId: particlePoster,
      },
    });
    backgroundIds.add(particle.data.id);
    assert.equal(particle.data.render.poster_frame?.includes(particlePoster), true);

    stage = "background lifecycle, revisions, impact and Author projection";
    const gradient = await service.createBackground({
      actorId: adminId,
      label: `Gradient ${marker}`,
      moodTags: ["ocean"],
      render: {
        kind: "radial_gradient",
        shape: "ellipse",
        center: { x: 0.5, y: 0.4 },
        stops: [{ color: "#172554", position: 0 }, { color: "#020617", position: 1 }],
      },
    });
    backgroundIds.add(gradient.data.id);
    const activated = await service.transition({
      actorId: adminId,
      itemId: gradient.data.id,
      kind: "background",
      action: "transition",
      status: "active",
      expectedUpdatedAt: gradient.data.updated_at,
    });
    assert.ok(activated.data.activated_at);
    assert.equal(activated.data.can_hard_delete, false);
    assert.equal(activated.data.impact.dependency_count, null);
    assert.equal((await new PrismaSceneCatalogRepository(async () => prisma).getActiveGlobalBackgrounds()).some((item) => item.id === gradient.data.id), true);
    await assert.rejects(service.transition({
      actorId: adminId,
      itemId: gradient.data.id,
      kind: "background",
      action: "transition",
      status: "archived",
      expectedUpdatedAt: gradient.data.updated_at,
    }), statusError(409, "STALE_UPDATE"));
    const archived = await service.transition({
      actorId: adminId,
      itemId: gradient.data.id,
      kind: "background",
      action: "transition",
      status: "archived",
      expectedUpdatedAt: activated.data.updated_at,
    });
    assert.equal((await new PrismaSceneCatalogRepository(async () => prisma).getActiveGlobalBackgrounds()).some((item) => item.id === gradient.data.id), false);
    const reactivated = await service.transition({
      actorId: adminId,
      itemId: gradient.data.id,
      kind: "background",
      action: "transition",
      status: "active",
      expectedUpdatedAt: archived.data.updated_at,
    });
    assert.equal(reactivated.data.activated_at, activated.data.activated_at, "Reactivation must preserve activatedAt");
    await assert.rejects(service.delete({
      actorId: adminId,
      itemId: gradient.data.id,
      kind: "background",
      expectedUpdatedAt: reactivated.data.updated_at,
    }), statusError(409, "CATALOG_ITEM_WAS_ACTIVATED"));

    const draft = await service.createBackground({
      actorId: adminId,
      label: `Delete draft ${marker}`,
      moodTags: [],
      render: { kind: "gradient", angleDeg: 180, stops: [{ color: "#111827", position: 0 }, { color: "#030712", position: 1 }] },
    });
    const deleted = await service.delete({
      actorId: adminId,
      itemId: draft.data.id,
      kind: "background",
      expectedUpdatedAt: draft.data.updated_at,
    });
    assert.equal(deleted.data.impact.saved_scenes_unchanged, true);
    assert.equal(deleted.data.impact.storage_cleanup, "separate");
    assert.equal(await prisma.backgroundAsset.findUnique({ where: { id: draft.data.id } }), null);

    stage = "palette read-only audit and retirement";
    const paletteQuery = { q: marker, status: "all", cursor: null } as const;
    const firstPalettePage = await service.listPalettes(adminId, paletteQuery);
    assert.ok(firstPalettePage.items.length > 0);
    assert.ok(firstPalettePage.items.every((item) => item.can_hard_delete === false));
    assert.deepEqual(firstPalettePage.capabilities, {
      can_create: false,
      can_edit: false,
      can_activate: false,
      can_archive: false,
      hard_delete_never_activated_only: false,
    });
    assert.equal(firstPalettePage.items.length, SCENE_CATALOG_ADMIN_PAGE_SIZE);
    assert.equal(firstPalettePage.total, SCENE_CATALOG_ADMIN_PAGE_SIZE + 1);
    assert.ok(firstPalettePage.nextCursor);
    const secondPalettePage = await service.listPalettes(adminId, {
      ...paletteQuery,
      cursor: firstPalettePage.nextCursor,
    });
    assert.equal(secondPalettePage.total, firstPalettePage.total);
    assert.equal(secondPalettePage.items.length, 1);
    assert.equal(
      secondPalettePage.items.some((item) => firstPalettePage.items.some((first) => first.id === item.id)),
      false,
      "Palette cursor pages must not overlap",
    );
    const backgroundCursorOnPalette = await service.listPalettes(adminId, {
      ...paletteQuery,
      cursor: firstBackgroundPage.nextCursor,
    });
    assert.deepEqual(
      backgroundCursorOnPalette.items.map((item) => item.id),
      firstPalettePage.items.map((item) => item.id),
      "A Background cursor must reset on the Palette list",
    );
    const retainedPalette = firstPalettePage.items[0];
    const paletteBefore = await prisma.colorPalette.findUniqueOrThrow({ where: { id: retainedPalette.id } });
    const retired = statusError(410, "PALETTE_CATALOG_RETIRED");
    await assert.rejects(service.createPalette({
      actorId: adminId,
      label: `Palette ${marker}`,
      moodTags: ["warm"],
      colors: {
        primary: "#8B5CF6",
        secondary: "#0EA5E9",
        accent: "#F59E0B",
        background_tint: { color: "#0F172A", opacity: 0.35 },
      },
    }), retired);
    await assert.rejects(service.updatePalette({
      actorId: adminId,
      itemId: retainedPalette.id,
      action: "update",
      expectedUpdatedAt: retainedPalette.updated_at,
      label: retainedPalette.label,
      moodTags: retainedPalette.mood_tags,
      colors: retainedPalette.colors,
    }), retired);
    await assert.rejects(service.transition({
      actorId: adminId,
      itemId: retainedPalette.id,
      kind: "palette",
      action: "transition",
      status: "archived",
      expectedUpdatedAt: retainedPalette.updated_at,
    }), retired);
    await assert.rejects(service.delete({
      actorId: adminId,
      itemId: retainedPalette.id,
      kind: "palette",
      expectedUpdatedAt: retainedPalette.updated_at,
    }), retired);
    const paletteAfter = await prisma.colorPalette.findUniqueOrThrow({ where: { id: retainedPalette.id } });
    assert.equal(paletteAfter.updatedAt.toISOString(), paletteBefore.updatedAt.toISOString());
    assert.equal(paletteAfter.status, paletteBefore.status);

    assert.ok(audits.some((event) => event.action === "created" && event.kind === "background"));
    assert.equal(audits.some((event) => event.kind === "palette"), false);
    assert.equal(audits.some((event) => "label" in event || "moodTags" in event || "mediaUrl" in event), false, "Audit must omit mutable labels, tags and media URLs");
    console.log("P3-13 Scene Catalog DB integration passed: isolation, atomic upload claims, lifecycle, revisions, impact and active Author projection.");
  } finally {
    await prisma.backgroundAsset.deleteMany({ where: { OR: [{ id: { in: [...backgroundIds] } }, { label: { contains: marker } }] } });
    await prisma.colorPalette.deleteMany({ where: { OR: [{ id: { in: [...paletteIds] } }, { label: { contains: marker } }] } });
    await prisma.mediaUpload.deleteMany({ where: { id: { in: [...uploadIds] } } });
    await prisma.user.deleteMany({ where: { id: { in: [adminId, authorId] } } });
    await prisma.$disconnect();
  }
}

run().catch((error: unknown) => {
  console.error(`P3-13 Scene Catalog DB integration failed at: ${stage}`);
  if (error instanceof assert.AssertionError) console.error(error.message);
  if (error instanceof Error) {
    if (!(error instanceof assert.AssertionError)) {
      const code = "code" in error ? String(error.code) : "unknown";
      console.error(`${error.name} (${code}): ${error.message}`);
    }
    const line = error.stack?.split("\n").find((entry) => entry.includes("p3-13-scene-catalog.integration.ts:"));
    if (line) console.error(line.trim());
  }
  process.exitCode = 1;
});
