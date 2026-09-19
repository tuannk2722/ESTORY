import type {
  BackgroundRenderSnapshot,
  PaletteRenderSnapshot,
  Scene,
  ScenePreset,
  SceneRenderConfig,
  SceneVisualTreatmentV2,
} from "@/types/scene";
import type { EffectConfig } from "@/types/story";
import { createSceneId } from "@/lib/editor/ids";
import { cloneEffectConfig } from "@/lib/effects/effectFactory";
import { createOriginalVisualTreatment } from "./visual-treatment";
import { parseScene, sceneRenderConfigSchema } from "./scene-render-config";

/** Catalog IDs and the requested treatment mode are transient editor state. */
export interface SceneDraft {
  schemaVersion: 1 | 2;
  sourcePresetId?: string;
  backgroundId: string;
  background: BackgroundRenderSnapshot | null;
  /** Retained only while editing a v1 Scene. */
  palette: PaletteRenderSnapshot | null;
  visualTreatment: SceneVisualTreatmentV2 | null;
  /** `legacy` means the Author has not opted into v2 for this Scene. */
  treatmentMode: "legacy" | SceneVisualTreatmentV2["mode"];
  ambientAudio: EffectConfig | null;
  ambientEffects: EffectConfig[];
  effectOrder: string[];
}

export function createEmptySceneDraft(): SceneDraft {
  return {
    schemaVersion: 2,
    backgroundId: "",
    background: null,
    palette: null,
    visualTreatment: createOriginalVisualTreatment(),
    treatmentMode: "auto",
    ambientAudio: null,
    ambientEffects: [],
    effectOrder: [],
  };
}

function configToDraft(
  config: SceneRenderConfig,
  sourcePresetId?: string,
  newEffectIds = false,
): SceneDraft {
  const copy = structuredClone(config);
  const effects = copy.ambient_effects.map((effect) =>
    cloneEffectConfig(effect, newEffectIds),
  );
  const shared = {
    sourcePresetId,
    backgroundId: "",
    background: copy.background,
    ambientAudio: effects.find((effect) => effect.category === "audio") ?? null,
    ambientEffects: effects.filter((effect) => effect.category !== "audio"),
    effectOrder: effects.map((effect) => effect.id),
  };

  if (copy.schema_version === 1) {
    return {
      ...shared,
      schemaVersion: 1,
      palette: copy.palette,
      visualTreatment: null,
      treatmentMode: "legacy",
    };
  }

  return {
    ...shared,
    schemaVersion: 2,
    palette: null,
    visualTreatment: copy.visual_treatment,
    treatmentMode: copy.visual_treatment.mode,
  };
}

export function sceneToDraft(scene: Scene): SceneDraft {
  return configToDraft(scene.render_config, scene.based_on_preset_id);
}

/** Compatibility helper for retained preset data; new authoring no longer calls it. */
export function presetToDraft(preset: ScenePreset): SceneDraft {
  return configToDraft(preset.render_config, preset.id, true);
}

export function convertDraftToV2(
  draft: SceneDraft,
  treatment: SceneVisualTreatmentV2 = createOriginalVisualTreatment(),
  treatmentMode: SceneVisualTreatmentV2["mode"] = treatment.mode,
): SceneDraft {
  return {
    ...draft,
    schemaVersion: 2,
    sourcePresetId: undefined,
    palette: null,
    visualTreatment: structuredClone(treatment),
    treatmentMode,
  };
}

export function draftToRenderConfig(draft: SceneDraft): SceneRenderConfig | null {
  const effects = [
    ...draft.ambientEffects,
    ...(draft.ambientAudio ? [draft.ambientAudio] : []),
  ];
  const order = new Map(draft.effectOrder.map((id, index) => [id, index]));
  effects.sort(
    (a, b) => (order.get(a.id) ?? order.size) - (order.get(b.id) ?? order.size),
  );

  const candidate = draft.schemaVersion === 1
    ? {
        schema_version: 1 as const,
        background: draft.background,
        palette: draft.palette,
        ambient_effects: effects,
      }
    : {
        schema_version: 2 as const,
        background: draft.background,
        visual_treatment: draft.visualTreatment,
        ambient_effects: effects,
      };
  const parsed = sceneRenderConfigSchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}

function comparable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(comparable).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value)
      .filter(([, entry]) => entry !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, entry]) => `${JSON.stringify(key)}:${comparable(entry)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function comparableConfig(config: SceneRenderConfig) {
  return comparable({
    ...config,
    ambient_effects: config.ambient_effects
      .map((effect) => ({
        ...effect,
        id: undefined,
        delay_ms: effect.delay_ms ?? 0,
        loop: effect.loop ?? false,
      }))
      .sort((a, b) => a.type.localeCompare(b.type)),
  });
}

/** Compatibility helper for retained preset references. */
export function draftMatchesPreset(draft: SceneDraft, preset: ScenePreset): boolean {
  const config = draftToRenderConfig(draft);
  return config !== null && comparableConfig(config) === comparableConfig(preset.render_config);
}

/** Compatibility helper for retained preset references. */
export function sceneMatchesPreset(scene: Scene, preset: ScenePreset): boolean {
  return comparableConfig(scene.render_config) === comparableConfig(preset.render_config);
}

export function draftToScene(
  draft: SceneDraft,
  params: {
    id?: string;
    chapterId: string;
    startBlockId: string;
    endBlockId: string;
  },
): Scene {
  return parseScene({
    id: params.id ?? createSceneId(),
    chapter_id: params.chapterId,
    start_block_id: params.startBlockId,
    end_block_id: params.endBlockId,
    ...(draft.sourcePresetId ? { based_on_preset_id: draft.sourcePresetId } : {}),
    render_config: draftToRenderConfig(draft),
  });
}
