import { createHash } from "node:crypto";
import { KEYWORD_EFFECT_DICTIONARY } from "@/lib/effectSuggestion";
import type { EffectType } from "@/types/story";

export interface EffectKeywordSeedEntry {
  id: string;
  effectId: EffectType;
  keyword: string;
  normalizedKeyword: string;
  weight: number;
}

export interface EffectKeywordSeed {
  entries: EffectKeywordSeedEntry[];
  duplicateCount: number;
}

export function normalizeEffectKeyword(input: string): string {
  return input.normalize("NFKC").toLocaleLowerCase("vi-VN").trim().replace(/\s+/gu, " ");
}

function keywordId(effectId: EffectType, normalizedKeyword: string): string {
  const digest = createHash("sha256")
    .update(`${effectId}\0${normalizedKeyword}`, "utf8")
    .digest("hex")
    .slice(0, 24);
  return `effect-keyword-${digest}`;
}

/**
 * Convert the Phase-2 dictionary into deterministic DB seed rows. When two
 * source spellings normalize to the same key, the first occurrence wins and
 * the duplicate is reported; source order is stable and reviewable in git.
 */
export function buildEffectKeywordSeed(): EffectKeywordSeed {
  const entries = new Map<string, EffectKeywordSeedEntry>();
  let duplicateCount = 0;

  for (const mapping of KEYWORD_EFFECT_DICTIONARY) {
    const weight = Math.round(mapping.baseConfidence * 100);
    if (!Number.isInteger(weight) || weight < 1 || weight > 100) {
      throw new Error(`Invalid keyword weight for effect ${mapping.effect_type}`);
    }
    for (const keyword of mapping.keywords) {
      const normalizedKeyword = normalizeEffectKeyword(keyword);
      if (!normalizedKeyword) throw new Error(`Empty normalized keyword for effect ${mapping.effect_type}`);
      const key = `${mapping.effect_type}\0${normalizedKeyword}`;
      if (entries.has(key)) {
        duplicateCount += 1;
        continue;
      }
      entries.set(key, {
        id: keywordId(mapping.effect_type, normalizedKeyword),
        effectId: mapping.effect_type,
        keyword,
        normalizedKeyword,
        weight,
      });
    }
  }

  return { entries: [...entries.values()], duplicateCount };
}
