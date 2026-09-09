import { createHash, randomUUID } from "node:crypto";
import { hasMinimumRole, type SessionUser } from "@/lib/auth/policy";
import {
  acceptedImageContentTypes, AUDIO_MAX_BYTES, IMAGE_INSPECTION_BYTES,
  mediaContentTypes, PERSONAL_VIDEO_SLOT_LIMIT, PRESIGNED_PUT_TTL_SECONDS,
  purposeRules, VIDEO_INSPECTION_BYTES,
  type AcceptedMediaContentType,
} from "@/lib/media/constants";
import { inspectMedia, MediaInspectionError } from "@/lib/media/inspect-media";
import type { MediaUploadStore } from "@/lib/repositories/media-upload-store";
import type { MediaStorageProvider } from "@/lib/storage/media-storage-provider";
import { CommandError } from "./command-error";
import type {
  CompletedMediaUpload, MediaUploadPurpose, MediaUploadRecord,
  StoredMediaPart, UploadFileDescriptor,
} from "@/types/media";

export interface UploadServiceOptions {
  keyPrefix: string;
  now?: () => Date;
  createId?: () => string;
}

interface UploadRequest {
  purpose: MediaUploadPurpose;
  file: UploadFileDescriptor;
  poster?: UploadFileDescriptor;
}

class IncompleteUploadError extends Error {}

function contentType(value: string): AcceptedMediaContentType {
  if (!(value in mediaContentTypes)) {
    throw new CommandError(400, "UNSUPPORTED_MEDIA_TYPE", "Unsupported media type", { "file.contentType": ["Unsupported media type"] });
  }
  return value as AcceptedMediaContentType;
}

function fileExtension(name: string): string {
  const index = name.lastIndexOf(".");
  return index < 0 ? "" : name.slice(index + 1).toLowerCase();
}

function validateDescriptor(file: UploadFileDescriptor, field: "file" | "poster") {
  const type = contentType(file.contentType);
  const rule = mediaContentTypes[type];
  if (!rule.filenameExtensions.includes(fileExtension(file.name) as never)) {
    throw new CommandError(400, "MEDIA_EXTENSION_MISMATCH", "Filename extension does not match media type", {
      [`${field}.name`]: ["Filename extension does not match media type"],
    });
  }
  if (file.size > rule.maxBytes) {
    throw new CommandError(413, "MEDIA_TOO_LARGE", "Media file exceeds its size limit", {
      [`${field}.size`]: ["File exceeds its size limit"],
    });
  }
  return { type, rule };
}

function ownerKey(ownerId: string): string {
  return createHash("sha256").update(ownerId).digest("hex").slice(0, 24);
}

function recordKeys(record: MediaUploadRecord): string[] {
  return [record.objectKey, ...(record.posterObjectKey ? [record.posterObjectKey] : [])];
}

export class UploadService {
  private readonly now: () => Date;
  private readonly createId: () => string;

  constructor(
    private readonly store: MediaUploadStore,
    private readonly storage: MediaStorageProvider,
    private readonly options: UploadServiceOptions,
  ) {
    this.now = options.now ?? (() => new Date());
    this.createId = options.createId ?? randomUUID;
  }

