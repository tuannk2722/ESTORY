import type {
  EffectDefinition,
  EffectKeywordSuggestion,
} from "@/types/effect-admin";

/** Read contract established in P3-05; P3-12 adds guarded mutation methods. */
export interface EffectAdminReadRepository {
  getDefinitions(): Promise<EffectDefinition[]>;
  getKeywords(): Promise<EffectKeywordSuggestion[]>;
}
