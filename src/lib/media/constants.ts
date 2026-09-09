import type { MediaKind, MediaUploadPurpose } from "@/types/media";

export const MEBIBYTE = 1024 * 1024;
export const IMAGE_MAX_BYTES = 5 * MEBIBYTE;
export const AUDIO_MAX_BYTES = 8 * MEBIBYTE;
export const BACKGROUND_VIDEO_MAX_BYTES = 50 * MEBIBYTE;
export const AUDIO_MAX_DURATION_MS = 5 * 60 * 1000;
export const PERSONAL_VIDEO_SLOT_LIMIT = 10;
export const PRESIGNED_PUT_TTL_SECONDS = 10 * 60;
export const IMAGE_INSPECTION_BYTES = MEBIBYTE;
export const VIDEO_INSPECTION_BYTES = 64 * 1024;
export const IMMUTABLE_CACHE_CONTROL = "public, max-age=31536000, immutable";

export const mediaContentTypes = {
  "image/jpeg": { kind: "image", extension: "jpg", filenameExtensions: ["jpg", "jpeg"], maxBytes: IMAGE_MAX_BYTES },
  "image/png": { kind: "image", extension: "png", filenameExtensions: ["png"], maxBytes: IMAGE_MAX_BYTES },
  "image/webp": { kind: "image", extension: "webp", filenameExtensions: ["webp"], maxBytes: IMAGE_MAX_BYTES },
  "audio/mpeg": { kind: "audio", extension: "mp3", filenameExtensions: ["mp3"], maxBytes: AUDIO_MAX_BYTES },
  "audio/wav": { kind: "audio", extension: "wav", filenameExtensions: ["wav"], maxBytes: AUDIO_MAX_BYTES },
  "audio/x-wav": { kind: "audio", extension: "wav", filenameExtensions: ["wav"], maxBytes: AUDIO_MAX_BYTES },
  "audio/ogg": { kind: "audio", extension: "ogg", filenameExtensions: ["ogg", "oga"], maxBytes: AUDIO_MAX_BYTES },
  "video/mp4": { kind: "video", extension: "mp4", filenameExtensions: ["mp4"], maxBytes: BACKGROUND_VIDEO_MAX_BYTES },
  "video/webm": { kind: "video", extension: "webm", filenameExtensions: ["webm"], maxBytes: BACKGROUND_VIDEO_MAX_BYTES },
} as const satisfies Record<string, {
  kind: MediaKind;
  extension: string;
  filenameExtensions: readonly string[];
  maxBytes: number;
}>;

export type AcceptedMediaContentType = keyof typeof mediaContentTypes;
export const acceptedMediaContentTypes = Object.keys(mediaContentTypes) as AcceptedMediaContentType[];
export const acceptedImageContentTypes = acceptedMediaContentTypes.filter(
  (contentType) => mediaContentTypes[contentType].kind === "image",
);

export const purposeRules: Record<MediaUploadPurpose, {
  minimumRole: "reader" | "author" | "admin";
  kinds: readonly MediaKind[];
  ownerSegment: "actor" | "global";
}> = {
  story_cover: { minimumRole: "reader", kinds: ["image"], ownerSegment: "actor" },
  personal_audio: { minimumRole: "author", kinds: ["audio"], ownerSegment: "actor" },
  personal_background: { minimumRole: "author", kinds: ["image", "video"], ownerSegment: "actor" },
  global_background: { minimumRole: "admin", kinds: ["image", "video"], ownerSegment: "global" },
};
