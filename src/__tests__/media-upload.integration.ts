import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { loadEnvConfig } from "@next/env";
import type { MediaStorageProvider, PresignPutInput } from "@/lib/storage/media-storage-provider";

loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production");

class IntegrationStorage implements MediaStorageProvider {
  readonly objects = new Map<string, { bytes: Uint8Array; contentType: string }>();
  async presignPut(input: PresignPutInput) {
    return { url: `https://upload.example.invalid/${encodeURIComponent(input.key)}`, headers: {
      "Content-Type": input.contentType, "If-None-Match": "*",
    } };
  }
  async headObject(key: string) {
    const object = this.objects.get(key);
    return object ? { size: object.bytes.byteLength, contentType: object.contentType, etag: "fixture" } : null;
  }
  async readObject(key: string, maxBytes: number) {
    const object = this.objects.get(key);
    if (!object) throw new Error("missing fixture object");
    return object.bytes.subarray(0, maxBytes);
  }
  async deleteObject(key: string) { this.objects.delete(key); }
  publicUrl(key: string) { return `https://media.example.invalid/${key}`; }
}

function png(): Uint8Array {
  const bytes = Buffer.alloc(24);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(bytes);
  bytes.writeUInt32BE(13, 8); bytes.write("IHDR", 12, "ascii");
  bytes.writeUInt32BE(1280, 16); bytes.writeUInt32BE(720, 20);
  return bytes;
}

let stage = "initialization";

async function run() {
  const { prisma } = await import("@/lib/db/prisma");
  const { PrismaMediaUploadStore } = await import("@/lib/repositories/prisma-media-upload-store");
  const { UploadService } = await import("@/lib/services/upload");
  const suffix = randomUUID();
  const userIds: string[] = [];
  const storage = new IntegrationStorage();
  try {
    stage = "create users";
    const [author, outsider] = await Promise.all([
      prisma.user.create({ data: { email: `media-author-${suffix}@example.invalid`, role: "AUTHOR" } }),
      prisma.user.create({ data: { email: `media-outsider-${suffix}@example.invalid`, role: "AUTHOR" } }),
    ]);
    userIds.push(author.id, outsider.id);
    let sequence = 0;
    const service = new UploadService(new PrismaMediaUploadStore(async () => prisma), storage, {
      keyPrefix: "integration",
      createId: () => `media-${suffix}-${++sequence}`,
    });
    const actor = { id: author.id, role: "author" as const, email: author.email, name: null, image: null };
    const requestVideo = () => service.requestUpload(actor, {
      purpose: "personal_background" as const,
      file: { name: "loop.mp4", contentType: "video/mp4", size: 16 },
      poster: { name: "poster.png", contentType: "image/png", size: 24 },
    });

    stage = "concurrent video-slot reservations";
    const reservations = await Promise.allSettled(Array.from({ length: 11 }, requestVideo));
    assert.equal(reservations.filter((result) => result.status === "fulfilled").length, 10);
    const quotaFailure = reservations.find((result) => result.status === "rejected") as PromiseRejectedResult;
    assert.equal(quotaFailure.reason.status, 429);
    const slots = await prisma.mediaUpload.findMany({ where: { ownerId: author.id }, select: { videoSlot: true } });
    assert.deepEqual(slots.map((row) => row.videoSlot).sort((a, b) => a! - b!), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

    stage = "owner isolation and cancellation release";
    const first = reservations.find((result): result is PromiseFulfilledResult<Awaited<ReturnType<typeof requestVideo>>> => result.status === "fulfilled")!.value;
    const outsiderActor = { id: outsider.id, role: "author" as const, email: outsider.email, name: null, image: null };
    await assert.rejects(service.cancelUpload(outsiderActor, first.uploadId), { status: 404 });
    await service.cancelUpload(actor, first.uploadId);
    assert.equal((await prisma.mediaUpload.findUniqueOrThrow({ where: { id: first.uploadId } })).videoSlot, null);
    assert.equal((await requestVideo()).videoQuota?.used, 10, "A physically cleaned cancellation releases exactly one slot");

    stage = "complete image and idempotency";
    const image = await service.requestUpload(actor, {
      purpose: "personal_background", file: { name: "still.png", contentType: "image/png", size: 24 },
    });
    const row = await prisma.mediaUpload.findUniqueOrThrow({ where: { id: image.uploadId } });
    storage.objects.set(row.objectKey, { bytes: png(), contentType: "image/png" });
    const completed = await service.completeUpload(actor, image.uploadId);
    assert.equal(completed.media.primary.width, 1280);
    assert.equal((await prisma.mediaUpload.findUniqueOrThrow({ where: { id: image.uploadId } })).status, "COMPLETED");
    assert.deepEqual(await service.completeUpload(actor, image.uploadId), completed);

    stage = "owner cascade";
    await prisma.user.delete({ where: { id: author.id } });
    userIds.splice(userIds.indexOf(author.id), 1);
    assert.equal(await prisma.mediaUpload.count({ where: { ownerId: author.id } }), 0, "Upload intents cascade with their owner");
    console.log("P3-09 DB: durable intents, concurrent 10-slot quota, owner isolation, cleanup release, completion and cascade passed");
  } finally {
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  }
}

run().catch((error: unknown) => {
  const code = error && typeof error === "object" && "code" in error && typeof error.code === "string"
    ? error.code
    : undefined;
  const detail = error instanceof assert.AssertionError ? error.message
    : error instanceof Error && error.name === "CommandError" ? error.message
      : `database or storage operation failed${code ? ` (${code})` : ""}`;
  console.error(`P3-09 DB integration failed at ${stage}: ${detail}. Credentials and row contents are not logged.`);
  process.exitCode = 1;
});
