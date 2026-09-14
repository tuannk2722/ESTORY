import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { loadEnvConfig } from "@next/env";
import { loadPhase3MigrationSource } from "@/lib/migration/phase3-source";
import { applyPhase3MigrationTransaction } from "@/lib/migration/phase3-migration";
import { JsonStoryRepository } from "@/lib/repositories/json-story-repository";
import {
  JsonSceneLibraryRepository,
  JsonSceneRepository,
} from "@/lib/repositories/json-scene-repository";
import { PrismaStoryRepository } from "@/lib/repositories/prisma-story-repository";
import { PrismaSceneRepository } from "@/lib/repositories/prisma-scene-repository";
import { PrismaSceneCatalogRepository } from "@/lib/repositories/prisma-scene-catalog-repository";
import { PrismaEffectAdminRepository } from "@/lib/repositories/prisma-effect-admin-repository";
import {
  ShadowSceneLibraryRepository,
  ShadowSceneRepository,
  ShadowStoryRepository,
  normalizeShadowRead,
} from "@/lib/repositories/shadow-read-repository";
import type {
  RepositoryReadEvent,
  RepositoryReadObserver,
} from "@/lib/repositories/read-observability";
import { buildStorySearchText, normalizeSearchText } from "@/lib/search/text-search";

loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production");

