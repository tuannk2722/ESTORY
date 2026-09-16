import type { EffectAuthorCatalog, AuthorEffectDefinition } from "@/types/effect-admin";
import type { EffectCategory, EffectType } from "@/types/story";
import { EFFECT_METADATA, type EffectMeta } from "./effectCatalog";
import type { EffectScope } from "./effect-manifest";
import { EFFECT_ICONS } from "./effect-icons";

export interface AuthorEffectPresentation extends EffectMeta {
  isActive: boolean;
}

export function getActiveEffectDefinition(
  catalog: EffectAuthorCatalog,
  type: EffectType,
): AuthorEffectDefinition | undefined {
  return catalog.effects.find((effect) => effect.id === type && effect.is_active);
}

export function getSelectableEffects(
  catalog: EffectAuthorCatalog,
  scope: EffectScope,
  category?: EffectCategory,
): AuthorEffectDefinition[] {
  return catalog.effects.filter(
    (effect) =>
      effect.is_active
      && effect.allowed_scopes.includes(scope)
      && (category === undefined || effect.category === category),
  );
}

/** Catalog presentation combines code-owned audio and active overlays; retained inactive effects use code labels. */
export function getAuthorEffectPresentation(
  catalog: EffectAuthorCatalog,
  type: EffectType,
): AuthorEffectPresentation {
  const active = getActiveEffectDefinition(catalog, type);
  if (!active) return { ...EFFECT_METADATA[type], isActive: false };

  return {
    type,
    category: active.category,
    label: active.label,
    description: active.description ?? "",
    icon: EFFECT_ICONS[active.icon_key] ?? EFFECT_METADATA[type].icon,
    defaultIntensity: active.defaults.intensity,
    defaultDurationMs: active.defaults.duration_ms,
    defaultDelayMs: active.defaults.delay_ms,
    isActive: true,
  };
}

export function hasOnlyActiveEffects(
  catalog: EffectAuthorCatalog,
  effects: readonly { type: EffectType }[],
): boolean {
  const activeIds = new Set(catalog.effects.filter((effect) => effect.is_active).map((effect) => effect.id));
  return effects.every((effect) => activeIds.has(effect.type));
}
