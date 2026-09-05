import type { Scene, SceneRenderConfig } from "@/types/scene";
import type { LegacyBackgroundAsset, LegacyColorPalette, LegacyScene } from "@/types/scene-legacy";

export const legacyBackground: LegacyBackgroundAsset = {
  id: "background", label: "Background", type: "image", value: "/background.svg", motion: "static", mood_tags: [],
};
export const legacyPalette: LegacyColorPalette = {
  id: "palette", label: "Palette", mood_tags: [],
  colors: { primary: "#ffffff", secondary: "#020617", accent: "#ffaa00", background_tint: "rgba(5, 30, 15, 0.82)" },
};
export const legacyScene: LegacyScene = {
  id: "scene", chapter_id: "chapter", start_block_id: "block", end_block_id: "block",
  background_id: "background", palette_id: "palette", based_on_preset_id: "preset", effects: [],
};
export function snapshotConfig(): SceneRenderConfig {
  return {
    schema_version: 1,
    background: { render_data: { kind: "image", media_url: "/background.svg" }, motion: "static" },
    palette: { primary: "#ffffff", secondary: "#020617", accent: "#ffaa00", background_tint: { color: "rgb(5, 30, 15)", opacity: 0.35 } },
    ambient_effects: [],
  };
}
export function snapshotScene(): Scene {
  return { id: "scene", chapter_id: "chapter", start_block_id: "block", end_block_id: "block", render_config: snapshotConfig() };
}
