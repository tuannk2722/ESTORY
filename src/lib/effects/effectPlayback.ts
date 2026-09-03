import type { EffectConfig } from "@/types/story";

/**
 * Reduced-motion keeps the story readable and audio available, while removing
 * visual movement, flashing, particles, haptics, and animated transitions.
 */
export function isEffectAllowedWithReducedMotion(effect: EffectConfig) {
  return effect.type === "audio" || effect.category === "audio";
}

