import { isAdminManagedEffect } from "@/lib/effects/effect-management";
import { z } from "zod";
import { EFFECT_CONFIG_CONSTRAINTS, EFFECT_MANIFEST } from "@/lib/effects/effect-manifest";
import { normalizeEffectKeyword } from "@/lib/effects/effect-keyword-normalization";
import type { EffectType } from "@/types/story";

export const EFFECT_ADMIN_PAGE_SIZE = 20;
export const EFFECT_ADMIN_QUERY_MAX_CODE_POINTS = 100;
export const EFFECT_LABEL_MAX_CODE_POINTS = 120;
export const EFFECT_DESCRIPTION_MAX_CODE_POINTS = 2_000;
export const EFFECT_KEYWORD_MAX_CODE_POINTS = 100;

const codePointLengthAtMost = (maximum: number) =>
  (value: string) => Array.from(value).length <= maximum;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function canonicalizeSearchQuery(value: string | string[] | undefined): string {
  return (first(value) ?? "").normalize("NFKC").trim().replace(/\s+/gu, " ");
}

function canonicalizeKeyword(value: string): string {
  return value.normalize("NFKC").trim().replace(/\s+/gu, " ");
}

export const effectIdSchema = z.custom<EffectType>(
  (value) => typeof value === "string" && Object.hasOwn(EFFECT_MANIFEST, value),
  "Unknown technical effect ID",
);
export const adminManagedEffectIdSchema = effectIdSchema.refine(isAdminManagedEffect, "Effect is managed in code");
export const effectCategorySchema = z.enum(["visual", "audio", "motion", "transition"]);
export const effectAdminCategoryFilterSchema = z.enum(["visual", "motion", "transition", "all"]);
export const effectAdminStatusFilterSchema = z.enum(["active", "inactive", "all"]);
const cursorSchema = z.string().trim().min(1).max(2_000).regex(/^[A-Za-z0-9_-]+$/);
const keywordIdSchema = z.string().trim().min(1).max(200).regex(/^[^\s/\\\u0000-\u001f]+$/);

const labelSchema = z.string().trim().min(1).refine(
  codePointLengthAtMost(EFFECT_LABEL_MAX_CODE_POINTS),
  `Label must contain at most ${EFFECT_LABEL_MAX_CODE_POINTS} characters.`,
);
const descriptionSchema = z.string().trim().refine(
  codePointLengthAtMost(EFFECT_DESCRIPTION_MAX_CODE_POINTS),
  `Description must contain at most ${EFFECT_DESCRIPTION_MAX_CODE_POINTS} characters.`,
).transform((value) => value || null);
const keywordSchema = z.string().transform(canonicalizeKeyword).pipe(
  z.string().min(1).refine(
    codePointLengthAtMost(EFFECT_KEYWORD_MAX_CODE_POINTS),
    `Keyword must contain at most ${EFFECT_KEYWORD_MAX_CODE_POINTS} characters.`,
  ),
);

export function parseEffectAdminSearchParams(params: {
  q?: string | string[];
  category?: string | string[];
  status?: string | string[];
  cursor?: string | string[];
}) {
  const category = effectAdminCategoryFilterSchema.safeParse(first(params.category));
  const status = effectAdminStatusFilterSchema.safeParse(first(params.status));
  const cursor = cursorSchema.safeParse(first(params.cursor));
  const canonicalQuery = canonicalizeSearchQuery(params.q);
  return {
    q: Array.from(canonicalQuery).slice(0, EFFECT_ADMIN_QUERY_MAX_CODE_POINTS).join(""),
    category: category.success ? category.data : "all" as const,
    status: status.success ? status.data : "all" as const,
    cursor: cursor.success ? cursor.data : null,
  };
}

export const effectAdminListQuerySchema = z.strictObject({
  q: z.string().refine(codePointLengthAtMost(EFFECT_ADMIN_QUERY_MAX_CODE_POINTS)),
  category: effectAdminCategoryFilterSchema,
  status: effectAdminStatusFilterSchema,
  cursor: cursorSchema.nullable(),
});

