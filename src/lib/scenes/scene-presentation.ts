import type { BackgroundRenderSnapshot, SceneRenderConfig } from "@/types/scene";
import type { LegacyBackgroundAsset, LegacyColorPalette } from "@/types/scene-legacy";

/** Temporary presentation adapter for the shared renderer; never resolves catalog IDs. */
export function renderConfigToPresentation(renderConfig: SceneRenderConfig): {
  background: LegacyBackgroundAsset;
  palette: LegacyColorPalette;
  tintOpacity: number;
} {
  const { background, palette } = renderConfig;
  return {
    background: backgroundSnapshotToPresentation(background),
    palette: {
      id: `snapshot-palette:${palette.primary}:${palette.secondary}:${palette.accent}:${palette.background_tint.color}:${palette.background_tint.opacity}`,
      label: "",
      mood_tags: [],
      colors: { ...palette, background_tint: palette.background_tint.color },
    },
    tintOpacity: palette.background_tint.opacity,
  };
}

/** Presentation only; never convert this lossy CSS projection back into a snapshot. */
export function backgroundSnapshotToPresentation(background: BackgroundRenderSnapshot): LegacyBackgroundAsset {
  const data = background.render_data;
  let value: string;
  switch (data.kind) {
    case "image":
    case "video": value = data.media_url; break;
    case "gradient":
      value = `linear-gradient(${data.angle_deg}deg, ${data.stops.map(stop => `${stop.color} ${stop.position * 100}%`).join(", ")})`; break;
    case "radial_gradient":
      value = `radial-gradient(${data.shape} farthest-corner at ${data.center.x * 100}% ${data.center.y * 100}%, ${data.stops.map(stop => `${stop.color} ${stop.position * 100}%`).join(", ")})`; break;
    case "particle_composition": value = data.composition_key; break;
  }
  return {
    id: `snapshot-background:${background.motion}:${background.poster_frame ?? ""}:${value}`,
    label: "",
    mood_tags: [],
    type: data.kind === "radial_gradient" ? "gradient" : data.kind,
    value, motion: background.motion, poster_frame: background.poster_frame,
  };
}
