import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production");
async function run() {
  const { prisma } = await import("@/lib/db/prisma");
  const { serverEnv } = await import("@/lib/env");
  const { requireR2Environment } = await import("@/lib/config/environment");
  const { R2MediaStorageProvider } = await import("@/lib/storage/r2-media-storage-provider");
  const { UploadService } = await import("@/lib/services/upload");
  const { PrismaMediaUploadStore } = await import("@/lib/repositories/prisma-media-upload-store");
  const { PrismaAudioAssetRepository } = await import("@/lib/repositories/prisma-audio-asset-repository");
  const { normalizeAudio } = await import("@/lib/media/normalize-audio");
  const env = requireR2Environment(serverEnv);
  const storage = new R2MediaStorageProvider({ accountId: env.R2_ACCOUNT_ID, accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY, bucket: env.R2_BUCKET_NAME, publicBaseUrl: env.R2_PUBLIC_BASE_URL });
  const wav = Buffer.alloc(44 + 88_200);
  wav.write("RIFF"); wav.writeUInt32LE(wav.length - 8, 4); wav.write("WAVEfmt ", 8);
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22); wav.writeUInt32LE(44_100, 24); wav.writeUInt32LE(88_200, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write("data", 36); wav.writeUInt32LE(88_200, 40);
  let ownerId: string | undefined;
  const keys: string[] = [];
  try {
    const user = await prisma.user.create({ data: { email: `audio-r2-${randomUUID()}@example.invalid`, role: "AUTHOR" } }); ownerId = user.id;
    const service = new UploadService(new PrismaMediaUploadStore(async () => prisma), storage, { keyPrefix: env.R2_KEY_PREFIX });
    const actor = { id: user.id, role: "author" as const, email: user.email, name: null, image: null };
    const normalized = await normalizeAudio(wav);
    for (const [name, contentType, bytes] of [["fixture.wav", "audio/wav", wav], ["fixture.mp3", "audio/mpeg", normalized.bytes]] as const) {
      const intent = await service.requestUpload(actor, { purpose: "personal_audio", file: { name, contentType, size: bytes.length } });
      const row = await prisma.mediaUpload.findUniqueOrThrow({ where: { id: intent.uploadId } }); keys.push(row.objectKey);
      const put = await fetch(intent.parts[0].url, { method: "PUT", headers: intent.parts[0].headers, body: Buffer.from(bytes), signal: AbortSignal.timeout(20_000) });
      assert.ok(put.ok);
      const completed = await service.completeUpload(actor, intent.uploadId);
      assert.ok(completed.media.primary.durationMs! >= 1000);
      const asset = await new PrismaAudioAssetRepository(async () => prisma).claimUpload(user.id, intent.uploadId, name);
      const publicMedia = await fetch(asset.url, { signal: AbortSignal.timeout(20_000) });
      assert.ok(publicMedia.ok); assert.equal((await publicMedia.arrayBuffer()).byteLength, bytes.length);
    }
    assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: ownerId } })).freesoundImportQuotaUsed, 0);
    console.log("P3-15 live R2: WAV/normalized MP3 PUT, server validation, owner claim, public bytes and quota-free upload passed");
  } finally {
    for (const key of keys) await storage.deleteObject(key);
    if (ownerId) await prisma.user.delete({ where: { id: ownerId } });
    await prisma.$disconnect();
  }
}
run().catch((e: unknown) => { console.error("P3-15 audio R2 failed", e instanceof assert.AssertionError ? e.message : "operation failed"); process.exitCode = 1; });