  async requestUpload(actor: SessionUser, input: UploadRequest) {
    const purpose = purposeRules[input.purpose];
    if (!hasMinimumRole(actor.role, purpose.minimumRole)) {
      throw new CommandError(403, "FORBIDDEN", "Insufficient permissions");
    }
    const primary = validateDescriptor(input.file, "file");
    const kind = primary.rule.kind;
    if (!purpose.kinds.includes(kind)) {
      throw new CommandError(400, "INVALID_MEDIA_PURPOSE", "Media type is not allowed for this purpose", {
        "file.contentType": ["Media type is not allowed for this purpose"],
      });
    }
    if (kind === "video" && !input.poster) {
      throw new CommandError(400, "POSTER_REQUIRED", "Background videos require a poster image", {
        poster: ["Select a poster image for this video"],
      });
    }
    if (kind !== "video" && input.poster) {
      throw new CommandError(400, "POSTER_NOT_ALLOWED", "Poster is only accepted with a background video", {
        poster: ["Poster is only accepted with a background video"],
      });
    }
    const poster = input.poster ? validateDescriptor(input.poster, "poster") : null;
    if (poster && !acceptedImageContentTypes.includes(poster.type)) {
      throw new CommandError(400, "INVALID_POSTER_TYPE", "Poster must be a JPEG, PNG or WebP image", {
        "poster.contentType": ["Poster must be an image"],
      });
    }

    const uploadId = this.createId();
    const segment = purpose.ownerSegment === "global" ? "global" : ownerKey(actor.id);
    const makeKey = (type: AcceptedMediaContentType) =>
      `${this.options.keyPrefix}/${input.purpose}/${segment}/${this.createId()}.${mediaContentTypes[type].extension}`;
    const objectKey = makeKey(primary.type);
    const posterObjectKey = poster ? makeKey(poster.type) : null;
    const expiresAt = new Date(this.now().getTime() + PRESIGNED_PUT_TTL_SECONDS * 1000);
    const created = await this.store.create({
      id: uploadId,
      ownerId: actor.id,
      purpose: input.purpose,
      mediaKind: kind,
      objectKey,
      contentType: primary.type,
      expectedSize: input.file.size,
      posterObjectKey,
      posterContentType: poster?.type ?? null,
      posterExpectedSize: input.poster?.size ?? null,
      expiresAt,
      reservePersonalVideoSlot: input.purpose === "personal_background" && kind === "video",
    });
    try {
      const signed = await Promise.all([
        this.storage.presignPut({ key: objectKey, contentType: primary.type, expiresInSeconds: PRESIGNED_PUT_TTL_SECONDS }),
        ...(poster && posterObjectKey
          ? [this.storage.presignPut({ key: posterObjectKey, contentType: poster.type, expiresInSeconds: PRESIGNED_PUT_TTL_SECONDS })]
          : []),
      ]);
      return {
        uploadId,
        purpose: input.purpose,
        kind,
        status: "pending" as const,
        expiresAt: expiresAt.toISOString(),
        parts: signed.map((part, index) => ({ role: index === 0 ? "primary" as const : "poster" as const, ...part })),
        ...(created.videoQuotaUsed === undefined ? {} : {
          videoQuota: { used: created.videoQuotaUsed, limit: PERSONAL_VIDEO_SLOT_LIMIT as 10 },
        }),
      };
    } catch {
      await this.store.transition(created.record, ["pending"], "rejected", true);
      throw new CommandError(503, "MEDIA_STORAGE_UNAVAILABLE", "Media storage is temporarily unavailable");
    }
  }

  private async inspectPart(
    key: string,
    expectedType: AcceptedMediaContentType,
    expectedSize: number,
  ): Promise<StoredMediaPart> {
    const head = await this.storage.headObject(key);
    if (!head) throw new IncompleteUploadError("Object is not available yet");
    if (head.size !== expectedSize || head.contentType?.toLowerCase() !== expectedType) {
      throw new MediaInspectionError("Object metadata does not match the upload intent");
    }
    const kind = mediaContentTypes[expectedType].kind;
    const inspectionBytes = kind === "audio"
      ? Math.min(expectedSize, AUDIO_MAX_BYTES)
      : kind === "image"
        ? Math.min(expectedSize, IMAGE_INSPECTION_BYTES)
        : Math.min(expectedSize, VIDEO_INSPECTION_BYTES);
    const bytes = await this.storage.readObject(key, inspectionBytes);
    const metadata = inspectMedia(expectedType, bytes);
    return {
      url: this.storage.publicUrl(key),
      contentType: expectedType,
      size: head.size,
      ...(head.etag ? { etag: head.etag } : {}),
      ...metadata,
    };
  }

  private async cleanup(record: MediaUploadRecord): Promise<boolean> {
    const outcomes = await Promise.allSettled(recordKeys(record).map((key) => this.storage.deleteObject(key)));
    return outcomes.every((outcome) => outcome.status === "fulfilled");
  }

  private requireCurrentPurposeRole(actor: SessionUser, record: MediaUploadRecord): void {
    const rule = purposeRules[record.purpose];
    if (!rule || !hasMinimumRole(actor.role, rule.minimumRole)) {
      throw new CommandError(403, "FORBIDDEN", "Insufficient permissions");
    }
  }

