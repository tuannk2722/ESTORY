import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { suggestEffectsForText } from "@/lib/effectSuggestion";
import { normalizeEffectKeyword } from "@/lib/effects/effect-keyword-normalization";
import { matchesEffectSearch, groupEffectSearchKeywords } from "@/lib/effects/effect-search";
import { ADMIN_MANAGED_EFFECT_TYPES, isAdminManagedEffect } from "@/lib/effects/effect-management";
import { AUDIO_EFFECT_PRESETS } from "@/lib/effects/effectCatalog";
import {
  createEffectKeywordSchema,
  effectAdminListQuerySchema,
  parseEffectAdminSearchParams,
  updateEffectOverlaySchema,
  updateEffectOverlayCommandSchema,
  adminManagedEffectIdSchema,
} from "@/lib/validation/effect-admin-schema";

export async function runP312EffectAdminTests() {
  assert.equal(isAdminManagedEffect("audio"), false);
  assert.equal(ADMIN_MANAGED_EFFECT_TYPES.includes("particle_rain"), true);
  assert.equal(adminManagedEffectIdSchema.safeParse("audio").success, false);
  assert.equal(parseEffectAdminSearchParams({ category: "audio" }).category, "all");
  assert.notEqual(normalizeEffectKeyword("mưa"), normalizeEffectKeyword("mua"));
  const searchWords = groupEffectSearchKeywords([
    { id: "search", effect_id: "particle_rain", keyword: "lộp độp", normalized_keyword: "lộp độp", weight: 1 },
  ]);
  for (const query of ["lộp độp", "lop dop", "ＭƯＡ lop", "muaroi lop"]) {
    assert.equal(matchesEffectSearch(query, "Mưa rơi", ...(searchWords.get("particle_rain") ?? [])), true);
  }
  assert.equal(matchesEffectSearch("lop dop", "Mưa rơi"), false);
  assert.equal(matchesEffectSearch("lop tuyet", "Mưa rơi", "lộp độp"), false);
  assert.equal(matchesEffectSearch("screen blur", "screen_blur"), true);
  assert.equal(AUDIO_EFFECT_PRESETS.filter((preset) => matchesEffectSearch("lop dop", preset.label, ...preset.keywords)).length, 1);
  assert.deepEqual(parseEffectAdminSearchParams({}), {
    q: "",
    category: "all",
    status: "all",
    cursor: null,
  });
  assert.deepEqual(parseEffectAdminSearchParams({
    q: ["  Mưa   rơi  ", "ignored"],
    category: ["visual", "audio"],
    status: ["inactive", "active"],
    cursor: ["bad+cursor", "ignored"],
  }), {
    q: "Mưa rơi",
    category: "visual",
    status: "inactive",
    cursor: null,
  });
  assert.equal(effectAdminListQuerySchema.safeParse({
    q: "x", category: "all", status: "all", cursor: null, unexpected: true,
  }).success, false);

  const cleared = updateEffectOverlaySchema.parse({
    effectId: "particle_rain",
    label: "Mưa rơi",
    description: "   ",
    isActive: true,
    expectedUpdatedAt: "2026-09-14T00:00:00.000Z",
  });
  assert.equal(cleared.description, null, "A blank description must explicitly clear the stored value");
  assert.equal(updateEffectOverlayCommandSchema.parse({
    actorId: "admin",
    ...cleared,
  }).description, null, "The service must accept the already-parsed route payload when clearing description");
  assert.equal(updateEffectOverlaySchema.safeParse({
    ...cleared,
    description: "Mô tả",
    category: "audio",
  }).success, false, "Technical fields must be rejected by the strict mutation schema");

  assert.equal(normalizeEffectKeyword("  MƯA   BÃO  "), "mưa bão");
  assert.equal(normalizeEffectKeyword("ＭƯＡ"), "mưa");
  assert.equal(createEffectKeywordSchema.parse({
    keyword: "  MƯA   RƠI ",
    weight: 90,
    expectedUpdatedAt: "2026-09-14T00:00:00.000Z",
  }).keyword, "MƯA RƠI");
  for (const weight of [0, 1.5, 101]) {
    assert.equal(createEffectKeywordSchema.safeParse({
      keyword: "mưa",
      weight,
      expectedUpdatedAt: "2026-09-14T00:00:00.000Z",
    }).success, false);
  }

  const suggestions = suggestEffectsForText("  MƯA   RƠI giữa BÃO TUYẾT ", [
    { id: "rain-short", keyword: "mưa", normalized_keyword: "mưa", effect_id: "particle_rain", weight: 90 },
    { id: "rain-long", keyword: "mưa rơi", normalized_keyword: "mưa rơi", effect_id: "particle_rain", weight: 90 },
    { id: "snow", keyword: "bão tuyết", normalized_keyword: "bão tuyết", effect_id: "particle_snow", weight: 95 },
  ]);
  assert.deepEqual(suggestions, [
    { keyword: "bão tuyết", effect_type: "particle_snow", confidence: 0.95 },
    { keyword: "mưa rơi", effect_type: "particle_rain", confidence: 0.9 },
  ]);

  const runtimeSuggestionSource = readFileSync("src/lib/effectSuggestion.ts", "utf8");
  const blockSource = readFileSync("src/components/editor/blocks/BlockCard.tsx", "utf8");
  const editorRouteSource = readFileSync("src/app/api/stories/[storyId]/chapters/[chapterId]/editor/route.ts", "utf8");
  const readerEffectSource = readFileSync("src/components/effects/EffectLayer.tsx", "utf8");
  const readerSceneSource = readFileSync("src/components/scenes/SceneLayer.tsx", "utf8");
  assert.equal(runtimeSuggestionSource.includes("KEYWORD_EFFECT_DICTIONARY"), false);
  assert.ok(blockSource.includes("effectCatalog.keywords"));
  assert.ok(editorRouteSource.includes("editorBootstrapDataSchema"));
  assert.equal(readerEffectSource.includes("effect-catalog-service"), false);
  assert.equal(readerSceneSource.includes("effect-catalog-service"), false);

  console.log("p3-12-effect-admin.test.ts: strict filters, technical isolation, Unicode validation, DB-backed suggestion ranking and Reader/aggregate boundaries passed");
}
