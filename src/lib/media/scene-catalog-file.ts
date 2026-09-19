import {
  acceptedImageContentTypes,
  BACKGROUND_VIDEO_MAX_BYTES,
  IMAGE_MAX_BYTES,
  MEBIBYTE,
} from "./constants";

export const SCENE_CATALOG_VIDEO_CONTENT_TYPES = ["video/mp4", "video/webm"] as const;
export type SceneCatalogMediaKind = "image" | "video";

export function validateSceneCatalogMediaFile(
  file: Pick<File, "size" | "type">,
  kind: SceneCatalogMediaKind,
): string | null {
  if (file.size === 0) return "Tệp đang trống. Hãy chọn tệp khác.";
  if (kind === "image") {
    if (!acceptedImageContentTypes.includes(file.type as (typeof acceptedImageContentTypes)[number])) {
      return "Ảnh phải là tệp JPG, PNG hoặc WebP.";
    }
    if (file.size > IMAGE_MAX_BYTES) {
      return `Ảnh không được vượt quá ${IMAGE_MAX_BYTES / MEBIBYTE} MiB.`;
    }
    return null;
  }
  if (!SCENE_CATALOG_VIDEO_CONTENT_TYPES.includes(file.type as (typeof SCENE_CATALOG_VIDEO_CONTENT_TYPES)[number])) {
    return "Video phải là tệp MP4 hoặc WebM.";
  }
  if (file.size > BACKGROUND_VIDEO_MAX_BYTES) {
    return `Video không được vượt quá ${BACKGROUND_VIDEO_MAX_BYTES / MEBIBYTE} MiB.`;
  }
  return null;
}
