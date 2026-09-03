// src/lib/scenes/sceneDraft.ts
// Canonical SceneDraft domain model and round-trip converters between Scene, ScenePreset, and SceneDraft

import { Scene, ScenePreset } from "@/types/scene";
import { EffectConfig } from "@/types/story";
import { createSceneId } from "@/lib/editor/ids";
import { cloneEffectConfig } from "@/lib/effects/effectFactory";

export interface SceneDraft {
  sourcePresetId?: string;
  backgroundId: string;
  paletteId: string;
  ambientAudio: EffectConfig | null;
  ambientEffects: EffectConfig[];
}

function normalizeEffect(effect: EffectConfig) {
  return {
    type: effect.type,
    category: effect.category,
    intensity: effect.intensity,
    duration_ms: effect.duration_ms,
    delay_ms: effect.delay_ms ?? 0,
    audio_src: effect.audio_src?.trim() || "",
    audio_asset_id: effect.audio_asset_id ?? "",
    loop: effect.loop ?? true,
  };
}

function normalizeEffects(effects: EffectConfig[]) {
  return effects
    .map(normalizeEffect)
    .sort((left, right) =>
      JSON.stringify(left).localeCompare(JSON.stringify(right))
    );
}

/**
 * Provenance chỉ cho biết Scene bắt đầu từ preset nào. Hàm này kiểm tra riêng
 * xem draft hiện tại còn giống preset hay đã được tùy chỉnh, không phụ thuộc ID
 * mới được sinh ra khi copy effect.
 */
export function draftMatchesPreset(
  draft: SceneDraft,
  preset: ScenePreset
): boolean {
  const draftEffects = [
    ...(draft.ambientAudio ? [draft.ambientAudio] : []),
    ...draft.ambientEffects,
  ];

  return (
    draft.backgroundId === preset.background_id &&
    draft.paletteId === preset.palette_id &&
    JSON.stringify(normalizeEffects(draftEffects)) ===
      JSON.stringify(normalizeEffects(preset.effects ?? []))
  );
}

export function sceneMatchesPreset(scene: Scene, preset: ScenePreset): boolean {
  return draftMatchesPreset(sceneToDraft(scene), preset);
}

/**
 * Chuyển đổi từ Scene thực tế sang SceneDraft để chỉnh sửa trong ScenePicker
 */
export function sceneToDraft(scene: Scene): SceneDraft {
  const audio = scene.effects?.find(
    (e) => e.type === "audio" || e.category === "audio"
  );
  const visualAndMotionEffects =
    scene.effects?.filter(
      (e) => e.type !== "audio" && e.category !== "audio"
    ) || [];

  return {
    sourcePresetId: scene.based_on_preset_id,
    backgroundId: scene.background_id,
    paletteId: scene.palette_id,
    ambientAudio: audio ? cloneEffectConfig(audio) : null,
    ambientEffects: visualAndMotionEffects.map((e) => cloneEffectConfig(e)),
  };
}

/**
 * Chuyển đổi từ ScenePreset sang SceneDraft mới
 */
export function presetToDraft(preset: ScenePreset): SceneDraft {
  const audio = preset.effects?.find(
    (e) => e.type === "audio" || e.category === "audio"
  );
  const visualAndMotionEffects =
    preset.effects?.filter(
      (e) => e.type !== "audio" && e.category !== "audio"
    ) || [];

  return {
    sourcePresetId: preset.id,
    backgroundId: preset.background_id,
    paletteId: preset.palette_id,
    ambientAudio: audio ? cloneEffectConfig(audio, true) : null,
    ambientEffects: visualAndMotionEffects.map((e) =>
      cloneEffectConfig(e, true)
    ),
  };
}

/**
 * Tạo một SceneDraft trống mặc định
 */
export function createEmptySceneDraft(): SceneDraft {
  return {
    sourcePresetId: undefined,
    backgroundId: "",
    paletteId: "",
    ambientAudio: null,
    ambientEffects: [],
  };
}

/**
 * Chuyển đổi từ SceneDraft đã chỉnh sửa thành Scene hoàn chỉnh để lưu trữ
 */
export function draftToScene(
  draft: SceneDraft,
  params: {
    id?: string;
    chapterId: string;
    startBlockId: string;
    endBlockId: string;
  }
): Scene {
  const allEffects: EffectConfig[] = [];

  if (draft.ambientAudio && draft.ambientAudio.audio_src) {
    allEffects.push({
      ...draft.ambientAudio,
      category: "audio",
      loop: draft.ambientAudio.loop ?? true,
    });
  }

  draft.ambientEffects.forEach((eff) => {
    allEffects.push({
      ...eff,
      loop: eff.loop ?? true,
    });
  });

  return {
    id: params.id || createSceneId(),
    chapter_id: params.chapterId,
    start_block_id: params.startBlockId,
    end_block_id: params.endBlockId,
    based_on_preset_id: draft.sourcePresetId,
    background_id: draft.backgroundId,
    palette_id: draft.paletteId,
    effects: allEffects.length > 0 ? allEffects : undefined,
  };
}
