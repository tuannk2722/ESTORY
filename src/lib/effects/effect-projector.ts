import type { EffectDefinition, ManagedEffectDefinition } from "@/types/effect-admin";
import { EFFECT_MANIFEST } from "./effect-manifest";

/** Explicit projection keeps technical fields authoritative and React out of DTOs. */
export function projectManagedEffect(overlay: EffectDefinition): ManagedEffectDefinition {
  if (!Object.hasOwn(EFFECT_MANIFEST, overlay.effect_id)) {
    throw new Error(`Unknown technical effect: ${overlay.effect_id}`);
  }
  return {
    ...structuredClone(EFFECT_MANIFEST[overlay.effect_id]),
    label: overlay.label,
    ...(overlay.description === undefined ? {} : { description: overlay.description }),
    is_active: overlay.is_active,
    created_at: overlay.created_at,
    updated_at: overlay.updated_at,
  };
}
