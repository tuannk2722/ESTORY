import { z } from "zod";

const id = z.string().min(1).max(200).regex(/^[^\s/\\\u0000-\u001f]+$/);
export const categoriesSchema = z.strictObject({
  visual: z.boolean(), audio: z.boolean(), motion: z.boolean(), transition: z.boolean(),
});
export const readerSettingsSchema = z.strictObject({
  effects_enabled: z.boolean(), effects_by_category: categoriesSchema,
  intensity_multiplier: z.number().min(0).max(1), reduced_motion: z.boolean(),
  font_size: z.enum(["sm", "md", "lg", "xl"]),
  font_family: z.enum(["cormorant", "lora", "merriweather", "literata", "eb-garamond"]),
  theme: z.enum(["light", "dark", "sepia"]),
});
export const progressSchema = z.strictObject({
  story_id: id, chapter_id: id, block_id: id,
  status: z.enum(["reading", "completed"]), updated_at: z.iso.datetime(),
});
export const bookmarkSchema = z.strictObject({ user_id: id, story_id: id, created_at: z.iso.datetime() });
export const guestImportSchema = z.strictObject({
  settings: readerSettingsSchema, progress: z.array(progressSchema).max(1000),
  bookmarks: z.array(bookmarkSchema.omit({ user_id: true })).max(1000),
});
export const bootstrapSchema = z.strictObject({ expectedUserId: id, guest: guestImportSchema });
export const settingsPatchSchema = readerSettingsSchema.partial().extend({ effects_by_category: categoriesSchema.partial().optional() });
export const operationSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("settings"), patch: settingsPatchSchema }),
  z.strictObject({ kind: z.literal("progress"), progress: progressSchema.omit({ updated_at: true }) }),
  z.strictObject({ kind: z.literal("bookmark"), storyId: id, saved: z.boolean() }),
]);
export const mutationSchema = z.strictObject({
  expectedUserId: id, expectedUpdatedAt: z.iso.datetime(), operation: operationSchema,
});
export const readerStateSchema = z.strictObject({
  userId: id, settings: readerSettingsSchema,
  progress: z.array(progressSchema), bookmarks: z.array(bookmarkSchema), updatedAt: z.iso.datetime(),
});
export const readerStateResponseSchema = z.strictObject({ data: readerStateSchema.nullable() });
export type ReaderState = z.infer<typeof readerStateSchema>;
export type GuestImport = z.infer<typeof guestImportSchema>;
export type ReaderOperation = z.infer<typeof operationSchema>;
export type ReaderMutation = z.infer<typeof mutationSchema>;
