import type { EffectType } from "@/types/story";
import { EFFECT_TYPES } from "./effect-manifest";

/** Audio is a code-owned capability; all other effects have an admin DB overlay. */
export const CODE_MANAGED_EFFECT_TYPES = ["audio"] as const satisfies readonly EffectType[];
export type AdminManagedEffectType = Exclude<EffectType, typeof CODE_MANAGED_EFFECT_TYPES[number]>;

export function isAdminManagedEffect(type: EffectType): type is AdminManagedEffectType {
  return !CODE_MANAGED_EFFECT_TYPES.some((id) => id === type);
}

export const ADMIN_MANAGED_EFFECT_TYPES = Object.freeze(EFFECT_TYPES.filter(isAdminManagedEffect));
