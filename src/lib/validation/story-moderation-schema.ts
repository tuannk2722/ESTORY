import { z } from "zod";
import {
  canonicalizeStoryQuery,
  STORY_QUERY_MAX_CODE_POINTS,
  type PublicStorySearchParams,
} from "./story-search-schema";
import { coverPositionSchema, idSchema } from "./story-command-schema";
import { mediaUrlSchema } from "@/lib/scenes/render-values";

export const MODERATION_PAGE_SIZE = 20;
export const MODERATION_MAX_PAGE_SIZE = 50;
export const moderationStatusSchema = z.enum([
  "pending_review",
  "published",
  "rejected",
  "draft",
  "archived",
  "all",
]);
const storyStatusSchema = moderationStatusSchema.exclude(["all"]);
const cursorSchema = z.string().trim().min(1).max(2_000).regex(/^[A-Za-z0-9_-]+$/);

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function parseModerationSearchParams(params: PublicStorySearchParams) {
  const status = moderationStatusSchema.safeParse(first(params.status));
  const cursor = cursorSchema.safeParse(first(params.cursor));
  const rawLimit = Number.parseInt(first(params.limit) ?? "", 10);
  return {
    q: canonicalizeStoryQuery(params.q),
    status: status.success ? status.data : "pending_review" as const,
    cursor: cursor.success ? cursor.data : null,
    limit: Number.isFinite(rawLimit)
      ? Math.min(Math.max(rawLimit, 1), MODERATION_MAX_PAGE_SIZE)
      : MODERATION_PAGE_SIZE,
  };
}

export const moderationListQuerySchema = z.strictObject({
  q: z.string().refine(
    (value) => Array.from(value).length <= STORY_QUERY_MAX_CODE_POINTS,
    `Search query must contain at most ${STORY_QUERY_MAX_CODE_POINTS} characters.`,
  ),
  status: moderationStatusSchema,
  cursor: cursorSchema.nullable(),
  limit: z.number().int().min(1).max(MODERATION_MAX_PAGE_SIZE),
});
export const moderationSummarySchema = z.strictObject({
  pendingReview: z.number().int().nonnegative(),
  published: z.number().int().nonnegative(),
  rejected: z.number().int().nonnegative(),
});
export const moderationListItemSchema = z.strictObject({
  id: idSchema,
  title: z.string(),
  author: z.string().trim().min(1),
  cover_image: mediaUrlSchema.optional(),
  cover_position: coverPositionSchema.optional(),
  genre: z.array(z.string()),
  submittedAt: z.iso.datetime().nullable(),
  chapterCount: z.number().int().nonnegative(),
  blockCount: z.number().int().nonnegative(),
  effectCount: z.number().int().nonnegative(),
  status: storyStatusSchema,
  updatedAt: z.iso.datetime(),
});
export const moderationListSchema = z.strictObject({
  summary: moderationSummarySchema,
  items: z.array(moderationListItemSchema),
  total: z.number().int().nonnegative(),
  nextCursor: cursorSchema.nullable(),
});
export const moderationChapterSchema = z.strictObject({
  id: idSchema,
  title: z.string(),
  order: z.number().int().nonnegative(),
  status: z.enum(["draft", "published"]),
  blockCount: z.number().int().nonnegative(),
  effectCount: z.number().int().nonnegative(),
});
export const moderationDetailSchema = z.strictObject({
  id: idSchema,
  title: z.string(),
  author: z.string().trim().min(1),
  authorEmail: z.string().email(),
  description: z.string(),
  cover_image: mediaUrlSchema.optional(),
  cover_position: coverPositionSchema.optional(),
  genre: z.array(z.string()),
  status: storyStatusSchema,
  createdAt: z.iso.datetime(),
  submittedAt: z.iso.datetime().nullable(),
  reviewedAt: z.iso.datetime().nullable(),
  rejectionReason: z.string().nullable(),
  chapters: z.array(moderationChapterSchema),
});
export const moderationDecisionSchema = z.strictObject({
  storyId: idSchema,
  status: z.enum(["published", "rejected"]),
  reviewedAt: z.iso.datetime(),
});
export const approveStorySchema = z.strictObject({
  expectedUpdatedAt: z.iso.datetime(),
});
export const rejectStorySchema = approveStorySchema.extend({
  reason: z.string().trim().min(5).max(2_000),
});
export const approveModerationCommandSchema = approveStorySchema.extend({
  actorId: idSchema,
  storyId: idSchema,
});
export const rejectModerationCommandSchema = rejectStorySchema.extend({
  actorId: idSchema,
  storyId: idSchema,
});
