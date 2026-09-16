import type { EffectKeywordSuggestion } from "@/types/effect-admin";
import type { EffectType } from "@/types/story";
import { normalizeEffectKeyword } from "@/lib/effects/effect-keyword-normalization";

export interface EffectSuggestion {
  keyword: string;
  effect_type: EffectType;
  confidence: number;
}

/** Suggest from the active dictionary loaded once with the editor aggregate. */
export function suggestEffectsForText(
  text: string,
  dictionary: readonly EffectKeywordSuggestion[],
): EffectSuggestion[] {
  const normalizedText = normalizeEffectKeyword(text);
  if (!normalizedText) return [];

  const suggestions = new Map<EffectType, EffectSuggestion>();
  for (const entry of dictionary) {
    if (!entry.normalized_keyword || !normalizedText.includes(entry.normalized_keyword)) continue;

    const candidate: EffectSuggestion = {
      keyword: entry.keyword,
      effect_type: entry.effect_id,
      confidence: entry.weight / 100,
    };
    const current = suggestions.get(entry.effect_id);
    if (
      !current
      || candidate.confidence > current.confidence
      || (
        candidate.confidence === current.confidence
        && entry.normalized_keyword.length > normalizeEffectKeyword(current.keyword).length
      )
    ) {
      suggestions.set(entry.effect_id, candidate);
    }
  }

  return [...suggestions.values()].sort(
    (left, right) =>
      right.confidence - left.confidence
      || normalizeEffectKeyword(right.keyword).length - normalizeEffectKeyword(left.keyword).length
      || left.effect_type.localeCompare(right.effect_type),
  );
}

export const detectEffectKeywords = suggestEffectsForText;
