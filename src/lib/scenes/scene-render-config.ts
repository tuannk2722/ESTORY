import { z } from "zod";
import { omitUndefined } from "@/lib/immutable";
import type { Scene, SceneRenderConfig } from "@/types/scene";
import { effectConfigSchema } from "@/lib/effects/effect-config-schema";
import { isEffectAllowedInScope } from "@/lib/effects/effect-manifest";
import { mediaUrlSchema, renderColorSchema } from "./render-values";
import { isParticleCompositionKey, PARTICLE_COMPOSITION_REGISTRY } from "./particle-composition-registry";

export const backgroundRenderDataSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("image"), media_url: mediaUrlSchema }),
  z.strictObject({ kind: z.literal("video"), media_url: mediaUrlSchema }),
  z.strictObject({
    kind: z.literal("gradient"),
    angle_deg: z.number(),
    stops: z.array(z.strictObject({ color: renderColorSchema, position: z.number().min(0).max(1) })).min(2),
  }),
  z.strictObject({
    kind: z.literal("radial_gradient"), shape: z.enum(["circle", "ellipse"]),
    center: z.strictObject({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) }),
    stops: z.array(z.strictObject({ color: renderColorSchema, position: z.number().min(0).max(1) })).min(2),
  }),
  z.strictObject({
    kind: z.literal("particle_composition"), composition_key: z.string(), config: z.record(z.string(), z.unknown()),
  }),
]).superRefine((data, context) => {
  if (data.kind === "gradient" || data.kind === "radial_gradient") {
    data.stops.forEach((stop, index) => {
      if (index > 0 && stop.position < data.stops[index - 1].position) {
        context.addIssue({ code: "custom", path: ["stops", index, "position"], message: "Gradient stops must be ordered" });
      }
    });
  }
  if (data.kind !== "particle_composition") return;
  if (!isParticleCompositionKey(data.composition_key)) {
    context.addIssue({ code: "custom", path: ["composition_key"], message: "Unknown particle composition" });
    return;
  }
  const result = PARTICLE_COMPOSITION_REGISTRY[data.composition_key].schema.safeParse(data.config);
  if (!result.success) {
    context.addIssue({ code: "custom", path: ["config"], message: "Invalid configuration for this particle composition" });
  }
});

export const backgroundRenderSnapshotSchema = z.strictObject({
  render_data: backgroundRenderDataSchema,
  motion: z.enum(["static", "looping"]),
  poster_frame: mediaUrlSchema.optional(),
}).superRefine((background, context) => {
  if (background.motion === "looping" && !background.poster_frame) {
    context.addIssue({ code: "custom", path: ["poster_frame"], message: "Looping backgrounds require a poster" });
  }
  if (background.render_data.kind === "video" && background.motion !== "looping") {
    context.addIssue({ code: "custom", path: ["motion"], message: "Video backgrounds must loop" });
  }
}).transform(omitUndefined);

export const paletteRenderSnapshotSchema = z.strictObject({
  primary: renderColorSchema, secondary: renderColorSchema, accent: renderColorSchema,
  background_tint: z.strictObject({ color: renderColorSchema, opacity: z.number().min(0).max(1) }),
});

export const sceneRenderConfigSchema = z.strictObject({
  schema_version: z.literal(1),
  background: backgroundRenderSnapshotSchema,
  palette: paletteRenderSnapshotSchema,
  ambient_effects: z.array(effectConfigSchema),
}).superRefine((config, context) => {
  const types = new Set<string>();
  config.ambient_effects.forEach((effect, index) => {
    const path = ["ambient_effects", index];
    if (!isEffectAllowedInScope(effect.type, "scene")) {
      context.addIssue({ code: "custom", path: [...path, "type"], message: "Effect does not allow scene scope" });
    }
    if (types.has(effect.type)) {
      context.addIssue({ code: "custom", path: [...path, "type"], message: "Only one ambient effect of each type is allowed" });
    }
    types.add(effect.type);
    if (effect.type === "audio" && effect.loop !== true) {
      context.addIssue({ code: "custom", path: [...path, "loop"], message: "Ambient audio must loop" });
    }
  });
});

export const sceneSchema = z.strictObject({
  id: z.string().min(1), chapter_id: z.string().min(1),
  start_block_id: z.string().min(1), end_block_id: z.string().min(1),
  based_on_preset_id: z.string().min(1).optional(), render_config: sceneRenderConfigSchema,
}).transform(omitUndefined);

// Zod validates and copies nested data; never freeze or retain caller-owned objects.
export function parseSceneRenderConfig(input: unknown): SceneRenderConfig {
  return sceneRenderConfigSchema.parse(input);
}
export function parseScene(input: unknown): Scene {
  return sceneSchema.parse(input);
}
