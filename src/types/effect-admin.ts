import type { EffectType } from "./story";
import type { EffectTechnicalDefinition } from "@/lib/effects/effect-manifest";

export interface EffectDefinition {
  effect_id: EffectType;
  label: string;
  description?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface EffectKeywordSuggestion {
  id: string;
  keyword: string;
  normalized_keyword: string;
  effect_id: EffectType;
  weight: number;
}

export interface ManagedEffectDefinition
  extends EffectTechnicalDefinition, Omit<EffectDefinition, "effect_id"> {}
