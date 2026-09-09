import { z } from "zod";
import { acceptedMediaContentTypes } from "@/lib/media/constants";

const contentTypeSchema = z.enum(acceptedMediaContentTypes);
const fileSchema = z.strictObject({
  name: z.string().trim().min(1).max(255).refine((name) => !/[\\/\u0000-\u001f]/.test(name)),
  contentType: contentTypeSchema,
  size: z.number().int().positive().max(2_147_483_647),
});

export const mediaUploadPurposeSchema = z.enum([
  "story_cover", "personal_audio", "personal_background", "global_background",
]);

export const mediaKindSchema = z.enum(["image", "audio", "video"]);

export const presignUploadRequestSchema = z.strictObject({
  purpose: mediaUploadPurposeSchema,
  file: fileSchema,
  poster: fileSchema.optional(),
});

export const completeUploadRequestSchema = z.strictObject({
  uploadId: z.string().trim().min(1).max(200).regex(/^[^\s/\\\u0000-\u001f]+$/),
});

export const presignedPartSchema = z.strictObject({
  role: z.enum(["primary", "poster"]),
  url: z.string().url(),
  headers: z.record(z.string(), z.string()),
});

export const presignUploadResponseSchema = z.strictObject({
  uploadId: z.string(),
  purpose: mediaUploadPurposeSchema,
  kind: mediaKindSchema,
  status: z.literal("pending"),
  expiresAt: z.iso.datetime(),
  parts: z.array(presignedPartSchema).min(1).max(2),
  videoQuota: z.strictObject({ used: z.number().int().min(1).max(10), limit: z.literal(10) }).optional(),
});

export const storedMediaPartSchema = z.strictObject({
  url: z.string().url(),
  contentType: contentTypeSchema,
  size: z.number().int().positive(),
  etag: z.string().optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  durationMs: z.number().int().positive().optional(),
});

export const completedMediaUploadSchema = z.strictObject({
  kind: mediaKindSchema,
  primary: storedMediaPartSchema,
  poster: storedMediaPartSchema.optional(),
});

export const completeUploadResponseSchema = z.strictObject({
  uploadId: z.string(),
  status: z.literal("completed"),
  media: completedMediaUploadSchema,
});

export const cancelUploadResponseSchema = z.strictObject({
  uploadId: z.string(),
  status: z.literal("cancelled"),
});
