import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { EFFECT_TYPES } from "./effect-manifest";
import type { EffectKeywordSeedEntry } from "./effect-keywords";

type EffectCatalogDatabase = PrismaClient | Prisma.TransactionClient;

export interface EffectDefinitionSeedEntry {
  effectId: string;
  label: string;
  description: string;
  isActive: boolean;
}

export async function assertEffectManifestDatabaseIds(db: EffectCatalogDatabase): Promise<void> {
  const manifestIds = new Set<string>(EFFECT_TYPES);
  const databaseEffectIds = await db.effectDefinition.findMany({ select: { effectId: true } });
  const unknownEffectIds = databaseEffectIds.map((row) => row.effectId).filter((id) => !manifestIds.has(id));
  if (unknownEffectIds.length) {
    throw new Error(`Database contains unknown technical effect IDs: ${unknownEffectIds.sort().join(", ")}`);
  }
}

/** Create missing overlays and deterministically migrate the Phase-2 dictionary. */
export async function syncEffectManifest(
  db: Prisma.TransactionClient,
  definitions: readonly EffectDefinitionSeedEntry[],
  keywords: readonly EffectKeywordSeedEntry[],
): Promise<void> {
  await assertEffectManifestDatabaseIds(db);
  await db.effectDefinition.createMany({ data: [...definitions], skipDuplicates: true });
  for (const keyword of keywords) {
    await db.effectKeywordSuggestion.upsert({
      where: { effectId_normalizedKeyword: { effectId: keyword.effectId, normalizedKeyword: keyword.normalizedKeyword } },
      create: keyword,
      update: { keyword: keyword.keyword, weight: keyword.weight },
    });
  }
}
