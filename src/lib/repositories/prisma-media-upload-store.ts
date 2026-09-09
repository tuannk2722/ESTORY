import "server-only";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import {
  completedMediaUploadSchema, mediaKindSchema, mediaUploadPurposeSchema,
} from "@/lib/validation/media-upload-schema";
import { PERSONAL_VIDEO_SLOT_LIMIT } from "@/lib/media/constants";
import { CommandError } from "@/lib/services/command-error";
import { loadRuntimePrismaClient } from "./prisma-read-client";
import type {
  CreatedMediaUpload, CreateMediaUploadInput, MediaUploadStore,
} from "./media-upload-store";
import type { CompletedMediaUpload, MediaUploadRecord, MediaUploadStatus } from "@/types/media";

type UploadRow = Awaited<ReturnType<Prisma.TransactionClient["mediaUpload"]["findFirst"]>> extends infer Row
  ? NonNullable<Row>
  : never;

const statusFromDatabase = {
  PENDING: "pending", PROCESSING: "processing", COMPLETED: "completed", CLAIMED: "claimed",
  CANCELLED: "cancelled", EXPIRED: "expired", REJECTED: "rejected",
} as const satisfies Record<string, MediaUploadStatus>;

function mapRow(row: UploadRow): MediaUploadRecord {
  return {
    id: row.id,
    ownerId: row.ownerId,
    purpose: mediaUploadPurposeSchema.parse(row.purpose),
    mediaKind: mediaKindSchema.parse(row.mediaKind),
    videoSlot: row.videoSlot,
    objectKey: row.objectKey,
    contentType: row.contentType,
    expectedSize: row.expectedSize,
    posterObjectKey: row.posterObjectKey,
    posterContentType: row.posterContentType,
    posterExpectedSize: row.posterExpectedSize,
    status: statusFromDatabase[row.status],
    result: row.result === null ? null : completedMediaUploadSchema.parse(row.result),
    expiresAt: row.expiresAt,
    completedAt: row.completedAt,
  };
}

function databaseCode(error: unknown): string | undefined {
  return error && typeof error === "object" && "code" in error && typeof error.code === "string"
    ? error.code
    : undefined;
}

export class PrismaMediaUploadStore implements MediaUploadStore {
  constructor(private readonly clientSource: () => Promise<PrismaClient> = loadRuntimePrismaClient) {}

  async create(input: CreateMediaUploadInput): Promise<CreatedMediaUpload> {
    const db = await this.clientSource();
    for (let attempt = 0; attempt < PERSONAL_VIDEO_SLOT_LIMIT + 1; attempt += 1) {
      try {
        return await db.$transaction(async (tx) => {
          let videoSlot: number | null = null;
          let videoQuotaUsed: number | undefined;
          if (input.reservePersonalVideoSlot) {
            const rows = await tx.mediaUpload.findMany({
              where: { ownerId: input.ownerId, videoSlot: { not: null } },
              select: { videoSlot: true },
            });
            const used = new Set(rows.flatMap((row) => row.videoSlot === null ? [] : [row.videoSlot]));
            videoSlot = Array.from({ length: PERSONAL_VIDEO_SLOT_LIMIT }, (_, index) => index + 1)
              .find((candidate) => !used.has(candidate)) ?? null;
            if (videoSlot === null) {
              throw new CommandError(429, "VIDEO_UPLOAD_LIMIT_REACHED", "You have reached the limit of 10 background videos");
            }
            videoQuotaUsed = used.size + 1;
          }
          const row = await tx.mediaUpload.create({ data: {
            id: input.id,
            ownerId: input.ownerId,
            purpose: input.purpose,
            mediaKind: input.mediaKind,
            videoSlot,
            objectKey: input.objectKey,
            contentType: input.contentType,
            expectedSize: input.expectedSize,
            posterObjectKey: input.posterObjectKey,
            posterContentType: input.posterContentType,
            posterExpectedSize: input.posterExpectedSize,
            expiresAt: input.expiresAt,
          } });
          return { record: mapRow(row), ...(videoQuotaUsed === undefined ? {} : { videoQuotaUsed }) };
        }, { isolationLevel: "Serializable", maxWait: 10_000, timeout: 30_000 });
      } catch (error) {
        if (error instanceof CommandError) throw error;
        if (["P2002", "P2034"].includes(databaseCode(error) ?? "") && attempt < PERSONAL_VIDEO_SLOT_LIMIT) continue;
        throw error;
      }
    }
    throw new CommandError(409, "UPLOAD_RESERVATION_CONFLICT", "Could not reserve an upload slot. Retry.");
  }

  async getOwned(id: string, ownerId: string): Promise<MediaUploadRecord | null> {
    const db = await this.clientSource();
    const row = await db.mediaUpload.findFirst({ where: { id, ownerId } });
    return row ? mapRow(row) : null;
  }

  async transition(
    record: MediaUploadRecord,
    expected: MediaUploadRecord["status"][],
    status: MediaUploadRecord["status"],
    releaseVideoSlot = false,
  ): Promise<MediaUploadRecord> {
    const db = await this.clientSource();
    const databaseStatuses = expected.map((value) => value.toUpperCase()) as Array<keyof typeof statusFromDatabase>;
    const databaseStatus = status.toUpperCase() as keyof typeof statusFromDatabase;
    await db.mediaUpload.updateMany({
      where: { id: record.id, ownerId: record.ownerId, status: { in: databaseStatuses } },
      data: { status: databaseStatus, ...(releaseVideoSlot ? { videoSlot: null } : {}) },
    });
    const updated = await db.mediaUpload.findFirst({ where: { id: record.id, ownerId: record.ownerId } });
    if (!updated) throw new CommandError(404, "NOT_FOUND", "Resource not found");
    return mapRow(updated);
  }

  async complete(record: MediaUploadRecord, result: CompletedMediaUpload, completedAt: Date): Promise<MediaUploadRecord> {
    const db = await this.clientSource();
    await db.mediaUpload.updateMany({
      where: { id: record.id, ownerId: record.ownerId, status: "PROCESSING" },
      data: { status: "COMPLETED", result: result as unknown as Prisma.InputJsonValue, completedAt },
    });
    const updated = await db.mediaUpload.findFirst({ where: { id: record.id, ownerId: record.ownerId } });
    if (!updated) throw new CommandError(404, "NOT_FOUND", "Resource not found");
    return mapRow(updated);
  }

}
