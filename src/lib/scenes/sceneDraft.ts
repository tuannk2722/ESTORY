import type { BackgroundRenderSnapshot, PaletteRenderSnapshot, Scene, ScenePreset, SceneRenderConfig } from "@/types/scene";
import type { EffectConfig } from "@/types/story";
import { createSceneId } from "@/lib/editor/ids";
import { cloneEffectConfig } from "@/lib/effects/effectFactory";
import { parseScene, sceneRenderConfigSchema } from "./scene-render-config";

/** Catalog IDs are transient selection state. Saved scenes keep only copied render data. */
export interface SceneDraft {
  sourcePresetId?: string;
  backgroundId: string;
  paletteId: string;
  background: BackgroundRenderSnapshot | null;
  palette: PaletteRenderSnapshot | null;
  ambientAudio: EffectConfig | null;
  ambientEffects: EffectConfig[];
  effectOrder: string[];
}

export function createEmptySceneDraft(): SceneDraft {
  return { backgroundId: "", paletteId: "", background: null, palette: null, ambientAudio: null, ambientEffects: [], effectOrder: [] };
}

function configToDraft(config: SceneRenderConfig, sourcePresetId?: string, newEffectIds = false): SceneDraft {
  const copy = structuredClone(config);
  const effects = copy.ambient_effects.map(effect => cloneEffectConfig(effect, newEffectIds));
  return {
    sourcePresetId, backgroundId: "", paletteId: "",
    background: copy.background, palette: copy.palette,
    ambientAudio: effects.find(effect => effect.category === "audio") ?? null,
    ambientEffects: effects.filter(effect => effect.category !== "audio"),
    effectOrder: effects.map(effect => effect.id),
  };
}

export function sceneToDraft(scene: Scene): SceneDraft {
  return configToDraft(scene.render_config, scene.based_on_preset_id);
}

export function presetToDraft(preset: ScenePreset): SceneDraft {
  return configToDraft(preset.render_config, preset.id, true);
}

export function draftToRenderConfig(draft: SceneDraft): SceneRenderConfig | null {
  const effects = [...draft.ambientEffects, ...(draft.ambientAudio ? [draft.ambientAudio] : [])];
  const order = new Map(draft.effectOrder.map((id, index) => [id, index]));
  effects.sort((a, b) => (order.get(a.id) ?? order.size) - (order.get(b.id) ?? order.size));
  const parsed = sceneRenderConfigSchema.safeParse({
    schema_version: 1, background: draft.background, palette: draft.palette, ambient_effects: effects,
  });
  return parsed.success ? parsed.data : null;
}

function comparable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(comparable).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value).filter(([, entry]) => entry !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([key, entry]) => `${JSON.stringify(key)}:${comparable(entry)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function comparableConfig(config: SceneRenderConfig) {
  return comparable({ ...config, ambient_effects: config.ambient_effects.map(effect => ({
    ...effect, id: undefined, delay_ms: effect.delay_ms ?? 0, loop: effect.loop ?? false,
  })).sort((a, b) => a.type.localeCompare(b.type)) });
}

export function draftMatchesPreset(draft: SceneDraft, preset: ScenePreset): boolean {
  const config = draftToRenderConfig(draft);
  return config !== null && comparableConfig(config) === comparableConfig(preset.render_config);
}

export function sceneMatchesPreset(scene: Scene, preset: ScenePreset): boolean {
  return comparableConfig(scene.render_config) === comparableConfig(preset.render_config);
}

export function draftToScene(draft: SceneDraft, params: { id?: string; chapterId: string; startBlockId: string; endBlockId: string }): Scene {
  return parseScene({
    id: params.id ?? createSceneId(), chapter_id: params.chapterId,
    start_block_id: params.startBlockId, end_block_id: params.endBlockId,
    ...(draft.sourcePresetId ? { based_on_preset_id: draft.sourcePresetId } : {}),
    render_config: draftToRenderConfig(draft),
  });
}
