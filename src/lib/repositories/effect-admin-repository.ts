import type {
  EffectDefinition,
  EffectKeywordSuggestion,
} from "@/types/effect-admin";
import type { EffectType } from "@/types/story";

/** Read contract established in P3-05; P3-12 adds guarded mutation methods. */
export interface EffectAdminReadRepository {
  getDefinitions(): Promise<EffectDefinition[]>;
  getKeywords(): Promise<EffectKeywordSuggestion[]>;
}

export interface EffectOverlayUpdate {
  label: string;
  description: string | null;
  isActive: boolean;
}

export interface EffectKeywordWrite {
  keyword: string;
  normalizedKeyword: string;
  weight: number;
}

export interface EffectAdminTransactionalRepository extends EffectAdminReadRepository {
  getActorRole(actorId: string): Promise<"reader" | "author" | "admin" | null>;
  getDefinition(effectId: EffectType): Promise<EffectDefinition | null>;
  getKeywordsForEffect(effectId: EffectType): Promise<EffectKeywordSuggestion[]>;
  getKeyword(effectId: EffectType, keywordId: string): Promise<EffectKeywordSuggestion | null>;
  findKeywordByNormalized(
    effectId: EffectType,
    normalizedKeyword: string,
    excludeKeywordId?: string,
  ): Promise<EffectKeywordSuggestion | null>;
  updateOverlayWithRevision(
    effectId: EffectType,
    expectedUpdatedAt: string,
    update: EffectOverlayUpdate,
  ): Promise<string>;
  bumpRevision(effectId: EffectType, expectedUpdatedAt: string): Promise<string>;
  createKeyword(effectId: EffectType, input: EffectKeywordWrite): Promise<EffectKeywordSuggestion>;
  updateKeyword(keywordId: string, input: EffectKeywordWrite): Promise<EffectKeywordSuggestion>;
  deleteKeyword(keywordId: string): Promise<void>;
}

export interface EffectAdminTransactionProvider {
  transaction<T>(
    work: (repository: EffectAdminTransactionalRepository) => Promise<T>,
  ): Promise<T>;
}
