import { z } from "zod";
import { omitUndefined } from "@/lib/immutable";
import type { EffectType } from "@/types/story";
import { mediaUrlSchema } from "@/lib/scenes/render-values";
import { EFFECT_CONFIG_CONSTRAINTS, EFFECT_MANIFEST, EFFECT_TYPES } from "./effect-manifest";

const constraints = EFFECT_CONFIG_CONSTRAINTS;
export const effectConfigSchema = z.strictObject({
  id: z.string().trim().min(1),
  type: z.enum(EFFECT_TYPES as readonly [EffectType, ...EffectType[]]),
  category: z.enum(["visual", "audio", "motion", "transition"]),
  intensity: z.number().min(constraints.intensity.min).max(constraints.intensity.max),
  duration_ms: z.number().min(constraints.duration_ms.min),
  delay_ms: z.number().min(constraints.delay_ms.min).optional(),
  audio_src: mediaUrlSchema.optional(),
  audio_asset_id: z.string().min(1).optional(),
  loop: z.boolean().optional(),
}).superRefine((effect, context) => {
  if (effect.category !== EFFECT_MANIFEST[effect.type].category) {
    context.addIssue({ code: "custom", path: ["category"], message: "Category must match the technical manifest" });
  }
  if (effect.type === "audio" && !effect.audio_src) {
    context.addIssue({ code: "custom", path: ["audio_src"], message: "Audio requires a media URL" });
  }
}).transform(omitUndefined);
