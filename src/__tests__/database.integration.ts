import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { loadEnvConfig } from "@next/env";
import { databaseJson } from "@/lib/db/json-fields";
import { snapshotConfig } from "./fixtures/scene-fixtures";

loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production");

async function run() {
  // Load only after .env.local; server-only resolves under react-server condition.
  const { prisma } = await import("@/lib/db/prisma");
  const suffix = randomUUID();
  const rollback = new Error("ROLLBACK_FOUNDATION_TEST");
  const email = `foundation-${suffix}@example.invalid`;
  try {
    await assert.rejects(prisma.$transaction(async (tx) => {
      const user = await tx.user.create({ data: { email } });
      assert.equal(user.role, "READER");
      assert.equal(user.aiBackgroundQuotaLimit, 0);
      assert.equal(user.freesoundImportQuotaLimit, 0);
      await tx.account.create({ data: { userId: user.id, type: "oauth", provider: "test", providerAccountId: suffix } });
      await tx.session.create({ data: { userId: user.id, sessionToken: suffix, expires: new Date(Date.now() + 60_000) } });
      await tx.verificationToken.create({ data: { identifier: email, token: suffix, expires: new Date(Date.now() + 60_000) } });
      const settings = await tx.userSettings.create({ data: { userId: user.id } });
      assert.deepEqual(databaseJson.effectsByCategory.read(settings.effectsByCategory), { visual: true, audio: true, motion: true, transition: true });

      const story = await tx.story.create({ data: { slug: `foundation-${suffix}`, title: "Foundation", authorDisplayName: "Foundation author", description: "Transaction rollback test", genre: ["test"], authorId: user.id } });
      assert.equal(story.status, "DRAFT");
      const chapter = await tx.chapter.create({ data: { storyId: story.id, title: "Chapter", order: 1 } });
      assert.equal(chapter.status, "DRAFT");
      const block = await tx.storyBlock.create({ data: { chapterId: chapter.id, type: "paragraph", text: "Snapshot survives catalog changes.", order: 1 } });
      await tx.bookmark.create({ data: { userId: user.id, storyId: story.id } });
      const progress = await tx.readingProgress.create({ data: { userId: user.id, storyId: story.id, chapterId: chapter.id, blockId: block.id } });
      assert.equal(progress.status, "READING");
      assert.equal((await tx.bookmark.createMany({ data: [{ userId: user.id, storyId: story.id }], skipDuplicates: true })).count, 0);

      const definition = await tx.effectDefinition.create({ data: { effectId: `foundation-${suffix}`, label: "Test overlay" } });
      await tx.effectKeywordSuggestion.create({ data: { effectId: definition.effectId, keyword: "Mưa", normalizedKeyword: "mưa" } });
      assert.equal((await tx.effectKeywordSuggestion.createMany({ data: [{ effectId: definition.effectId, keyword: "MƯA", normalizedKeyword: "mưa" }], skipDuplicates: true })).count, 0);
      await tx.effectDefinition.delete({ where: { effectId: definition.effectId } });
      assert.equal(await tx.effectKeywordSuggestion.count({ where: { effectId: definition.effectId } }), 0);

      const audio = await tx.audioAsset.create({ data: { ownerId: user.id, source: "upload", title: "Audio", url: "https://media.example.invalid/immutable.mp3", durationMs: 1000 } });
      const effect = await tx.effect.create({ data: { blockId: block.id, type: "audio", category: "audio", intensity: 0.5, durationMs: 1000, audioSrc: audio.url, audioAssetId: audio.id } });
      await tx.audioAsset.delete({ where: { id: audio.id } });
      const detachedEffect = await tx.effect.findUniqueOrThrow({ where: { id: effect.id } });
      assert.equal(detachedEffect.audioAssetId, null);
      assert.equal(detachedEffect.audioSrc, audio.url);

      const config = snapshotConfig();
      const background = await tx.backgroundAsset.create({ data: { label: "Global", moodTags: [], render: databaseJson.backgroundRender.write(config.background) } });
      assert.equal(background.scope, "global");
      assert.equal(background.status, "DRAFT");
      const palette = await tx.colorPalette.create({ data: { label: "Palette", primary: "#000000", secondary: "#111111", accent: "#ffffff", backgroundTintColor: "#000000", moodTags: [] } });
      const preset = await tx.scenePreset.create({ data: { id: `foundation-${suffix}`, label: "Preset", moodTags: [], sourceChecksum: "test-checksum", renderConfig: databaseJson.presetRenderConfig.write(config) } });
      const scene = await tx.scene.create({ data: { chapterId: chapter.id, startBlockId: block.id, endBlockId: block.id, basedOnPresetId: preset.id, renderConfig: databaseJson.sceneRenderConfig.write(config) } });
      const activatedAt = new Date();
      await tx.scenePreset.update({ where: { id: preset.id }, data: { status: "ACTIVE", activatedAt } });
      const archived = await tx.scenePreset.update({ where: { id: preset.id }, data: { status: "ARCHIVED" } });
      assert.equal(archived.activatedAt?.getTime(), activatedAt.getTime());
      await tx.backgroundAsset.delete({ where: { id: background.id } });
      await tx.colorPalette.delete({ where: { id: palette.id } });
      // Exercise FK behavior directly; future command services forbid deleting
      // an ever-active catalog record even though provenance allows SetNull.
      await tx.scenePreset.delete({ where: { id: preset.id } });
      const detachedScene = await tx.scene.findUniqueOrThrow({ where: { id: scene.id } });
      assert.equal(detachedScene.basedOnPresetId, null);
      assert.deepEqual(databaseJson.sceneRenderConfig.read(detachedScene.renderConfig), config);

      const personal = await tx.user.create({ data: { email: `personal-${suffix}@example.invalid` } });
      await tx.backgroundAsset.create({ data: { ownerId: personal.id, scope: "personal", source: "author_upload", label: "Personal", moodTags: [], render: databaseJson.backgroundRender.write(config.background) } });
      await tx.aiBackgroundGenerationSession.create({ data: { ownerId: personal.id, originalPrompt: "Test", seedA: 1, seedB: 2, status: "reserved", expiresAt: new Date(Date.now() + 60_000) } });
      await tx.user.delete({ where: { id: personal.id } });
      assert.equal(await tx.backgroundAsset.count({ where: { ownerId: personal.id } }), 0);
      assert.equal(await tx.aiBackgroundGenerationSession.count({ where: { ownerId: personal.id } }), 0);

      await tx.effect.delete({ where: { id: effect.id } });
      await tx.storyBlock.delete({ where: { id: block.id } });
      await tx.chapter.delete({ where: { id: chapter.id } });
      assert.equal(await tx.scene.count({ where: { chapterId: chapter.id } }), 0);
      throw rollback;
    }, { timeout: 60_000 }), (error: unknown) => error === rollback);
    assert.equal(await prisma.user.count({ where: { email } }), 0, "The test transaction must leave no data behind");
    console.log("Database integration passed: 19 models, defaults, uniqueness, JSON round trips, provenance SetNull, cascades and transaction rollback.");
  } finally {
    await prisma.$disconnect();
  }
}

run().catch(() => {
  // Prisma/driver exceptions may contain connection details or row content.
  console.error("Database integration failed. Verify database access and the committed schema; credentials are not logged.");
  process.exitCode = 1;
});
