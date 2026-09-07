import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { loadEnvConfig } from "@next/env";
import { applyPhase3MigrationTransaction, verifyPhase3Migration } from "@/lib/migration/phase3-migration";
import { loadPhase3MigrationSource } from "@/lib/migration/phase3-source";

loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production");

async function run() {
  const source = await loadPhase3MigrationSource(process.cwd(), { auditMedia: false });
  const { prisma } = await import("@/lib/db/prisma");
  const suffix = randomUUID();
  const ownerId = `migration-owner-${suffix}`;
  const rollback = new Error("ROLLBACK_PHASE3_MIGRATION_TEST");
  try {
    let rolledBack = false;
    try {
      await prisma.$transaction(async (tx) => {
        await tx.user.create({ data: { id: ownerId, email: `${ownerId}@example.invalid`, role: "ADMIN" } });
        const preservedEffectId = source.effectDefinitions[0].effectId;
        await tx.effectDefinition.upsert({
          where: { effectId: preservedEffectId },
          create: { effectId: preservedEffectId, label: "Admin label", isActive: false },
          update: { label: "Admin label", isActive: false },
        });
        const unknownEffectId = `unknown-${suffix}`;
        await tx.effectDefinition.create({ data: { effectId: unknownEffectId, label: "Unknown" } });
        await assert.rejects(() => applyPhase3MigrationTransaction(tx, source, ownerId), /unknown technical effect IDs/);
        await tx.effectDefinition.delete({ where: { effectId: unknownEffectId } });
        await applyPhase3MigrationTransaction(tx, source, ownerId);
        const preservedOverlay = await tx.effectDefinition.findUniqueOrThrow({ where: { effectId: preservedEffectId } });
        assert.equal(preservedOverlay.label, "Admin label");
        assert.equal(preservedOverlay.isActive, false);
        await verifyPhase3Migration(tx, source, ownerId);
        const firstCounts = await Promise.all([
          tx.story.count(), tx.chapter.count(), tx.storyBlock.count(), tx.effect.count(), tx.scene.count(),
          tx.backgroundAsset.count(), tx.colorPalette.count(), tx.scenePreset.count(),
          tx.effectDefinition.count(), tx.effectKeywordSuggestion.count(),
        ]);
        await applyPhase3MigrationTransaction(tx, source, ownerId);
        await verifyPhase3Migration(tx, source, ownerId);
        const secondCounts = await Promise.all([
          tx.story.count(), tx.chapter.count(), tx.storyBlock.count(), tx.effect.count(), tx.scene.count(),
          tx.backgroundAsset.count(), tx.colorPalette.count(), tx.scenePreset.count(),
          tx.effectDefinition.count(), tx.effectKeywordSuggestion.count(),
        ]);
        assert.deepEqual(secondCounts, firstCounts, "A second apply must not increase any migrated table count");
        throw rollback;
      }, { timeout: 120_000 });
    } catch (error) {
      if (error !== rollback) throw error;
      rolledBack = true;
    }
    assert.equal(rolledBack, true);
    assert.equal(await prisma.user.count({ where: { id: ownerId } }), 0, "Migration integration fixture must roll back");
    console.log("phase3-migration.integration.ts: apply twice, verify and transaction rollback passed");
  } finally {
    await prisma.$disconnect();
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
