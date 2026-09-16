import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { loadEnvConfig } from "@next/env";
import { AuthAccessError } from "@/lib/auth/policy";
import { EffectCatalogService } from "@/lib/effects/effect-catalog-service";
import { buildEffectKeywordSeed } from "@/lib/effects/effect-keywords";
import { ADMIN_MANAGED_EFFECT_TYPES } from "@/lib/effects/effect-management";
import { EffectManifestSyncError, syncEffectManifestForDeployment } from "@/lib/effects/effect-manifest-sync";
import { EFFECT_PRESENTATION_SEED } from "@/lib/effects/effect-seed";
import { PrismaEffectAdminRepository, PrismaEffectAdminTransactions } from "@/lib/repositories/prisma-effect-admin-repository";
import { AdminEffectService, type EffectAdminAuditEvent } from "@/lib/services/admin-effect-service";
import { CommandError } from "@/lib/services/command-error";
import { retireAudioOverlay } from "@/lib/effects/retire-audio-overlay";
import { PrismaStoryCommandRepository } from "@/lib/repositories/prisma-story-command-repository";
import { syncEffectManifest } from "@/lib/effects/effect-manifest-sync";

loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production");
let stage = "initialize";

const query = { q: "", category: "all", status: "all", cursor: null } as const;
const definitions = ADMIN_MANAGED_EFFECT_TYPES.map((effectId) => ({
  effectId,
  label: EFFECT_PRESENTATION_SEED[effectId].label,
  description: EFFECT_PRESENTATION_SEED[effectId].description,
  isActive: true,
}));
const keywordSeed = buildEffectKeywordSeed().entries;

