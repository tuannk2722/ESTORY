import assert from "node:assert/strict";
import { createEffectConfig } from "@/lib/effects/effectFactory";
import { isSceneEffectType } from "@/lib/effects/effectCatalog";
import { isEffectAllowedWithReducedMotion } from "@/lib/effects/effectPlayback";

assert.equal(
  isEffectAllowedWithReducedMotion(createEffectConfig("audio")),
  true,
  "Reduced motion must not mute audio"
);
assert.equal(
  isEffectAllowedWithReducedMotion(createEffectConfig("particle_rain")),
  false,
  "Reduced motion must suppress animated particles"
);
assert.equal(
  isEffectAllowedWithReducedMotion(createEffectConfig("transition_fade")),
  false,
  "Reduced motion must suppress animated transitions"
);

assert.equal(isSceneEffectType("particle_rain"), true);
assert.equal(isSceneEffectType("sunbeam"), true);
assert.equal(isSceneEffectType("text_shake"), false);
assert.equal(isSceneEffectType("transition_page_tear"), false);

console.log("effect-playback.test.ts: 7 assertions passed");