async function run() {
  let stage = "load-source";
  const source = await loadPhase3MigrationSource(process.cwd(), { auditMedia: false });
  stage = "load-prisma";
  const { prisma } = await import("@/lib/db/prisma");
  const ownerId = `p3-05-owner-${randomUUID()}`;
  const rollback = new Error("ROLLBACK_P3_05_READ_TEST");
  try {
    await assert.rejects(prisma.$transaction(async (tx) => {
      stage = "seed-owner";
      await tx.user.create({
        data: {
          id: ownerId,
          email: `${ownerId}@example.invalid`,
          name: "Migration owner is not the public byline",
          role: "ADMIN",
        },
      });
      stage = "apply-fixture";
      await applyPhase3MigrationTransaction(tx, source, ownerId);

      const events: RepositoryReadEvent[] = [];
      const observer: RepositoryReadObserver = {
        report(event) { events.push(event); },
      };
      const jsonStories = new JsonStoryRepository();
      const jsonCatalog = new JsonSceneLibraryRepository();
      const jsonScenes = new JsonSceneRepository(jsonStories, jsonCatalog);
      const prismaStories = new PrismaStoryRepository(tx, observer);
      const prismaScenes = new PrismaSceneRepository(tx, observer);
      const prismaCatalog = new PrismaSceneCatalogRepository(tx, observer);
      const prismaEffects = new PrismaEffectAdminRepository(tx, observer);

      stage = "story-collection-parity";
      assert.deepEqual(
        normalizeShadowRead(await prismaStories.getAll()),
        normalizeShadowRead(await jsonStories.getAll()),
      );
      assert.deepEqual(
        normalizeShadowRead(await prismaStories.getAllPublic()),
        normalizeShadowRead(await jsonStories.getAllPublic()),
      );
      assert.equal((await prismaStories.getAllForAuthor(ownerId)).length, source.stories.length);
      assert.deepEqual(await prismaStories.getAllForAuthor("another-owner"), []);

      stage = "public-search-parity";
      const firstSearchStory = source.stories[0];
      const searchToken = normalizeSearchText(firstSearchStory.title).split(" ")[0];
      const searchQueries = [
        { q: "", genre: null, cursor: null, limit: 2 },
        { q: searchToken, genre: null, cursor: null, limit: 9 },
        { q: "", genre: firstSearchStory.genre[0]?.trim() ?? null, cursor: null, limit: 9 },
        { q: searchToken, genre: firstSearchStory.genre[0]?.trim() ?? null, cursor: null, limit: 9 },
      ];
      for (const query of searchQueries) {
        assert.deepEqual(
          await prismaStories.listPublicStories(query),
          await jsonStories.listPublicStories(query),
        );
      }
      const firstPage = await prismaStories.listPublicStories(searchQueries[0]);
      if (firstPage.nextCursor) {
        const nextQuery = { ...searchQueries[0], cursor: firstPage.nextCursor };
        assert.deepEqual(
          await prismaStories.listPublicStories(nextQuery),
          await jsonStories.listPublicStories(nextQuery),
        );
      }
      assert.deepEqual(
        await prismaStories.listPublicGenreFacets(6),
        await jsonStories.listPublicGenreFacets(6),
      );
      const searchDocuments = await tx.story.findMany({
        where: { id: { in: source.stories.map((story) => story.id) } },
        select: { id: true, title: true, authorDisplayName: true, searchTextNormalized: true },
      });
      for (const row of searchDocuments) {
        assert.equal(
          row.searchTextNormalized,
          buildStorySearchText(row.title, row.authorDisplayName),
        );
      }

      stage = "story-detail-parity";
      for (const expectedStory of source.stories) {
        const jsonFull = await jsonStories.getById(expectedStory.id);
        const prismaFull = await prismaStories.getById(expectedStory.id);
        const jsonPublic = await jsonStories.getPublicById(expectedStory.id);
        const prismaPublic = await prismaStories.getPublicById(expectedStory.id);
        assert.deepEqual(normalizeShadowRead(prismaFull), normalizeShadowRead(jsonFull));
        assert.deepEqual(normalizeShadowRead(prismaPublic), normalizeShadowRead(jsonPublic));
        assert.equal(prismaFull?.author, expectedStory.author, "The legacy byline must survive owner migration");
        for (const chapter of expectedStory.chapters.filter((item) => item.status === "published")) {
          assert.deepEqual(
            normalizeShadowRead(await prismaStories.getPublicChapter(expectedStory.id, chapter.id)),
            normalizeShadowRead(await jsonStories.getPublicChapter(expectedStory.id, chapter.id)),
          );
          assert.deepEqual(
            normalizeShadowRead(await prismaScenes.getByChapter(expectedStory.id, chapter.id)),
            normalizeShadowRead(await jsonScenes.getByChapter(expectedStory.id, chapter.id)),
          );
        }
      }

      stage = "scene-catalog-parity";
      const jsonBackgrounds = await jsonCatalog.getActiveGlobalBackgrounds();
      const prismaBackgrounds = await prismaCatalog.getActiveGlobalBackgrounds();
      const jsonPalettes = await jsonCatalog.getActivePalettes();
      const prismaPalettes = await prismaCatalog.getActivePalettes();
      const jsonPresets = await jsonCatalog.getActiveScenePresets();
      const prismaPresets = await prismaCatalog.getActiveScenePresets();
      assert.deepEqual(normalizeShadowRead(prismaBackgrounds), normalizeShadowRead(jsonBackgrounds));
      assert.deepEqual(normalizeShadowRead(prismaPalettes), normalizeShadowRead(jsonPalettes));
      assert.deepEqual(normalizeShadowRead(prismaPresets), normalizeShadowRead(jsonPresets));

      stage = "effect-definition-parity";
      const definitions = await prismaEffects.getDefinitions();
      assert.deepEqual(
        definitions.map(({ effect_id, label, description, is_active }) => ({ effect_id, label, description, is_active })),
        source.effectDefinitions
          .map(({ effectId, label, description, isActive }) => ({ effect_id: effectId, label, description, is_active: isActive }))
          .sort((left, right) => left.effect_id.localeCompare(right.effect_id)),
      );
      stage = "effect-keyword-parity";
      const keywords = await prismaEffects.getKeywords();
      const keywordOrder = (
        left: { effect_id: string; normalized_keyword: string },
        right: { effect_id: string; normalized_keyword: string },
      ) => left.effect_id.localeCompare(right.effect_id)
        || left.normalized_keyword.localeCompare(right.normalized_keyword);
      assert.deepEqual(
        keywords
          .map(({ keyword, normalized_keyword, effect_id, weight }) => ({ keyword, normalized_keyword, effect_id, weight }))
          .sort(keywordOrder),
        source.effectKeywords
          .map(({ keyword, normalizedKeyword, effectId, weight }) => ({ keyword, normalized_keyword: normalizedKeyword, effect_id: effectId, weight }))
          .sort(keywordOrder),
      );

      stage = "shadow-parity";
      const shadowStories = new ShadowStoryRepository(jsonStories, prismaStories, observer);
      const shadowScenes = new ShadowSceneRepository(jsonScenes, prismaScenes, observer);
      const shadowCatalog = new ShadowSceneLibraryRepository(jsonCatalog, prismaCatalog, observer);
      await shadowStories.getAllPublic();
      await shadowStories.listPublicStories(searchQueries[0]);
      await shadowStories.listPublicGenreFacets(6);
      const firstStory = source.stories[0];
      const firstChapter = firstStory.chapters.find((chapter) => chapter.status === "published")!;
      await shadowStories.getPublicById(firstStory.id);
      await shadowStories.getPublicChapter(firstStory.id, firstChapter.id);
      await shadowScenes.getByChapter(firstStory.id, firstChapter.id);
      await shadowCatalog.getActiveGlobalBackgrounds();
      await shadowCatalog.getActivePalettes();
      await shadowCatalog.getActiveScenePresets();
      assert.equal(events.length, 0, "Fixture shadow reads must produce zero mismatches");

      stage = "public-fail-closed";
      const otherStory = source.stories.find((story) => story.id !== firstStory.id)!;
      const otherChapter = otherStory.chapters[0];
      assert.equal(await prismaStories.getPublicChapter(firstStory.id, otherChapter.id), null);
      assert.equal(await prismaStories.getPublicChapter("missing-story", firstChapter.id), null);
      assert.equal(await prismaStories.getPublicChapter(firstStory.id, "missing-chapter"), null);

      await tx.story.update({
        where: { id: firstStory.id },
        data: { status: "DRAFT" },
      });
      assert.equal(await prismaStories.getPublicById(firstStory.id), null);
      assert.equal(await prismaStories.getPublicChapter(firstStory.id, firstChapter.id), null);
      await tx.story.update({
        where: { id: firstStory.id },
        data: { status: "PUBLISHED", authorDisplayName: "" },
      });
      assert.equal(await prismaStories.getPublicById(firstStory.id), null);
      assert.equal(events.at(-1)?.code, "P3_PRISMA_INVALID_STORY_AUTHOR_DISPLAY");
      await tx.story.update({
        where: { id: firstStory.id },
        data: { authorDisplayName: firstStory.author },
      });

      stage = "invalid-public-chapter";
      const invalidChapter = firstStory.chapters.find(
        (chapter) => chapter.status === "published",
      )!;
      await tx.chapter.update({
        where: { id: invalidChapter.id },
        data: { order: -1 },
      });
      assert.equal(
        await prismaStories.getPublicChapter(firstStory.id, invalidChapter.id),
        null,
      );
      assert.equal(await prismaStories.getPublicById(firstStory.id), null);
      assert.equal(events.at(-1)?.code, "P3_PRISMA_INVALID_CHAPTER");
      await tx.chapter.update({
        where: { id: invalidChapter.id },
        data: { order: invalidChapter.order },
      });

      stage = "published-navigation";
      const navigationStory = source.stories.find(
        (story) => story.chapters.filter((chapter) => chapter.status === "published").length >= 2,
      )!;
      const publicChapters = navigationStory.chapters
        .filter((chapter) => chapter.status === "published")
        .sort((left, right) => left.order - right.order);
      const hiddenChapter = publicChapters[1];
      await tx.chapter.update({ where: { id: hiddenChapter.id }, data: { status: "DRAFT" } });
      assert.equal(await prismaStories.getPublicChapter(navigationStory.id, hiddenChapter.id), null);
      const preceding = await prismaStories.getPublicChapter(navigationStory.id, publicChapters[0].id);
      assert.notEqual(preceding?.nextChapterId, hiddenChapter.id, "Navigation must skip draft chapters");
      await tx.chapter.update({
        where: { id: hiddenChapter.id },
        data: { status: "PUBLISHED" },
      });

      stage = "invalid-snapshot";
      const scene = source.scenes.find((candidate) => source.stories.some(
        (story) => story.chapters.some(
          (chapter) => chapter.id === candidate.chapter_id
            && chapter.status === "published",
        ),
      ))!;
      await tx.scene.update({
        where: { id: scene.id },
        data: { renderConfig: { schema_version: 99 } },
      });
      const sceneStory = source.stories.find((story) => story.chapters.some((chapter) => chapter.id === scene.chapter_id))!;
      await assert.rejects(
        () => prismaScenes.getByChapter(sceneStory.id, scene.chapter_id),
        /P3_PRISMA_INVALID_SCENE_SNAPSHOT/,
      );
      await assert.rejects(
        () => prismaStories.getPublicChapter(sceneStory.id, scene.chapter_id),
        /P3_PRISMA_INVALID_SCENE_SNAPSHOT/,
      );
      assert.equal(events.at(-1)?.code, "P3_PRISMA_INVALID_SCENE_SNAPSHOT");
      assert.ok(!JSON.stringify(events).includes(sceneStory.title));
      assert.ok(!JSON.stringify(events).includes("schema_version"));

      stage = "invalid-catalog";
      const palette = source.palettes[0];
      await tx.colorPalette.update({
        where: { id: palette.id },
        data: { primary: "url(javascript:invalid)" },
      });
      await assert.rejects(
        () => prismaCatalog.getActivePalettes(),
        /P3_PRISMA_INVALID_PALETTE/,
      );
      assert.equal(events.at(-1)?.code, "P3_PRISMA_INVALID_PALETTE");

      throw rollback;
    }, { timeout: 120_000 }), (error: unknown) => error === rollback);
    assert.equal(await prisma.user.count({ where: { id: ownerId } }), 0);
    console.log("p3-05-read.integration.ts: JSON/Prisma parity, public/full boundaries, catalogs, shadow and invalid data observability passed");
  } catch (error) {
    if (error !== rollback) {
      console.error(`P3-05 read integration failed at stage: ${stage}`);
    }
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

run().catch(() => {
  console.error("P3-05 read integration failed. Database credentials and content are not logged.");
  process.exitCode = 1;
});
