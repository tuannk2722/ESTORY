import "server-only";
import type { AudioAsset as AudioRow, PrismaClient } from "@/generated/prisma/client";
import type { AudioAssetRepository } from "./audio-asset-repository";
import { loadRuntimePrismaClient } from "./prisma-read-client";
import { audioAssetSchema } from "@/lib/validation/audio-asset-schema";
import { completedMediaUploadSchema } from "@/lib/validation/media-upload-schema";
import { conflict, notFound } from "@/lib/services/command-error";

export function mapAudioAsset(row: AudioRow) {
  return audioAssetSchema.parse({
    id: row.id, owner_id: row.ownerId, source: row.source, title: row.title, url: row.url,
    duration_ms: row.durationMs, created_at: row.createdAt.toISOString(),
    ...(row.freesoundId ? { freesound_id: row.freesoundId } : {}),
    ...(row.license ? { license: row.license } : {}),
    ...(row.attributionAuthorName && row.attributionSourceUrl && row.attributionLicenseName ? { attribution: {
      author_name: row.attributionAuthorName, source_url: row.attributionSourceUrl, license_name: row.attributionLicenseName,
    } } : {}),
  });
}

export class PrismaAudioAssetRepository implements AudioAssetRepository {
  constructor(private readonly clientSource: () => Promise<PrismaClient> = loadRuntimePrismaClient) {}
  async getByOwner(ownerId: string) {
    const db = await this.clientSource();
    return (await db.audioAsset.findMany({ where: { ownerId }, orderBy: [{ createdAt: "desc" }, { id: "asc" }] })).map(mapAudioAsset);
  }
  async getById(id: string) {
    const db = await this.clientSource();
    const row = await db.audioAsset.findUnique({ where: { id } });
    return row ? mapAudioAsset(row) : null;
  }
  async claimUpload(ownerId: string, uploadId: string, title: string) {
    const db = await this.clientSource();
    return db.$transaction(async (tx) => {
      // The upload's unique server ID is also the asset ID: retries never create duplicates.
      const existing = await tx.audioAsset.findFirst({ where: { id: uploadId, ownerId, source: "upload" } });
      if (existing) return mapAudioAsset(existing);
      const upload = await tx.mediaUpload.findFirst({ where: { id: uploadId, ownerId, purpose: "personal_audio", mediaKind: "audio" } });
      if (!upload) notFound();
      if (upload.status !== "COMPLETED") conflict("UPLOAD_NOT_CLAIMABLE", "Audio upload is not ready");
      const media = completedMediaUploadSchema.parse(upload.result);
      if (!media.primary.durationMs) conflict("INVALID_AUDIO", "Audio duration is missing");
      const claimed = await tx.mediaUpload.updateMany({ where: { id: uploadId, ownerId, status: "COMPLETED" }, data: { status: "CLAIMED", claimedAt: new Date() } });
      if (claimed.count !== 1) conflict("UPLOAD_NOT_CLAIMABLE", "Audio upload was already claimed; reload your library");
      return mapAudioAsset(await tx.audioAsset.create({ data: {
        id: uploadId, ownerId, source: "upload", title, url: media.primary.url, durationMs: media.primary.durationMs,
      } }));
    });
  }
}
