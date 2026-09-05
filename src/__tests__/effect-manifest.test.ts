import assert from "node:assert/strict";
import { EFFECT_MANIFEST, EFFECT_TYPES, isEffectAllowedInScope } from "@/lib/effects/effect-manifest";
import { EFFECT_METADATA } from "@/lib/effects/effectCatalog";
import { EFFECT_REGISTRY } from "@/components/effects/EffectRegistry";
import { effectConfigSchema } from "@/lib/effects/effect-config-schema";
import { projectManagedEffect } from "@/lib/effects/effect-projector";
import { createEffectConfig } from "@/lib/effects/effectFactory";
import type { EffectType } from "@/types/story";
import type { EffectDefinition } from "@/types/effect-admin";

type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
const typeIdsMatch: Equal<EffectType, keyof typeof EFFECT_MANIFEST> = true;
assert.ok(typeIdsMatch);
assert.deepEqual([...EFFECT_TYPES].sort(), Object.keys(EFFECT_REGISTRY).sort());
assert.deepEqual([...EFFECT_TYPES].sort(), Object.keys(EFFECT_METADATA).sort());

for (const type of EFFECT_TYPES) {
  const technical = EFFECT_MANIFEST[type];
  assert.equal(technical.id, type);
  assert.ok(EFFECT_REGISTRY[type]);
  assert.equal(EFFECT_METADATA[type].category, technical.category);
  assert.equal(EFFECT_METADATA[type].defaultIntensity, technical.defaults.intensity);
  assert.equal(EFFECT_METADATA[type].defaultDurationMs, technical.defaults.duration_ms);
  assert.ok(Object.isFrozen(technical.defaults));
  assert.ok(Object.isFrozen(technical.constraints));
  effectConfigSchema.parse(createEffectConfig(type, type === "audio" ? { audio_src: "/audio/test.mp3" } : {}));
}
assert.ok(isEffectAllowedInScope("audio", "scene"));
assert.ok(!isEffectAllowedInScope("screen_shake", "scene"));
assert.throws(() => effectConfigSchema.parse({ ...createEffectConfig("particle_rain"), category: "audio" }));
assert.throws(() => effectConfigSchema.parse(createEffectConfig("audio")));
assert.throws(() => effectConfigSchema.parse(createEffectConfig("sunbeam", { intensity: 1.01 })));
assert.throws(() => effectConfigSchema.parse(createEffectConfig("sunbeam", { delay_ms: -1 })));
assert.throws(() => effectConfigSchema.parse(createEffectConfig("sunbeam", { duration_ms: Infinity })));

const overlay = {
  effect_id: "particle_rain", label: "Rain label", description: "Custom description",
  is_active: false, created_at: "2026-09-05T00:00:00.000Z", updated_at: "2026-09-05T00:00:00.000Z",
  category: "audio", defaults: { intensity: 9 }, icon: () => null,
} as unknown as EffectDefinition;
const dto = projectManagedEffect(overlay);
assert.equal(dto.category, "visual", "Overlay cannot replace technical values");
assert.equal(dto.is_active, false);
assert.ok(!("icon" in dto));
assert.deepEqual(JSON.parse(JSON.stringify(dto)), dto);
dto.defaults.intensity = 0;
dto.allowed_scopes.length = 0;
dto.constraints.intensity.max = 9;
assert.equal(EFFECT_MANIFEST.particle_rain.defaults.intensity, 0.75);
assert.equal(EFFECT_MANIFEST.particle_rain.constraints.intensity.max, 1);
assert.ok(isEffectAllowedInScope("particle_rain", "scene"));
assert.ok(EFFECT_REGISTRY.particle_rain, "Inactive overlays do not remove the saved-content renderer");
assert.throws(() => projectManagedEffect({ ...overlay, effect_id: "toString" } as unknown as EffectDefinition));
console.log("effect-manifest.test.ts: type/registry/defaults/overlay isolation passed");
