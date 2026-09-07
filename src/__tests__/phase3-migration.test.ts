import assert from "node:assert/strict";
import { buildEffectKeywordSeed, normalizeEffectKeyword } from "@/lib/effects/effect-keywords";
import { EFFECT_TYPES } from "@/lib/effects/effect-manifest";
import { assertPhase3SourceClean, loadPhase3MigrationSource } from "@/lib/migration/phase3-source";

export async function runPhase3MigrationTests() {
  assert.equal(normalizeEffectKeyword("  MƯA   BÃO  "), "mưa bão");
  assert.equal(normalizeEffectKeyword("ＭƯＡ"), "mưa");
  const keywordSeed = buildEffectKeywordSeed();
  assert.equal(keywordSeed.duplicateCount, 0);
  assert.equal(new Set(keywordSeed.entries.map((entry) => `${entry.effectId}\0${entry.normalizedKeyword}`)).size, keywordSeed.entries.length);
  assert.ok(keywordSeed.entries.every((entry) => Number.isInteger(entry.weight) && entry.weight >= 1 && entry.weight <= 100));

  const source = await loadPhase3MigrationSource(process.cwd(), { auditMedia: false });
  assert.deepEqual(source.counts, {
    stories: 3,
    chapters: 10,
    blocks: 64,
    blockEffects: 69,
    scenes: 17,
    backgrounds: 41,
    palettes: 20,
    scenePresets: 39,
    effectDefinitions: 25,
    effectKeywords: keywordSeed.entries.length,
  });
  assert.equal(source.effectDefinitions.length, EFFECT_TYPES.length);
  assert.ok(source.stories.every((story) => story.status === "published" && story.chapters.every((chapter) => chapter.status === "published")));
  assert.ok(source.backgrounds.every((background) => background.scope === "global" && !background.owner_id));
  assert.ok(source.scenes.every((scene) => scene.render_config.schema_version === 1));
  assert.ok(source.presets.every((preset) => preset.render_config.schema_version === 1 && preset.source_checksum.length === 64));
  assert.equal(source.sourceFiles.length, 7);
  assert.doesNotThrow(() => assertPhase3SourceClean(source));
  assert.throws(() => assertPhase3SourceClean({
    ...source,
    media: [{ url: "/missing.mp4", status: "missing" }],
  }), /Media verification failed/);
  console.log("phase3-migration.test.ts: source mapping, keyword normalization and fail-closed media gate passed");
}