  async completeUpload(actor: SessionUser, uploadId: string) {
    const record = await this.store.getOwned(uploadId, actor.id);
    if (!record) throw new CommandError(404, "NOT_FOUND", "Resource not found");
    this.requireCurrentPurposeRole(actor, record);
    if (record.status === "completed" || record.status === "claimed") {
      if (!record.result) throw new CommandError(409, "UPLOAD_STATE_INVALID", "Upload state is invalid");
      return { uploadId, status: "completed" as const, media: record.result };
    }
    if (record.status === "processing") {
      throw new CommandError(409, "UPLOAD_PROCESSING", "Upload validation is already in progress");
    }
    if (record.status !== "pending") {
      throw new CommandError(409, "UPLOAD_NOT_PENDING", "Upload can no longer be completed");
    }
    const processing = await this.store.transition(record, ["pending"], "processing");
    if (processing.status !== "processing") {
      if ((processing.status === "completed" || processing.status === "claimed") && processing.result) {
        return { uploadId, status: "completed" as const, media: processing.result };
      }
      throw new CommandError(409, "UPLOAD_NOT_PENDING", "Upload can no longer be completed");
    }
    if (processing.expiresAt.getTime() <= this.now().getTime()) {
      const cleaned = await this.cleanup(processing);
      await this.store.transition(processing, ["processing"], "expired", cleaned);
      throw new CommandError(409, "UPLOAD_EXPIRED", "Upload URL has expired. Start a new upload.");
    }
    try {
      const primary = await this.inspectPart(
        processing.objectKey,
        contentType(processing.contentType),
        processing.expectedSize,
      );
      const poster = processing.posterObjectKey && processing.posterContentType && processing.posterExpectedSize
        ? await this.inspectPart(processing.posterObjectKey, contentType(processing.posterContentType), processing.posterExpectedSize)
        : undefined;
      if (processing.mediaKind === "video" && !poster) throw new MediaInspectionError("Video poster is missing");
      const result: CompletedMediaUpload = {
        kind: processing.mediaKind,
        primary,
        ...(poster ? { poster } : {}),
      };
      const completed = await this.store.complete(processing, result, this.now());
      if (!completed.result) throw new CommandError(409, "UPLOAD_STATE_INVALID", "Upload state is invalid");
      return { uploadId, status: "completed" as const, media: completed.result };
    } catch (error) {
      if (error instanceof IncompleteUploadError) {
        await this.store.transition(processing, ["processing"], "pending");
        throw new CommandError(409, "UPLOAD_INCOMPLETE", "Upload has not finished. Retry after every file is uploaded.");
      }
      if (error instanceof MediaInspectionError) {
        const cleaned = await this.cleanup(processing);
        await this.store.transition(processing, ["processing"], "rejected", cleaned);
        throw new CommandError(400, "UPLOAD_REJECTED", "Uploaded media failed server validation");
      }
      if (error instanceof CommandError) throw error;
      await this.store.transition(processing, ["processing"], "pending");
      throw new CommandError(503, "MEDIA_STORAGE_UNAVAILABLE", "Media storage is temporarily unavailable");
    }
  }

  async cancelUpload(actor: SessionUser, uploadId: string) {
    const record = await this.store.getOwned(uploadId, actor.id);
    if (!record) throw new CommandError(404, "NOT_FOUND", "Resource not found");
    this.requireCurrentPurposeRole(actor, record);
    if (record.status === "cancelled") {
      const cleaned = await this.cleanup(record);
      if (cleaned && record.videoSlot !== null) {
        await this.store.transition(record, ["cancelled"], "cancelled", true);
      }
      return { uploadId, status: "cancelled" as const };
    }
    if (record.status === "processing") {
      throw new CommandError(409, "UPLOAD_PROCESSING", "Upload validation is already in progress");
    }
    if (record.status !== "pending") {
      throw new CommandError(409, "UPLOAD_NOT_PENDING", "Upload can no longer be cancelled");
    }
    const cancelled = await this.store.transition(record, ["pending"], "cancelled");
    if (cancelled.status !== "cancelled") {
      throw new CommandError(409, "UPLOAD_NOT_PENDING", "Upload can no longer be cancelled");
    }
    const cleaned = await this.cleanup(cancelled);
    if (cleaned) await this.store.transition(cancelled, ["cancelled"], "cancelled", true);
    return { uploadId, status: "cancelled" as const };
  }
}
