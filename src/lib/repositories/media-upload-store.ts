import type { CompletedMediaUpload, MediaKind, MediaUploadPurpose, MediaUploadRecord } from "@/types/media";

export interface CreateMediaUploadInput {
  id: string;
  ownerId: string;
  purpose: MediaUploadPurpose;
  mediaKind: MediaKind;
  objectKey: string;
  contentType: string;
  expectedSize: number;
  posterObjectKey: string | null;
  posterContentType: string | null;
  posterExpectedSize: number | null;
  expiresAt: Date;
  reservePersonalVideoSlot: boolean;
}

export interface CreatedMediaUpload {
  record: MediaUploadRecord;
  videoQuotaUsed?: number;
}

export interface MediaUploadStore {
  create(input: CreateMediaUploadInput): Promise<CreatedMediaUpload>;
  getOwned(id: string, ownerId: string): Promise<MediaUploadRecord | null>;
  transition(
    record: MediaUploadRecord,
    expected: MediaUploadRecord["status"][],
    status: MediaUploadRecord["status"],
    releaseVideoSlot?: boolean,
  ): Promise<MediaUploadRecord>;
  complete(record: MediaUploadRecord, result: CompletedMediaUpload, completedAt: Date): Promise<MediaUploadRecord>;
}
