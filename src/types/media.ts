export type MediaUploadPurpose =
  | "story_cover"
  | "personal_audio"
  | "personal_background"
  | "global_background";

export type MediaKind = "image" | "audio" | "video";
export type MediaUploadStatus =
  | "pending"
  | "processing"
  | "completed"
  | "claimed"
  | "cancelled"
  | "expired"
  | "rejected";

export interface UploadFileDescriptor {
  name: string;
  contentType: string;
  size: number;
}

export interface StoredMediaPart {
  url: string;
  contentType: string;
  size: number;
  etag?: string;
  width?: number;
  height?: number;
  durationMs?: number;
}

export interface CompletedMediaUpload {
  kind: MediaKind;
  primary: StoredMediaPart;
  poster?: StoredMediaPart;
}

export interface MediaUploadRecord {
  id: string;
  ownerId: string;
  purpose: MediaUploadPurpose;
  mediaKind: MediaKind;
  videoSlot: number | null;
  objectKey: string;
  contentType: string;
  expectedSize: number;
  posterObjectKey: string | null;
  posterContentType: string | null;
  posterExpectedSize: number | null;
  status: MediaUploadStatus;
  result: CompletedMediaUpload | null;
  expiresAt: Date;
  completedAt: Date | null;
}
