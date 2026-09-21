import { z } from "zod";
export const audioAttributionSchema = z.strictObject({
  author_name: z.string().min(1), source_url: z.url().refine((value) => value.startsWith("https://freesound.org/")), license_name: z.string().min(1),
});
export const audioAssetSchema = z.strictObject({
  id: z.string(), owner_id: z.string(), source: z.enum(["freesound", "upload"]), title: z.string(),
  url: z.string().min(1), duration_ms: z.number().int().positive(), created_at: z.iso.datetime(),
  freesound_id: z.string().optional(), license: z.string().optional(), attribution: audioAttributionSchema.optional(),
});
export const claimAudioSchema = z.strictObject({ uploadId: z.string().min(1).max(128), title: z.string().trim().min(1).max(200) });
export const importAudioSchema = z.strictObject({ freesound_sound_id: z.string().regex(/^[1-9][0-9]{0,9}$/) });
export const freesoundSearchSchema = z.strictObject({ q: z.string().trim().min(1).max(120), page: z.coerce.number().int().min(1).max(100).default(1) });
export const integrationStatusSchema = z.strictObject({
  freesound_connection: z.strictObject({ connected: z.boolean(), freesound_username: z.string().optional() }),
  freesound_import_quota: z.strictObject({ limit: z.number().int().nonnegative(), used: z.number().int().nonnegative(), reset_at: z.iso.datetime() }),
});
