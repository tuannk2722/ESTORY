import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production");
async function run() {
  const { prisma } = await import("@/lib/db/prisma");
  const { PrismaAudioAssetRepository } = await import("@/lib/repositories/prisma-audio-asset-repository");
  const { disconnectFreesound, connectionStatus } = await import("@/lib/integrations/freesound/oauth");
  const ids: string[] = [];
  try {
    for (let i = 0; i < 2; i++) ids.push((await prisma.user.create({ data: { email: `${randomUUID()}@example.invalid`, role: "AUTHOR" } })).id);
    const upload = await prisma.mediaUpload.create({ data: {
      ownerId: ids[0], purpose: "personal_audio", mediaKind: "audio", objectKey: randomUUID(), contentType: "audio/wav", expectedSize: 100,
      expiresAt: new Date(Date.now() + 60_000), status: "COMPLETED", result: { kind: "audio", primary: { url: "https://media.example/test.wav", contentType: "audio/wav", size: 100, durationMs: 1000 } },
    } });
    const repo = new PrismaAudioAssetRepository(async () => prisma);
    await assert.rejects(repo.claimUpload(ids[1], upload.id, "stolen"), { status: 404 });
    const asset = await repo.claimUpload(ids[0], upload.id, "My audio");
    assert.equal((await repo.claimUpload(ids[0], upload.id, "Retry")).id, asset.id);
    assert.equal((await repo.getByOwner(ids[1])).length, 0);
    assert.equal((await repo.getByOwner(ids[0])).length, 1);
    assert.equal((await prisma.mediaUpload.findUniqueOrThrow({ where: { id: upload.id } })).status, "CLAIMED");
    await prisma.user.update({ where: { id: ids[0] }, data: { freesoundAccessTokenCiphertext: "ciphertext", freesoundRefreshTokenCiphertext: "ciphertext", freesoundTokenExpiresAt: new Date(), freesoundUsername: "creator" } });
    assert.equal((await connectionStatus(ids[0])).connected, true);
    await disconnectFreesound(ids[0]);
    assert.equal((await connectionStatus(ids[0])).connected, false);
    assert.equal((await repo.getByOwner(ids[0])).length, 1);
    console.log("P3-15 audio DB: owner isolation, atomic/idempotent upload claim and disconnect retention passed");
  } finally { await prisma.user.deleteMany({ where: { id: { in: ids } } }); await prisma.$disconnect(); }
}
run().catch((e: unknown) => { console.error("P3-15 audio DB failed", e instanceof assert.AssertionError ? e.message : e && typeof e === "object" && "code" in e ? e.code : "unclassified"); process.exitCode = 1; });
