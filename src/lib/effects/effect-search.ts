import { matchesSearch } from "@/lib/search/text-search";
import type { EffectKeywordSuggestion } from "@/types/effect-admin";
import type { EffectType } from "@/types/story";

/** Search folding is separate from accent-preserving keyword uniqueness. */
export function matchesEffectSearch(query: string, ...values: string[]): boolean {
  return matchesSearch(query.normalize("NFKC"), ...values.map((value) => value.normalize("NFKC")));
}

export function groupEffectSearchKeywords(keywords: readonly EffectKeywordSuggestion[]): Map<EffectType, string[]> {
  const grouped = new Map<EffectType, string[]>();
  for (const keyword of keywords) {
    const values = grouped.get(keyword.effect_id) ?? [];
    values.push(keyword.keyword);
    grouped.set(keyword.effect_id, values);
  }
  return grouped;
}
