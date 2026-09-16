import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { ADMIN_MANAGED_EFFECT_TYPES } from "./effect-management";
import { EFFECT_TYPES } from "./effect-manifest";
import type { EffectKeywordSeedEntry } from "./effect-keywords";

type EffectCatalogDatabase = PrismaClient | Prisma.TransactionClient;

/** Contains technical IDs only; safe to report without exposing adapter errors. */
export class EffectManifestSyncError extends Error {
  readonly name = "EffectManifestSyncError";
}

export interface EffectDefinitionSeedEntry {
  effectId: string;
  label: string;
  description: string;
  isActive: boolean;
}

export interface EffectManifestSyncReport {
  createdOverlayCount: number;
  createdKeywordCount: number;
  overlayCount: number;
}

function assertSeedIds(
  definitions: readonly EffectDefinitionSeedEntry[],
  keywords: readonly EffectKeywordSeedEntry[],
): void {
  const manifestIds = new Set<string>(ADMIN_MANAGED_EFFECT_TYPES);
  const definitionIds = new Set(definitions.map((definition) => definition.effectId));
  const unknownSeedIds = [...definitionIds, ...keywords.map((keyword) => keyword.effectId)]
    .filter((id) => !manifestIds.has(id));
  if (unknownSeedIds.length > 0) {
    throw new EffectManifestSyncError(`Effect seed contains unknown technical IDs: ${[...new Set(unknownSeedIds)].sort().join(", ")}`);
  }
  const missingDefinitionIds = ADMIN_MANAGED_EFFECT_TYPES.filter((id) => !definitionIds.has(id));
  if (missingDefinitionIds.length > 0) {
    throw new EffectManifestSyncError(`Effect seed is missing technical IDs: ${missingDefinitionIds.join(", ")}`);
  }
}

export async function assertEffectManifestDatabaseIds(db: EffectCatalogDatabase): Promise<void> {
  // A pre-cutover audio row is tolerated until the explicit post-deploy cleanup.
  // It is never read as authority or recreated by either sync path.
  const manifestIds = new Set<string>(EFFECT_TYPES);
  const databaseEffectIds = await db.effectDefinition.findMany({ select: { effectId: true } });
  const unknownEffectIds = databaseEffectIds.map((row) => row.effectId).filter((id) => !manifestIds.has(id));
  if (unknownEffectIds.length) {
    throw new EffectManifestSyncError(`Database contains unknown technical effect IDs: ${unknownEffectIds.sort().join(", ")}`);
  }
}

/** Create missing overlays and deterministically migrate the Phase-2 dictionary. */
export async function syncEffectManifest(
  db: Prisma.TransactionClient,
  definitions: readonly EffectDefinitionSeedEntry[],
  keywords: readonly EffectKeywordSeedEntry[],
): Promise<void> {
  await assertEffectManifestDatabaseIds(db);
  assertSeedIds(definitions, keywords);
  await db.effectDefinition.createMany({ data: [...definitions], skipDuplicates: true });
  // Migration seed is additive: reruns never overwrite an existing admin value.
  await db.effectKeywordSuggestion.createMany({ data: [...keywords], skipDuplicates: true });
}

/**
 * Deployment sync only seeds defaults for a newly introduced/missing overlay.
 * Existing overlays and their complete keyword sets are admin-owned and remain
 * untouched, including intentional keyword deletions.
 */
export async function syncEffectManifestForDeployment(
  db: Prisma.TransactionClient,
  definitions: readonly EffectDefinitionSeedEntry[],
  keywords: readonly EffectKeywordSeedEntry[],
): Promise<EffectManifestSyncReport> {
  await assertEffectManifestDatabaseIds(db);
  assertSeedIds(definitions, keywords);
  const existingRows = await db.effectDefinition.findMany({ select: { effectId: true } });
  const existingIds = new Set(existingRows.map((row) => row.effectId));
  const missingDefinitions = definitions.filter((definition) => !existingIds.has(definition.effectId));
  const missingIds = new Set(missingDefinitions.map((definition) => definition.effectId));
  const newKeywords = keywords.filter((keyword) => missingIds.has(keyword.effectId));

  if (missingDefinitions.length > 0) {
    await db.effectDefinition.createMany({ data: [...missingDefinitions] });
  }
  if (newKeywords.length > 0) {
    await db.effectKeywordSuggestion.createMany({ data: [...newKeywords], skipDuplicates: true });
  }
  return {
    createdOverlayCount: missingDefinitions.length,
    createdKeywordCount: newKeywords.length,
    overlayCount: existingRows.length + missingDefinitions.length,
  };
}
