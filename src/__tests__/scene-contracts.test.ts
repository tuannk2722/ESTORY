import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import SceneLayer from "@/components/scenes/SceneLayer";
import { deepFreeze } from "@/lib/immutable";
import { createEffectConfig } from "@/lib/effects/effectFactory";
import { parseScene, parseSceneRenderConfig } from "@/lib/scenes/scene-render-config";
import { customDraftToRenderConfig, legacyPresetToRenderConfig, presetToRenderConfig, resolveBackgroundAsset, resolveLegacyScene, resolvePalette } from "@/lib/scenes/scene-mappers";
import { legacyBackgroundToSnapshot } from "@/lib/scenes/legacy-background";
import { renderConfigToPresentation } from "@/lib/scenes/scene-presentation";
import { isMediaUrl, isRenderColor } from "@/lib/scenes/render-values";
import type { LegacyBackgroundAsset, LegacyColorPalette, LegacyScene, LegacyScenePreset } from "@/types/scene-legacy";
import type { ScenePreset } from "@/types/scene";
import { legacyBackground, legacyPalette, legacyScene, snapshotConfig, snapshotScene } from "./fixtures/scene-fixtures";

const input = deepFreeze(structuredClone(legacyScene));
const result = resolveLegacyScene(input, [deepFreeze(structuredClone(legacyBackground))], [deepFreeze(structuredClone(legacyPalette))]);
assert.deepEqual(result.render_config, snapshotConfig());
assert.deepEqual(result.render_config.palette.background_tint, { color: "rgb(5, 30, 15)", opacity: 0.35 });
assert.equal(result.based_on_preset_id, "preset");
assert.ok(!("background_id" in result));
result.render_config.palette.accent = "#000000";
assert.equal(legacyPalette.colors.accent, "#ffaa00");
assert.throws(() => resolveLegacyScene(input, [], [legacyPalette]));
assert.throws(() => resolveLegacyScene(input, [legacyBackground], []));
assert.deepEqual(parseScene(JSON.parse(JSON.stringify(snapshotScene()))), snapshotScene());

const video = legacyBackgroundToSnapshot({ ...legacyBackground, type: "video", value: "/video.mp4", motion: "looping", poster_frame: "/poster.svg" });
assert.equal(video.render_data.kind, "video");
assert.throws(() => legacyBackgroundToSnapshot({ ...legacyBackground, motion: "looping" }));
assert.throws(() => legacyBackgroundToSnapshot({ ...legacyBackground, type: "video", motion: "static" }));
const linear = legacyBackgroundToSnapshot({ ...legacyBackground, type: "gradient", value: "linear-gradient(135deg, rgba(1, 2, 3, 0.4) 0%, #fff 100%)" });
assert.deepEqual(linear.render_data, { kind: "gradient", angle_deg: 135, stops: [{ color: "rgba(1, 2, 3, 0.4)", position: 0 }, { color: "#fff", position: 1 }] });
const radial = legacyBackgroundToSnapshot({ ...legacyBackground, type: "gradient", value: "radial-gradient(circle at 50% 80%, #1e293b 0%, #020617 100%)" });
assert.deepEqual(radial.render_data, { kind: "radial_gradient", shape: "circle", center: { x: 0.5, y: 0.8 }, stops: [{ color: "#1e293b", position: 0 }, { color: "#020617", position: 1 }] });
const particle = legacyBackgroundToSnapshot({ ...legacyBackground, type: "particle_composition", value: "fireflies_green", motion: "looping", poster_frame: "/poster.svg" });
assert.deepEqual(particle.render_data, { kind: "particle_composition", composition_key: "fireflies_green", config: {} });

for (const patch of [
  { schema_version: 2 },
  { background: { motion: "static", render_data: { kind: "gradient", angle_deg: 90, stops: [{ color: "red", position: 0 }] } } },
  { background: { ...linear, render_data: { kind: "gradient", angle_deg: 90, stops: [{ color: "red", position: 1 }, { color: "blue", position: 0 }] } } },
  { background: { ...radial, render_data: { ...radial.render_data, center: { x: 1.1, y: 0 } } } },
  { background: { ...particle, render_data: { kind: "particle_composition", composition_key: "toString", config: {} } } },
  { background: { ...particle, render_data: { kind: "particle_composition", composition_key: "fireflies_green", config: { arbitrary: "css" } } } },
  { palette: { ...snapshotConfig().palette, background_tint: { color: "red", opacity: -0.1 } } },
  { palette: { ...snapshotConfig().palette, primary: "red; background: url(evil)" } },
]) assert.throws(() => parseSceneRenderConfig({ ...snapshotConfig(), ...patch }));

