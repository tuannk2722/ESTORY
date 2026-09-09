import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production");

function png(): Buffer {
  const bytes = Buffer.alloc(24);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(bytes);
  bytes.writeUInt32BE(13, 8);
  bytes.write("IHDR", 12, "ascii");
  bytes.writeUInt32BE(1280, 16);
  bytes.writeUInt32BE(720, 20);
  return bytes;
}

function mp4(): Buffer {
  return Buffer.from([0, 0, 0, 16, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d, 0, 0, 0, 0]);
}

function requestBody(bytes: Buffer): ArrayBuffer {
  return Uint8Array.from(bytes).buffer;
}

let stage = "initialization";

async function run() {
  const { requireR2Environment } = await import("@/lib/config/environment");
  const { serverEnv } = await import("@/lib/env");
  const env = requireR2Environment(serverEnv);
  assert.ok(env.AUTH_URL, "AUTH_URL is required for the R2 browser CORS smoke");

  const { prisma } = await import("@/lib/db/prisma");
  const { PrismaMediaUploadStore } = await import("@/lib/repositories/prisma-media-upload-store");
  const { UploadService } = await import("@/lib/services/upload");
  const { R2MediaStorageProvider } = await import("@/lib/storage/r2-media-storage-provider");
  const provider = new R2MediaStorageProvider({
    accountId: env.R2_ACCOUNT_ID,
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    bucket: env.R2_BUCKET_NAME,
    publicBaseUrl: env.R2_PUBLIC_BASE_URL,
  });
  const suffix = randomUUID();
  const extraCleanupKeys: string[] = [];
  let ownerId: string | undefined;

  const uploadPart = async (part: { url: string; headers: Record<string, string> }, bytes: Buffer) => {
    const response = await fetch(part.url, { method: "PUT", headers: part.headers, body: requestBody(bytes) });
    assert.ok(response.ok, `R2 PUT failed with status ${response.status}`);
  };

  try {
    stage = "create disposable author";
    const author = await prisma.user.create({
      data: { email: `media-r2-${suffix}@example.invalid`, role: "AUTHOR" },
    });
    ownerId = author.id;
    const actor = { id: author.id, role: "author" as const, email: author.email, name: null, image: null };
    const service = new UploadService(new PrismaMediaUploadStore(async () => prisma), provider, {
      keyPrefix: env.R2_KEY_PREFIX,
    });

    stage = "presigned browser CORS and immutable image PUT";
    const imageBytes = png();
    const imageIntent = await service.requestUpload(actor, {
      purpose: "story_cover",
      file: { name: "cover.png", contentType: "image/png", size: imageBytes.byteLength },
    });
    const imagePart = imageIntent.parts[0];
    const origin = new URL(env.AUTH_URL).origin;
    const preflight = await fetch(imagePart.url, {
      method: "OPTIONS",
      headers: {
        Origin: origin,
        "Access-Control-Request-Method": "PUT",
        "Access-Control-Request-Headers": "content-type,cache-control,if-none-match",
      },
    });
    assert.ok(preflight.ok, `R2 CORS preflight failed with status ${preflight.status}`);
    assert.ok([origin, "*"].includes(preflight.headers.get("access-control-allow-origin") ?? ""));
    const allowedHeaders = (preflight.headers.get("access-control-allow-headers") ?? "").toLowerCase();
    assert.ok(allowedHeaders === "*" || ["content-type", "cache-control", "if-none-match"]
      .every((header) => allowedHeaders.includes(header)), "R2 CORS does not allow every signed PUT header");
    await uploadPart(imagePart, imageBytes);
    const reused = await fetch(imagePart.url, { method: "PUT", headers: imagePart.headers, body: requestBody(imageBytes) });
    assert.equal(reused.status, 412, "If-None-Match must reject presigned URL reuse");
    const completedImage = await service.completeUpload(actor, imageIntent.uploadId);
    assert.deepEqual(
      { width: completedImage.media.primary.width, height: completedImage.media.primary.height },
      { width: 1280, height: 720 },
    );
    const publicImage = await fetch(completedImage.media.primary.url, { cache: "no-store" });
    assert.ok(publicImage.ok, `R2 public media URL failed with status ${publicImage.status}`);
    assert.deepEqual(Buffer.from(await publicImage.arrayBuffer()), imageBytes);

    stage = "video and required poster bundle";
    const videoBytes = mp4();
    const videoIntent = await service.requestUpload(actor, {
      purpose: "personal_background",
      file: { name: "loop.mp4", contentType: "video/mp4", size: videoBytes.byteLength },
      poster: { name: "poster.png", contentType: "image/png", size: imageBytes.byteLength },
    });
    assert.deepEqual(videoIntent.parts.map((part) => part.role), ["primary", "poster"]);
    await Promise.all([
      uploadPart(videoIntent.parts[0], videoBytes),
      uploadPart(videoIntent.parts[1], imageBytes),
    ]);
    const completedVideo = await service.completeUpload(actor, videoIntent.uploadId);
    assert.equal(completedVideo.media.kind, "video");
    assert.equal(completedVideo.media.poster?.contentType, "image/png");

    stage = "partial upload cancellation and physical cleanup";
    const partialIntent = await service.requestUpload(actor, {
      purpose: "personal_background",
      file: { name: "partial.mp4", contentType: "video/mp4", size: videoBytes.byteLength },
      poster: { name: "poster.png", contentType: "image/png", size: imageBytes.byteLength },
    });
    const partialRow = await prisma.mediaUpload.findUniqueOrThrow({ where: { id: partialIntent.uploadId } });
    await uploadPart(partialIntent.parts[0], videoBytes);
    await service.cancelUpload(actor, partialIntent.uploadId);
    assert.equal(await provider.headObject(partialRow.objectKey), null);
    assert.equal((await prisma.mediaUpload.findUniqueOrThrow({ where: { id: partialIntent.uploadId } })).videoSlot, null);

    stage = "presigned URL expiry";
    const expiredKey = `${env.R2_KEY_PREFIX}/smoke/${randomUUID()}.png`;
    extraCleanupKeys.push(expiredKey);
    const expiring = await provider.presignPut({ key: expiredKey, contentType: "image/png", expiresInSeconds: 1 });
    await new Promise((resolve) => setTimeout(resolve, 2_100));
    const expiredPut = await fetch(expiring.url, { method: "PUT", headers: expiring.headers, body: requestBody(imageBytes) });
    assert.equal(expiredPut.status, 403, "Expired presigned URL must be rejected");

    console.log("P3-09 live R2: CORS, conditional PUT/reuse, expiry, public delivery, image/video+poster completion and cancellation cleanup passed");
  } finally {
    if (ownerId) {
      const rows = await prisma.mediaUpload.findMany({ where: { ownerId }, select: { objectKey: true, posterObjectKey: true } });
      const keys = rows.flatMap((row) => [row.objectKey, ...(row.posterObjectKey ? [row.posterObjectKey] : [])]);
      const cleanup = await Promise.allSettled([...keys, ...extraCleanupKeys].map((key) => provider.deleteObject(key)));
      assert.ok(cleanup.every((result) => result.status === "fulfilled"), "R2 fixture cleanup failed");
      await prisma.user.deleteMany({ where: { id: ownerId } });
    }
    await prisma.$disconnect();
  }
}

run().catch((error: unknown) => {
  const detail = error instanceof assert.AssertionError ? error.message
    : error instanceof Error && error.name === "CommandError" ? error.message
      : "database, network or R2 operation failed";
  console.error(`P3-09 live R2 integration failed at ${stage}: ${detail}. Credentials, object keys and signed URLs are not logged.`);
  process.exitCode = 1;
});
