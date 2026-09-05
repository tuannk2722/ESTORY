import { z } from "zod";

// The legacy renderer displays a static backdrop for these compositions.
// No configurable particles exist yet, so arbitrary configuration is rejected.
export const PARTICLE_COMPOSITION_REGISTRY = Object.freeze({
  fireflies_green: { schema: z.strictObject({}), background: "radial-gradient(ellipse at center, #0f172a 0%, #020617 100%)" },
  abyss_particles: { schema: z.strictObject({}), background: "radial-gradient(ellipse at center, #0f172a 0%, #020617 100%)" },
});

export type ParticleCompositionKey = keyof typeof PARTICLE_COMPOSITION_REGISTRY;
export function isParticleCompositionKey(key: string): key is ParticleCompositionKey {
  return Object.hasOwn(PARTICLE_COMPOSITION_REGISTRY, key);
}
