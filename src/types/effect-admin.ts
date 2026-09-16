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

export interface ManagedEffectAdminItem extends ManagedEffectDefinition {
  keywords: EffectKeywordSuggestion[];
}

export type AuthorEffectDefinition = Omit<ManagedEffectDefinition, "created_at" | "updated_at">;

export interface EffectAuthorCatalog {
  effects: AuthorEffectDefinition[];
  keywords: EffectKeywordSuggestion[];
}

export type EffectAdminStatusFilter = "active" | "inactive" | "all";
export type EffectAdminCategoryFilter = Exclude<EffectTechnicalDefinition["category"], "audio"> | "all";

export interface EffectAdminListQuery {
  q: string;
  category: EffectAdminCategoryFilter;
  status: EffectAdminStatusFilter;
  cursor: string | null;
}

export interface EffectAdminCapabilities {
  canCreateEffect: false;
  canEditTechnicalFields: false;
  canEditMetadata: true;
  canManageKeywords: true;
}

export interface EffectAdminList {
  items: ManagedEffectAdminItem[];
  total: number;
  nextCursor: string | null;
  capabilities: EffectAdminCapabilities;
}
