import type { BackgroundRenderData, BackgroundRenderSnapshot } from "@/types/scene";
import type { LegacyBackgroundAsset } from "@/types/scene-legacy";
import { backgroundRenderSnapshotSchema } from "./scene-render-config";

/** Legacy CSS is parsed into typed fields; target snapshots never retain raw CSS. */
function parseLegacyGradient(value: string): BackgroundRenderData {
  const linear = /^linear-gradient\(\s*([+-]?[\d.]+)deg\s*,(.+)\)$/i.exec(value);
  const radial = /^radial-gradient\(\s*(circle|ellipse)\s+at\s+(center|[\d.]+%\s+[\d.]+%)\s*,(.+)\)$/i.exec(value);
  if (!linear && !radial) throw new Error("Unsupported legacy gradient syntax");
  const parts = (linear ? linear[2] : radial![3]).split(/,(?![^()]*\))/);
  const stops = parts.map((part) => {
    const stop = /^\s*(.+?)\s+([\d.]+)%\s*$/.exec(part);
    if (!stop) throw new Error("Legacy gradient stops require an explicit percentage");
    return { color: stop[1], position: Number(stop[2]) / 100 };
  });
  if (linear) return { kind: "gradient", angle_deg: Number(linear[1]), stops };
  const [, shape, position] = radial!;
  const [x, y] = position === "center" ? [0.5, 0.5] : position.split(/\s+/).map((part) => Number.parseFloat(part) / 100);
  return { kind: "radial_gradient", shape: shape.toLowerCase() as "circle" | "ellipse", center: { x, y }, stops };
}

export function legacyBackgroundToSnapshot(asset: LegacyBackgroundAsset): BackgroundRenderSnapshot {
  let render_data: BackgroundRenderData;
  switch (asset.type) {
    case "image":
    case "video": render_data = { kind: asset.type, media_url: asset.value }; break;
    case "gradient": {
      render_data = parseLegacyGradient(asset.value);
      break;
    }
    case "particle_composition":
      render_data = { kind: "particle_composition", composition_key: asset.value, config: {} }; break;
    default: throw new Error("Unknown legacy background kind");
  }
  return backgroundRenderSnapshotSchema.parse({
    render_data, motion: asset.motion,
    ...(asset.poster_frame ? { poster_frame: asset.poster_frame } : {}),
  });
}