const audio = createEffectConfig("audio", { audio_src: "/audio.mp3", audio_asset_id: "private-audio", loop: true });
const rain = createEffectConfig("particle_rain");
for (const effects of [
  [createEffectConfig("text_shake")], [createEffectConfig("screen_shake")],
  [rain, { ...rain, id: "second-rain" }], [audio, { ...audio, id: "second-audio" }],
  [{ ...audio, loop: false }], [{ ...audio, loop: undefined }],
]) assert.throws(() => parseSceneRenderConfig({ ...snapshotConfig(), ambient_effects: effects }));
const validAudio = parseSceneRenderConfig({ ...snapshotConfig(), ambient_effects: [audio, rain] });
assert.equal(validAudio.ambient_effects[0].audio_asset_id, "private-audio");
assert.deepEqual(JSON.parse(JSON.stringify(validAudio)), validAudio);

const preset: ScenePreset = { id: "preset", label: "Private curated media", mood_tags: [], status: "active", render_config: snapshotConfig() };
const copied = presetToRenderConfig(preset);
copied.palette.accent = "blue";
assert.equal(preset.render_config.palette.accent, "#ffaa00");
const catalogs = { backgrounds: [resolveBackgroundAsset(legacyBackground)], palettes: [resolvePalette(legacyPalette)] };
const draft = { backgroundId: "background", paletteId: "palette", ambientAudio: null, ambientEffects: [] };
assert.deepEqual(customDraftToRenderConfig(draft, catalogs), presetToRenderConfig(preset));
catalogs.backgrounds[0].status = "archived";
assert.throws(() => customDraftToRenderConfig(draft, catalogs));

for (const color of ["#fff", "#abcd", "#aabbccdd", "rgba(0, 2, 255, .5)", "rgb(10% 50% 100% / 80%)", "hsl(120 50% 60%)", "rebeccapurple"]) assert.ok(isRenderColor(color), color);
for (const color of ["#fffff", "rgb(999, 0, 0)", "rgba(1, 2, 3, 2)", "url(evil)", "var(--color)"]) assert.ok(!isRenderColor(color), color);
for (const url of ["javascript:alert(1)", "//evil.test/asset", "/../secret", "/%2e%2e/secret", "https://user:pass@example.com/image", "data:image/svg+xml,test"]) assert.ok(!isMediaUrl(url), url);

// Audit every existing seed shape without writing it or depending on historical counts.
const read = <T>(file: string): T => JSON.parse(fs.readFileSync(path.join(process.cwd(), "content", file), "utf8"));
const backgrounds = read<LegacyBackgroundAsset[]>("scene-library/backgrounds.json");
const palettes = read<LegacyColorPalette[]>("scene-library/palettes.json");
for (const background of backgrounds) legacyBackgroundToSnapshot(background);
for (const scene of read<LegacyScene[]>("scenes/scenes.json")) resolveLegacyScene(scene, backgrounds, palettes);
for (const seed of read<LegacyScenePreset[]>("scene-library/scene-presets.json")) legacyPresetToRenderConfig(seed, backgrounds, palettes);

const scene = snapshotScene();
scene.render_config.background = radial;
assert.match(renderConfigToPresentation(scene.render_config).background.value, /radial-gradient\(circle farthest-corner at 50% 80%/);
const html = renderToStaticMarkup(createElement(SceneLayer, { renderConfig: scene.render_config, reducedMotion: true }, "Readable story text"));
assert.match(html, /Readable story text/);
assert.match(html, /radial-gradient/);
scene.render_config.background = video;
const staticHtml = renderToStaticMarkup(createElement(SceneLayer, { renderConfig: scene.render_config, reducedMotion: true }));
assert.match(staticHtml, /poster\.svg/);
assert.ok(!staticHtml.includes("<video"), "Reduced motion renders the snapshot poster");
console.log("scene-contracts.test.ts: schemas, copy isolation, seed bridge and shared renderer passed");
