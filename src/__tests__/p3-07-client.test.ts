import assert from "node:assert/strict";
import type { Chapter, EffectConfig } from "@/types/story";
import type { Scene, ScenePreset } from "@/types/scene";
import { snapshotConfig } from "./fixtures/scene-fixtures";
import { sceneToDraft, draftToScene, presetToDraft, draftMatchesPreset, draftToRenderConfig } from "@/lib/scenes/sceneDraft";
import { createInitialEditorState, editorReducer } from "@/lib/editor/editorReducer";
import { buildBlockIndexMap, updateScenesAfterBlockDelete, validateBlockMoveAgainstScenes } from "@/lib/scenes/sceneRange";
import { buildSceneByBlockId } from "@/lib/scenes/sceneSelectors";
import { getScenePreloadSources } from "@/lib/reader/scenePreload";
import { buildEditorSaveBody, EditorSaveError, saveEditorAggregate } from "@/lib/editor/editorTransport";

export async function runP307ClientTests() {
  const revision = "2026-09-08T00:00:00.000Z";
  const nextRevision = "2026-09-08T00:00:00.001Z";
  const chapter: Chapter = { id: "chapter", title: "Draft", order: 0, status: "draft", blocks: [
    { id: "a", type: "paragraph", text: "First", effects: [] },
    { id: "b", type: "paragraph", text: "Second", effects: [] },
    { id: "c", type: "paragraph", text: "Third", effects: [] },
  ] };
  const rain: EffectConfig = { id: "rain", type: "particle_rain", category: "visual", intensity: .3, duration_ms: 1200, loop: true };
  const audio: EffectConfig = { id: "ambient", type: "audio", category: "audio", audio_src: "/ambient.mp3", audio_asset_id: "owner-audio", intensity: .4, duration_ms: 0, loop: true };
  const scene: Scene = { id: "scene", chapter_id: chapter.id, start_block_id: "a", end_block_id: "c", based_on_preset_id: "archived-preset", render_config: {
    ...snapshotConfig(),
    background: { render_data: { kind: "radial_gradient", shape: "ellipse", center: { x: .23, y: .71 }, stops: [{ color: "#123456", position: 0 }, { color: "#000000", position: 1 }] }, motion: "static" },
    ambient_effects: [rain, audio],
  } };
  const params = { id: scene.id, chapterId: chapter.id, startBlockId: "a", endBlockId: "c" };

  // No catalog is supplied: opening/saving must preserve every render field,
  // ambient order/IDs, tint opacity, personal audio attribution and provenance.
  assert.deepEqual(draftToScene(sceneToDraft(scene), params), scene);
  const edited = sceneToDraft(scene);
  edited.palette!.background_tint.opacity = .63;
  edited.ambientAudio!.intensity = .8;
  const editedScene = draftToScene(edited, params);
  assert.equal(editedScene.based_on_preset_id, scene.based_on_preset_id);
  assert.deepEqual(editedScene.render_config.background, scene.render_config.background);
  assert.equal(scene.render_config.palette.background_tint.opacity, .35);
  assert.equal(scene.render_config.ambient_effects[1].intensity, .4);
  const malformed = sceneToDraft(scene);
  malformed.ambientAudio!.loop = false;
  assert.equal(draftToRenderConfig(malformed), null);

  const preset: ScenePreset = { id: "preset", label: "Standalone media", status: "active", mood_tags: [], render_config: { ...scene.render_config, background: { render_data: { kind: "image", media_url: "/preset-only.webp" }, motion: "static" } } };
  const picked = presetToDraft(preset);
  assert.equal(draftMatchesPreset(picked, preset), true);
  assert.notEqual(picked.ambientEffects[0].id, rain.id);
  picked.background!.poster_frame = "/different.webp";
  assert.equal(preset.render_config.background.poster_frame, undefined);
  assert.equal(draftMatchesPreset(picked, preset), false);

  let state = createInitialEditorState(chapter, [scene], revision);
  state = editorReducer(state, { type: "blockTextUpdated", payload: { blockId: "b", text: "Edited text" } });
  assert.deepEqual(state.scenes, [scene]);
  const savingVersion = state.changeVersion;
  state = editorReducer(state, { type: "saveStarted", payload: { version: savingVersion } });
  state = editorReducer(state, { type: "blockTextUpdated", payload: { blockId: "b", text: "Typed while saving" } });
  state = editorReducer(state, { type: "saveSucceeded", payload: { version: savingVersion, revision: nextRevision } });
  assert.equal(state.dirty, true);
  assert.equal(state.revision, nextRevision);
  state = editorReducer(state, { type: "saveConflict" });
  assert.equal(state.dirty, true);
  assert.equal(state.revision, nextRevision);
  assert.equal(state.chapter.blocks[1].text, "Typed while saving");
  state = editorReducer(state, { type: "saveFailed" });
  assert.equal(state.dirty, true);
  assert.deepEqual(state.scenes, [scene]);

  const trimmed = updateScenesAfterBlockDelete("a", [scene], chapter.blocks);
  assert.equal(trimmed.updatedScenes[0].start_block_id, "b");
  assert.deepEqual(trimmed.updatedScenes[0].render_config, scene.render_config);
  assert.equal(trimmed.updatedScenes[0].based_on_preset_id, scene.based_on_preset_id);
  const moved = validateBlockMoveAgainstScenes(0, 2, chapter.blocks, [scene]);
  assert.notEqual(moved.type, "invalid");
  if (moved.type !== "invalid") assert.deepEqual(moved.recomputedScenes[0].render_config, scene.render_config);
  const selected = buildSceneByBlockId(chapter.blocks, [scene], buildBlockIndexMap(chapter.blocks));
  assert.equal(selected.get("a")?.scene, selected.get("b")?.scene);

  const video = { render_data: { kind: "video" as const, media_url: "/loop.mp4" }, motion: "looping" as const, poster_frame: "/poster.webp" };
  assert.deepEqual(getScenePreloadSources(video, false), { imageSource: "/poster.webp", videoSource: "/loop.mp4" });
  assert.deepEqual(getScenePreloadSources(video, true), { imageSource: "/poster.webp", videoSource: undefined });
  assert.equal(getScenePreloadSources(scene.render_config.background, false).videoSource, undefined);

  const payload = buildEditorSaveBody(chapter, [scene], revision);
  assert.deepEqual(Object.keys(payload).sort(), ["blocks", "expectedUpdatedAt", "scenes"]);
  assert.deepEqual(payload.scenes, [scene]);
  let calls = 0;
  const success: typeof fetch = async (url, init) => {
    calls++;
    assert.equal(url, "/api/stories/story%20slug/chapters/chapter/editor");
    assert.equal(init?.method, "PUT");
    assert.deepEqual(JSON.parse(String(init?.body)), payload);
    return Response.json({ data: { chapter, scenes: [scene] }, meta: { updatedAt: nextRevision } });
  };
  assert.equal((await saveEditorAggregate("story slug", chapter, [scene], revision, success)).meta.updatedAt, nextRevision);
  assert.equal(calls, 1);
  for (const status of [400, 401, 403, 404, 409, 413, 503]) {
    let attempts = 0;
    const failure: typeof fetch = async () => {
      attempts++;
      return Response.json({ error: { code: "EXPECTED", message: "Structured error" } }, { status });
    };
    await assert.rejects(saveEditorAggregate("story", chapter, [scene], revision, failure), (error: unknown) => error instanceof EditorSaveError && error.status === status);
    assert.equal(attempts, 1, "A failed save must never automatically retry");
  }
  await assert.rejects(saveEditorAggregate("story", chapter, [scene], revision, async () => Response.json({ revision: nextRevision })));
  console.log("P3-07 client contracts passed: snapshot/provenance round-trip, independent presets, reducer conflicts, preload and HTTP envelopes.");
}
