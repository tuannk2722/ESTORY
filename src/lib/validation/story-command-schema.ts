import { z } from "zod";
import { effectConfigSchema } from "@/lib/effects/effect-config-schema";
import { sceneSchema } from "@/lib/scenes/scene-render-config";
import { mediaUrlSchema } from "@/lib/scenes/render-values";
import { CommandError } from "@/lib/services/command-error";

export const idSchema = z.string().trim().min(1).max(200).regex(/^[^\s/\\\u0000-\u001f]+$/);
const titleSchema = z.string().trim().min(1);
export const coverPositionSchema = z.strictObject({
  x: z.number().finite().min(0).max(100),
  y: z.number().finite().min(0).max(100),
});
export const storyMetadataSchema = z.strictObject({
  title: titleSchema, description: z.string().trim().min(1),
  genre: z.array(z.string().trim().min(1)).min(1),
  cover_position: coverPositionSchema.optional(),
});
export const storyReadyMetadataSchema = storyMetadataSchema.extend({ cover_image: mediaUrlSchema });
const effectSchema = effectConfigSchema.superRefine((effect, ctx) => {
  for (const key of ["duration_ms", "delay_ms"] as const) {
    const value = effect[key];
    if (value !== undefined && (!Number.isInteger(value) || value > 2_147_483_647)) {
      ctx.addIssue({ code: "custom", path: [key], message: "Expected a non-negative 32-bit integer" });
    }
  }
});
export const blockSchema = z.strictObject({
  id: idSchema, type: z.enum(["paragraph", "dialogue", "heading"]), text: z.string(),
  mood_tag: z.string().optional(), effects: z.array(effectSchema),
});
export const chapterSchema = z.strictObject({
  id: idSchema, title: z.string(), order: z.number().int().nonnegative(),
  status: z.enum(["draft", "published"]), view_count: z.number().int().nonnegative().optional(),
  blocks: z.array(blockSchema),
});
export const managedChapterSchema = z.strictObject({
  id: idSchema, title: z.string(), order: z.number().int().nonnegative(),
  status: z.enum(["draft", "published"]),
  blockCount: z.number().int().nonnegative(), effectCount: z.number().int().nonnegative(),
});
export const chapterOrderSchema = managedChapterSchema.pick({ id: true, order: true });
export const storySchema = z.strictObject({
  id: idSchema, title: z.string(), author: z.string().trim().min(1), description: z.string(),
  cover_image: mediaUrlSchema.optional(), cover_position: coverPositionSchema.optional(), genre: z.array(z.string()),
  status: z.enum(["draft", "pending_review", "published", "rejected", "archived"]),
  view_count: z.number().int().nonnegative(), chapters: z.array(chapterSchema),
});
export const managedStorySchema = z.strictObject({
  id: idSchema, title: z.string(), author: z.string().trim().min(1), description: z.string(),
  cover_image: mediaUrlSchema.optional(), cover_position: coverPositionSchema.optional(), genre: z.array(z.string()),
  status: z.enum(["draft", "pending_review", "published", "rejected", "archived"]),
  chapters: z.array(managedChapterSchema),
});
export const managedStoryDataSchema = z.strictObject({
  story: managedStorySchema,
  rejectionReason: z.string().nullable(),
});
export const authorStoryListItemSchema = managedStoryDataSchema.extend({
  updatedAt: z.iso.datetime(),
});
export const authorStoryListSchema = z.array(authorStoryListItemSchema);

export const actorContextSchema = z.strictObject({ actorId: idSchema });
export const storyContextSchema = actorContextSchema.extend({ storyId: idSchema, expectedUpdatedAt: z.iso.datetime() });
export const chapterContextSchema = storyContextSchema.extend({ chapterId: idSchema });
export const createStorySchema = actorContextSchema.extend({
  byline: z.string().optional(), coverUploadId: idSchema, metadata: storyMetadataSchema,
  chapters: z.array(z.strictObject({ title: titleSchema })).min(1),
});
export const updateStorySchema = storyContextSchema.extend({ coverUploadId: idSchema.optional(), metadata: storyMetadataSchema });
export const deleteStorySchema = storyContextSchema;
export const createChapterSchema = storyContextSchema.extend({ title: titleSchema, afterChapterId: idSchema.optional() });
export const updateChapterSchema = chapterContextSchema.extend({ title: titleSchema });
export const reorderChaptersSchema = storyContextSchema.extend({ chapterIds: z.array(idSchema).min(1) });
export const publishChapterSchema = chapterContextSchema.extend({ status: z.enum(["draft", "published"]) });
export const replaceContentSchema = chapterContextSchema.extend({ blocks: z.array(blockSchema).min(1) });
export const replaceScenesSchema = chapterContextSchema.extend({ scenes: z.array(sceneSchema) });
export const replaceEditorSchema = replaceContentSchema.extend({ scenes: z.array(sceneSchema) });
export const editorDataSchema = z.strictObject({ chapter: chapterSchema, scenes: z.array(sceneSchema) });
export const commandMetaSchema = z.strictObject({ updatedAt: z.iso.datetime() });

export function validateCommand<S extends z.ZodType>(schema: S, input: unknown): z.output<S> {
  const result = schema.safeParse(input);
  if (!result.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of result.error.issues) {
      const key = issue.path.map(String).join(".") || "body";
      // Stable error text; Zod enum/unknown-key messages can contain untrusted input.
      fieldErrors[key] = ["Invalid or missing value"];
    }
    throw new CommandError(400, "VALIDATION_ERROR", "Invalid request data", fieldErrors);
  }
  return result.data;
}

export function resolveStoryByline(byline: string | undefined, name: string | null): string {
  const resolved = byline?.trim() || name?.trim();
  if (!resolved) throw new CommandError(400, "VALIDATION_ERROR", "Invalid request data", {
    byline: ["Vui lòng nhập tên tác giả / bút danh hiển thị."],
  });
  return resolved;
}
