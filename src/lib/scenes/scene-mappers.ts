import type { BackgroundAsset, ColorPalette, Scene, SceneLibraryData, ScenePreset, SceneRenderConfig } from "@/types/scene";
import type { LegacyBackgroundAsset, LegacyColorPalette, LegacyScene, LegacyScenePreset } from "@/types/scene-legacy";
import type { SceneDraft } from "./sceneDraft";
import { backgroundRenderSnapshotSchema, paletteRenderSnapshotSchema, parseScene, parseSceneRenderConfig } from "./scene-render-config";
import { legacyBackgroundToSnapshot } from "./legacy-background";

export function legacyPaletteToSnapshot(palette: LegacyColorPalette) {
  const legacyTint = palette.colors.background_tint.trim();
  const rgba = /^rgba\(\s*([^,]+)\s*,\s*([^,]+)\s*,\s*([^,]+)\s*,\s*[^)]+\)$/i.exec(legacyTint);
  const tintColor = rgba ? `rgb(${rgba[1]}, ${rgba[2]}, ${rgba[3]})` : legacyTint;
  return paletteRenderSnapshotSchema.parse({
    ...palette.colors,
    // Legacy alpha was part of an old rendering recipe. The target contract
    // owns opacity separately and starts snapshots at the documented 0.35.
    background_tint: { color: tintColor, opacity: 0.35 },
  });
}

export function resolveLegacyScene(
  legacy: LegacyScene, backgrounds: readonly LegacyBackgroundAsset[], palettes: readonly LegacyColorPalette[],
): Scene {
  const background = backgrounds.find((item) => item.id === legacy.background_id);
  const palette = palettes.find((item) => item.id === legacy.palette_id);
  if (!background) throw new Error(`Scene ${legacy.id}: missing background ${legacy.background_id}`);
  if (!palette) throw new Error(`Scene ${legacy.id}: missing palette ${legacy.palette_id}`);
  return parseScene({
    id: legacy.id, chapter_id: legacy.chapter_id,
    start_block_id: legacy.start_block_id, end_block_id: legacy.end_block_id,
    ...(legacy.based_on_preset_id ? { based_on_preset_id: legacy.based_on_preset_id } : {}),
    render_config: {
      schema_version: 1,
      background: legacyBackgroundToSnapshot(background),
      palette: legacyPaletteToSnapshot(palette),
      ambient_effects: legacy.effects ?? [],
    },
  });
}

export function presetToRenderConfig(preset: ScenePreset): SceneRenderConfig {
  return parseSceneRenderConfig(preset.render_config);
}

export function legacyPresetToRenderConfig(
  preset: LegacyScenePreset, backgrounds: readonly LegacyBackgroundAsset[], palettes: readonly LegacyColorPalette[],
): SceneRenderConfig {
  return resolveLegacyScene({
    ...preset, chapter_id: "preset", start_block_id: "preset", end_block_id: "preset",
  }, backgrounds, palettes).render_config;
}

/** Catalogs must already be scoped by the calling repository to the actor. */
export function customDraftToRenderConfig(
  draft: SceneDraft, catalogs: Pick<SceneLibraryData, "backgrounds" | "palettes">,
): SceneRenderConfig {
  const background = catalogs.backgrounds.find((item) => item.id === draft.backgroundId && item.status === "active");
  const palette = catalogs.palettes.find((item) => item.id === draft.paletteId && item.status === "active");
  if (!background || !palette) throw new Error("Custom scenes require an active background and palette");
  return parseSceneRenderConfig({
    schema_version: 1, background: background.render, palette: palette.colors,
    ambient_effects: [...draft.ambientEffects, ...(draft.ambientAudio ? [draft.ambientAudio] : [])],
  });
}

// Legacy JSON predates catalog lifecycle. Snapshot records retain their explicit status.
export function resolveBackgroundAsset(input: BackgroundAsset | LegacyBackgroundAsset): BackgroundAsset {
  if ("render" in input) return { ...structuredClone(input), render: backgroundRenderSnapshotSchema.parse(input.render) };
  return {
    id: input.id, label: input.label, mood_tags: [...input.mood_tags],
    render: legacyBackgroundToSnapshot(input), status: "active",
    scope: input.scope ?? "global", source: input.source ?? "admin_upload",
    ...(input.owner_id ? { owner_id: input.owner_id } : {}),
    ...(input.generation_prompt ? { generation_prompt: input.generation_prompt } : {}),
  };
}

export function resolvePalette(input: ColorPalette | LegacyColorPalette): ColorPalette {
  if ("status" in input) return { ...structuredClone(input), colors: paletteRenderSnapshotSchema.parse(input.colors) };
  return { id: input.id, label: input.label, mood_tags: [...input.mood_tags], status: "active", colors: legacyPaletteToSnapshot(input) };
}