async function run() {
  const { prisma } = await import("@/lib/db/prisma");
  const marker = `p312d${randomUUID().replaceAll("-", "")}`;
  const adminId = `${marker}-admin`;
  const authorId = `${marker}-author`;
  const effectId = "particle_rain" as const;
  const createdKeywordIds = new Set<string>();
  const auditEvents: EffectAdminAuditEvent[] = [];
  const original = await prisma.effectDefinition.findUniqueOrThrow({ where: { effectId } });
  const originalKeywordCount = await prisma.effectKeywordSuggestion.count({ where: { effectId } });
  const transactions = new PrismaEffectAdminTransactions(async () => prisma);
  const service = new AdminEffectService(transactions, { log: (event) => auditEvents.push(event) });
  const statusError = (status: number) => (error: unknown) =>
    (error instanceof CommandError || error instanceof AuthAccessError) && error.status === status;

  try {
    stage = "audio cutover, backup, missing overlay and legacy inactive isolation";
    await assert.rejects(prisma.$transaction(async (tx) => {
      await tx.effectDefinition.upsert({
        where: { effectId: "audio" },
        create: { effectId: "audio", label: "Legacy audio", isActive: false },
        update: { label: "Legacy audio", isActive: false },
      });
      await tx.effectKeywordSuggestion.create({ data: {
        id: `${marker}-audio-keyword`, effectId: "audio", keyword: marker, normalizedKeyword: marker, weight: 99,
      } });
      const read = new EffectCatalogService(new PrismaEffectAdminRepository(tx));
      const before = await read.getActiveCatalog();
      const audio = before.effects.find((entry) => entry.id === "audio");
      assert.ok(audio?.is_active);
      assert.notEqual(audio.label, "Legacy audio");
      assert.equal("created_at" in audio, false);
      assert.equal(before.keywords.some((entry) => entry.effect_id === "audio"), false);
      assert.equal((await read.getAdminCatalog(query)).total, ADMIN_MANAGED_EFFECT_TYPES.length);
      const repository = new PrismaStoryCommandRepository(tx);
      const config = { id: `${marker}-audio`, type: "audio", category: "audio", intensity: 0.5, duration_ms: 1000, audio_src: "/audio/gentle_rain_falling.mp3" } as const;
      await repository.assertEffectReferences(authorId, [config], []);
      const originalBlur = await tx.effectDefinition.findUniqueOrThrow({ where: { effectId: "screen_blur" } });
      await tx.effectDefinition.update({ where: { effectId: "screen_blur" }, data: { isActive: false } });
      const visual = { id: `${marker}-visual`, type: "screen_blur", category: "visual", intensity: 0.5, duration_ms: 1000 } as const;
      await assert.rejects(repository.assertEffectReferences(authorId, [visual], []), statusError(409));
      await repository.assertEffectReferences(authorId, [visual], [visual]);
      // Restore within the probe so the before/after catalog comparison isolates audio.
      await tx.effectDefinition.update({ where: { effectId: "screen_blur" }, data: { isActive: originalBlur.isActive } });
      await assert.rejects(retireAudioOverlay(tx, async () => { throw new Error("BACKUP_FAILED"); }), /BACKUP_FAILED/);
      assert.ok(await tx.effectDefinition.findUnique({ where: { effectId: "audio" } }));
      let backedUp = false;
      const report = await retireAudioOverlay(tx, async (snapshot) => {
        assert.ok(JSON.stringify(snapshot).includes(`${marker}-audio-keyword`));
        backedUp = true;
      });
      assert.ok(backedUp);
      assert.equal(report.removedOverlayCount, 1);
      assert.ok(report.removedKeywordCount >= 1);
      assert.equal(await tx.effectKeywordSuggestion.count({ where: { effectId: "audio" } }), 0);
      assert.deepEqual(await read.getActiveCatalog(), before);
      await repository.assertEffectReferences(authorId, [config], []);
      assert.deepEqual(await retireAudioOverlay(tx, async () => { assert.fail("No backup needed on rerun"); }), { removedOverlayCount: 0, removedKeywordCount: 0 });
      await syncEffectManifest(tx, definitions, keywordSeed);
      await syncEffectManifestForDeployment(tx, definitions, keywordSeed);
      assert.equal(await tx.effectDefinition.findUnique({ where: { effectId: "audio" } }), null);
      throw new Error("ROLLBACK_AUDIO_CUTOVER_PROBE");
    }, { timeout: 30_000 }), /ROLLBACK_AUDIO_CUTOVER_PROBE/);

    stage = "manifest deployment sync";
    const initialDefinitionCount = await prisma.effectDefinition.count();
    const initialKeywordCount = await prisma.effectKeywordSuggestion.count();
    const syncReport = await prisma.$transaction(
      (tx) => syncEffectManifestForDeployment(tx, definitions, keywordSeed),
      { isolationLevel: "Serializable" },
    );
    assert.equal(syncReport.createdOverlayCount, 0);
    assert.equal(syncReport.createdKeywordCount, 0);
    assert.equal(await prisma.effectDefinition.count(), initialDefinitionCount);
    assert.equal(await prisma.effectKeywordSuggestion.count(), initialKeywordCount);
    assert.deepEqual(
      await prisma.effectDefinition.findUniqueOrThrow({ where: { effectId } }),
      original,
      "A deployment rerun must preserve admin-owned metadata",
    );

    stage = "missing overlay and unknown ID rollback probes";
    await assert.rejects(
      prisma.$transaction(async (tx) => {
        await tx.effectDefinition.delete({ where: { effectId } });
        const report = await syncEffectManifestForDeployment(tx, definitions, keywordSeed);
        assert.equal(report.createdOverlayCount, 1);
        assert.equal(
          await tx.effectKeywordSuggestion.count({ where: { effectId } }),
          keywordSeed.filter((entry) => entry.effectId === effectId).length,
        );
        throw new Error("ROLLBACK_MISSING_OVERLAY_PROBE");
      }),
      /ROLLBACK_MISSING_OVERLAY_PROBE/,
    );
    const unknownEffectId = `${marker}-unknown`;
    await assert.rejects(
      prisma.$transaction(async (tx) => {
        await tx.effectDefinition.create({ data: { effectId: unknownEffectId, label: "Unknown" } });
        await syncEffectManifestForDeployment(tx, definitions, keywordSeed);
      }),
      (error: unknown) => error instanceof EffectManifestSyncError && error.message.includes(unknownEffectId),
    );
    assert.equal(await prisma.effectDefinition.findUnique({ where: { effectId: unknownEffectId } }), null);

    stage = "admin fixtures and read boundary";
    await prisma.user.createMany({ data: [
      { id: adminId, email: `${adminId}@example.invalid`, name: "Admin", role: "ADMIN" },
      { id: authorId, email: `${authorId}@example.invalid`, name: "Author", role: "AUTHOR" },
    ] });
    await assert.rejects(service.list(authorId, query), statusError(403));
    const catalog = await service.list(adminId, { ...query, q: "particle rain", category: "visual" });
    const target = catalog.items.find((item) => item.id === effectId);
    assert.ok(target);
    assert.equal(target.category, "visual");
    assert.equal(catalog.capabilities.canCreateEffect, false);
    assert.equal(catalog.capabilities.canEditTechnicalFields, false);

    stage = "overlay mutation, strict technical fields and stale revision";
    const overlay = await service.updateOverlay({
      actorId: adminId,
      effectId,
      label: `Rain overlay ${marker}`,
      description: `Safe description ${marker}`,
      isActive: false,
      expectedUpdatedAt: original.updatedAt.toISOString(),
    });
    assert.equal(overlay.data.is_active, false);
    assert.equal(overlay.data.category, "visual");
    assert.ok(!(
      await new EffectCatalogService(new PrismaEffectAdminRepository(async () => prisma)).getActiveCatalog()
    ).effects.some((effect) => effect.id === effectId));
    await assert.rejects(service.updateOverlay({
      actorId: adminId,
      effectId,
      label: "stale",
      description: "stale",
      isActive: true,
      expectedUpdatedAt: original.updatedAt.toISOString(),
    }), statusError(409));
    await assert.rejects(service.updateOverlay({
      actorId: adminId,
      effectId,
      label: "technical field probe",
      description: "probe",
      isActive: true,
      expectedUpdatedAt: overlay.meta.updatedAt,
      category: "audio",
    }), statusError(400));

    stage = "keyword create, normalized duplicate, update and delete";
    const created = await service.createKeyword({
      actorId: adminId,
      effectId,
      keyword: `  MƯA   ${marker}  `,
      weight: 61,
      expectedUpdatedAt: overlay.meta.updatedAt,
    });
    const inserted = created.data.keywords.find((entry) => entry.keyword.includes(marker));
    assert.ok(inserted);
    createdKeywordIds.add(inserted.id);
    const keywordSearch = await service.list(adminId, { ...query, q: `mua ${marker}`, status: "inactive" });
    assert.deepEqual(keywordSearch.items.map((entry) => entry.id), [effectId]);
    assert.equal((await service.list(adminId, { ...query, q: `mua ${marker}`, status: "active" })).total, 0);
    assert.equal(inserted.normalized_keyword, `mưa ${marker}`);
    await assert.rejects(service.createKeyword({
      actorId: adminId,
      effectId,
      keyword: `ＭƯＡ ${marker}`,
      weight: 90,
      expectedUpdatedAt: created.meta.updatedAt,
    }), (error: unknown) => error instanceof CommandError
      && error.status === 409
      && error.body.error.code === "DUPLICATE_EFFECT_KEYWORD");

    const updated = await service.updateKeyword({
      actorId: adminId,
      effectId,
      keywordId: inserted.id,
      keyword: `Mưa cập nhật ${marker}`,
      weight: 77,
      expectedUpdatedAt: created.meta.updatedAt,
    });
    assert.equal(updated.data.keywords.find((entry) => entry.id === inserted.id)?.weight, 77);
    const deleted = await service.deleteKeyword({
      actorId: adminId,
      effectId,
      keywordId: inserted.id,
      expectedUpdatedAt: updated.meta.updatedAt,
    });
    createdKeywordIds.delete(inserted.id);
    assert.equal(deleted.data.keywords.some((entry) => entry.id === inserted.id), false);

    stage = "clear semantics and safe structured audit";
    const cleared = await service.updateOverlay({
      actorId: adminId,
      effectId,
      label: `Rain overlay ${marker}`,
      description: "   ",
      isActive: true,
      expectedUpdatedAt: deleted.meta.updatedAt,
    });
    assert.equal(cleared.data.description, undefined);
    assert.equal(auditEvents.length, 5);
    assert.deepEqual(auditEvents.map((event) => event.action), [
      "overlay_updated", "keyword_created", "keyword_updated", "keyword_deleted", "overlay_updated",
    ]);
    const auditJson = JSON.stringify(auditEvents);
    assert.equal(auditJson.includes(`Safe description ${marker}`), false);
    assert.equal(auditJson.includes(`Mưa cập nhật ${marker}`), false);
    assert.ok(auditEvents.every((event) => event.actorId === adminId && event.effectId === effectId));

    console.log("P3-12 Effect Admin DB integration passed: sync safety, exact admin, merged catalog, concurrency, keyword normalization/CRUD, active filtering and content-safe audit.");
  } finally {
    if (createdKeywordIds.size > 0) {
      await prisma.effectKeywordSuggestion.deleteMany({ where: { id: { in: [...createdKeywordIds] } } });
    }
    await prisma.effectDefinition.update({
      where: { effectId },
      data: {
        label: original.label,
        description: original.description,
        isActive: original.isActive,
        updatedAt: original.updatedAt,
      },
    });
    assert.equal(await prisma.effectKeywordSuggestion.count({ where: { effectId } }), originalKeywordCount);
    await prisma.user.deleteMany({ where: { id: { in: [adminId, authorId] } } });
    await prisma.$disconnect();
  }
}

run().catch((error: unknown) => {
  console.error(`P3-12 Effect Admin DB integration failed at: ${stage}`);
  if (error instanceof assert.AssertionError) console.error(error.message);
  if (error instanceof Error) {
    const line = error.stack?.split("\n").find((entry) => entry.includes("p3-12-effect-admin.integration.ts:"));
    if (line) console.error(line.trim());
  }
  process.exitCode = 1;
});