const effectDefaultsSchema = z.strictObject({
  intensity: z.number().finite().min(EFFECT_CONFIG_CONSTRAINTS.intensity.min).max(EFFECT_CONFIG_CONSTRAINTS.intensity.max),
  duration_ms: z.number().int().min(EFFECT_CONFIG_CONSTRAINTS.duration_ms.min),
  delay_ms: z.number().int().min(EFFECT_CONFIG_CONSTRAINTS.delay_ms.min),
  loop: z.boolean(),
});
const effectConstraintsSchema = z.strictObject({
  intensity: z.strictObject({ min: z.literal(0), max: z.literal(1) }),
  duration_ms: z.strictObject({ min: z.literal(0) }),
  delay_ms: z.strictObject({ min: z.literal(0) }),
});

export const effectDefinitionSchema = z.strictObject({
  effect_id: effectIdSchema,
  label: z.string(),
  description: z.string().optional(),
  is_active: z.boolean(),
  created_at: z.iso.datetime(),
  updated_at: z.iso.datetime(),
});
export const effectKeywordSuggestionSchema = z.strictObject({
  id: keywordIdSchema,
  keyword: z.string(),
  normalized_keyword: z.string().refine((value) => value === normalizeEffectKeyword(value)),
  effect_id: effectIdSchema,
  weight: z.number().int().min(1).max(100),
});
export const managedEffectDefinitionSchema = z.strictObject({
  id: effectIdSchema,
  category: effectCategorySchema,
  icon_key: z.string().min(1),
  allowed_scopes: z.array(z.enum(["block", "scene"])).min(1),
  defaults: effectDefaultsSchema,
  constraints: effectConstraintsSchema,
  label: z.string(),
  description: z.string().optional(),
  is_active: z.boolean(),
  created_at: z.iso.datetime(),
  updated_at: z.iso.datetime(),
});
export const managedEffectAdminItemSchema = managedEffectDefinitionSchema.extend({
  keywords: z.array(effectKeywordSuggestionSchema),
});
export const effectAuthorCatalogSchema = z.strictObject({
  effects: z.array(managedEffectDefinitionSchema.omit({ created_at: true, updated_at: true })),
  keywords: z.array(effectKeywordSuggestionSchema),
});
export const effectAdminCapabilitiesSchema = z.strictObject({
  canCreateEffect: z.literal(false),
  canEditTechnicalFields: z.literal(false),
  canEditMetadata: z.literal(true),
  canManageKeywords: z.literal(true),
});
export const effectAdminListSchema = z.strictObject({
  items: z.array(managedEffectAdminItemSchema),
  total: z.number().int().nonnegative(),
  nextCursor: cursorSchema.nullable(),
  capabilities: effectAdminCapabilitiesSchema,
});

export const updateEffectOverlaySchema = z.strictObject({
  effectId: adminManagedEffectIdSchema,
  label: labelSchema,
  description: descriptionSchema,
  isActive: z.boolean(),
  expectedUpdatedAt: z.iso.datetime(),
});
export const createEffectKeywordSchema = z.strictObject({
  keyword: keywordSchema,
  weight: z.number().int().min(1).max(100),
  expectedUpdatedAt: z.iso.datetime(),
});
export const updateEffectKeywordSchema = createEffectKeywordSchema.extend({
  keywordId: keywordIdSchema,
});
export const deleteEffectKeywordSchema = z.strictObject({
  keywordId: keywordIdSchema,
  expectedUpdatedAt: z.iso.datetime(),
});

export const updateEffectOverlayCommandSchema = updateEffectOverlaySchema.extend({
  actorId: keywordIdSchema,
  // Route validation has already normalized an empty description to null.
  description: descriptionSchema.nullable(),
});
export const createEffectKeywordCommandSchema = createEffectKeywordSchema.extend({
  actorId: keywordIdSchema,
  effectId: adminManagedEffectIdSchema,
});
export const updateEffectKeywordCommandSchema = updateEffectKeywordSchema.extend({
  actorId: keywordIdSchema,
  effectId: adminManagedEffectIdSchema,
});
export const deleteEffectKeywordCommandSchema = deleteEffectKeywordSchema.extend({
  actorId: keywordIdSchema,
  effectId: adminManagedEffectIdSchema,
});
