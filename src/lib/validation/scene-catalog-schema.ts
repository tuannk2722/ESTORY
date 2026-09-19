import { z } from "zod";
import { PARTICLE_COMPOSITION_REGISTRY, isParticleCompositionKey } from "@/lib/scenes/particle-composition-registry";
import {
  backgroundRenderSnapshotSchema,
  paletteRenderSnapshotSchema,
  sceneRenderConfigV1Schema,
} from "@/lib/scenes/scene-render-config";
import { renderColorSchema } from "@/lib/scenes/render-values";

export const SCENE_CATALOG_QUERY_MAX_CODE_POINTS = 100;
export const SCENE_CATALOG_ADMIN_PAGE_SIZE = 12;
export const SCENE_CATALOG_LABEL_MAX_CODE_POINTS = 120;
export const SCENE_CATALOG_MOOD_TAG_MAX_CODE_POINTS = 50;
export const SCENE_CATALOG_MOOD_TAG_LIMIT = 20;
export const SCENE_CATALOG_GRADIENT_STOP_LIMIT = 8;

const codePointLengthAtMost = (maximum: number) =>
  (value: string) => Array.from(value).length <= maximum;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function canonicalText(value: string): string {
  return value.normalize("NFKC").trim().replace(/\s+/gu, " ");
}

function canonicalQuery(value: string | string[] | undefined): string {
  return Array.from(canonicalText(first(value) ?? ""))
    .slice(0, SCENE_CATALOG_QUERY_MAX_CODE_POINTS)
    .join("");
}

export const sceneCatalogIdSchema = z.string().trim().min(1).max(200)
  .regex(/^[^\s/\\\u0000-\u001f]+$/);
export const catalogStatusSchema = z.enum(["draft", "active", "archived"]);
export const sceneCatalogStatusFilterSchema = z.enum(["draft", "active", "archived", "all"]);
export const backgroundTypeSchema = z.enum([
  "image",
  "video",
  "gradient",
  "radial_gradient",
  "particle_composition",
]);
export const backgroundTypeFilterSchema = z.enum([
  "image",
  "video",
  "gradient",
  "radial_gradient",
  "particle_composition",
  "all",
]);
export const backgroundMotionFilterSchema = z.enum(["static", "looping", "all"]);
const cursorSchema = z.string().trim().min(1).max(2_000).regex(/^[A-Za-z0-9_-]+$/);

const labelSchema = z.string().transform(canonicalText).pipe(
  z.string().min(1).refine(
    codePointLengthAtMost(SCENE_CATALOG_LABEL_MAX_CODE_POINTS),
    `Label must contain at most ${SCENE_CATALOG_LABEL_MAX_CODE_POINTS} characters.`,
  ),
);
const moodTagSchema = z.string().transform(canonicalText).pipe(
  z.string().min(1).refine(
    codePointLengthAtMost(SCENE_CATALOG_MOOD_TAG_MAX_CODE_POINTS),
    `Mood tag must contain at most ${SCENE_CATALOG_MOOD_TAG_MAX_CODE_POINTS} characters.`,
  ),
);
const moodTagsSchema = z.array(moodTagSchema).max(SCENE_CATALOG_MOOD_TAG_LIMIT)
  .superRefine((tags, context) => {
    const seen = new Set<string>();
    tags.forEach((tag, index) => {
      const normalized = tag.toLocaleLowerCase("vi");
      if (seen.has(normalized)) {
        context.addIssue({ code: "custom", path: [index], message: "Mood tags must be unique" });
      }
      seen.add(normalized);
    });
  });
const uploadIdSchema = sceneCatalogIdSchema;

const gradientStopSchema = z.strictObject({
  color: renderColorSchema,
  position: z.number().finite().min(0).max(1),
});
const gradientStopsSchema = z.array(gradientStopSchema)
  .min(2)
  .max(SCENE_CATALOG_GRADIENT_STOP_LIMIT)
  .superRefine((stops, context) => {
    stops.forEach((stop, index) => {
      if (index > 0 && stop.position < stops[index - 1].position) {
        context.addIssue({ code: "custom", path: [index, "position"], message: "Gradient stops must be ordered" });
      }
    });
  });

const particleFields = {
  kind: z.literal("particle_composition"),
  compositionKey: z.string().trim().min(1).max(100),
  config: z.record(z.string(), z.unknown()),
  motion: z.enum(["static", "looping"]),
  posterUploadId: uploadIdSchema.optional(),
} as const;

function validateParticle(
  input: { compositionKey: string; config: Record<string, unknown> },
  context: z.RefinementCtx,
): void {
  if (!isParticleCompositionKey(input.compositionKey)) {
    context.addIssue({ code: "custom", path: ["compositionKey"], message: "Unknown particle composition" });
    return;
  }
  if (!PARTICLE_COMPOSITION_REGISTRY[input.compositionKey].schema.safeParse(input.config).success) {
    context.addIssue({ code: "custom", path: ["config"], message: "Invalid particle configuration" });
  }
}

const backgroundImageCreateSchema = z.strictObject({ kind: z.literal("image"), uploadId: uploadIdSchema });
const backgroundVideoCreateSchema = z.strictObject({ kind: z.literal("video"), uploadId: uploadIdSchema });
const backgroundImageUpdateSchema = z.strictObject({ kind: z.literal("image"), uploadId: uploadIdSchema.optional() });
const backgroundVideoUpdateSchema = z.strictObject({ kind: z.literal("video"), uploadId: uploadIdSchema.optional() });
const backgroundGradientSchema = z.strictObject({
  kind: z.literal("gradient"),
  angleDeg: z.number().finite().min(0).max(360),
  stops: gradientStopsSchema,
});
const backgroundRadialGradientSchema = z.strictObject({
  kind: z.literal("radial_gradient"),
  shape: z.enum(["circle", "ellipse"]),
  center: z.strictObject({
    x: z.number().finite().min(0).max(1),
    y: z.number().finite().min(0).max(1),
  }),
  stops: gradientStopsSchema,
});
const backgroundParticleCreateSchema = z.strictObject(particleFields).superRefine((input, context) => {
  validateParticle(input, context);
  if (input.motion === "looping" && !input.posterUploadId) {
    context.addIssue({ code: "custom", path: ["posterUploadId"], message: "Looping particles require a poster upload" });
  }
});
const backgroundParticleUpdateSchema = z.strictObject(particleFields).superRefine(validateParticle);

export const backgroundCreateRenderInputSchema = z.union([
  backgroundImageCreateSchema,
  backgroundVideoCreateSchema,
  backgroundGradientSchema,
  backgroundRadialGradientSchema,
  backgroundParticleCreateSchema,
]);
export const backgroundUpdateRenderInputSchema = z.union([
  backgroundImageUpdateSchema,
  backgroundVideoUpdateSchema,
  backgroundGradientSchema,
  backgroundRadialGradientSchema,
  backgroundParticleUpdateSchema,
]);

export function parseBackgroundAdminSearchParams(params: {
  q?: string | string[];
  type?: string | string[];
  motion?: string | string[];
  status?: string | string[];
  cursor?: string | string[];
}) {
  const type = backgroundTypeFilterSchema.safeParse(first(params.type));
  const motion = backgroundMotionFilterSchema.safeParse(first(params.motion));
  const status = sceneCatalogStatusFilterSchema.safeParse(first(params.status));
  const cursor = cursorSchema.safeParse(first(params.cursor));
  return {
    q: canonicalQuery(params.q),
    type: type.success ? type.data : "all" as const,
    motion: motion.success ? motion.data : "all" as const,
    status: status.success ? status.data : "all" as const,
    cursor: cursor.success ? cursor.data : null,
  };
}

export function parsePaletteAdminSearchParams(params: {
  q?: string | string[];
  status?: string | string[];
  cursor?: string | string[];
}) {
  const status = sceneCatalogStatusFilterSchema.safeParse(first(params.status));
  const cursor = cursorSchema.safeParse(first(params.cursor));
  return {
    q: canonicalQuery(params.q),
    status: status.success ? status.data : "all" as const,
    cursor: cursor.success ? cursor.data : null,
  };
}

export const backgroundAdminListQuerySchema = z.strictObject({
  q: z.string().refine(codePointLengthAtMost(SCENE_CATALOG_QUERY_MAX_CODE_POINTS)),
  type: backgroundTypeFilterSchema,
  motion: backgroundMotionFilterSchema,
  status: sceneCatalogStatusFilterSchema,
  cursor: cursorSchema.nullable(),
});
export const paletteAdminListQuerySchema = z.strictObject({
  q: z.string().refine(codePointLengthAtMost(SCENE_CATALOG_QUERY_MAX_CODE_POINTS)),
  status: sceneCatalogStatusFilterSchema,
  cursor: cursorSchema.nullable(),
});

const backgroundWriteFields = {
  label: labelSchema,
  moodTags: moodTagsSchema,
} as const;
const paletteWriteFields = {
  label: labelSchema,
  moodTags: moodTagsSchema,
  colors: paletteRenderSnapshotSchema,
} as const;

export const createBackgroundSchema = z.strictObject({
  ...backgroundWriteFields,
  render: backgroundCreateRenderInputSchema,
});
export const createPaletteSchema = z.strictObject(paletteWriteFields);

const updateBackgroundActionSchema = z.strictObject({
  action: z.literal("update"),
  ...backgroundWriteFields,
  render: backgroundUpdateRenderInputSchema,
  expectedUpdatedAt: z.iso.datetime(),
});
const updatePaletteActionSchema = z.strictObject({
  action: z.literal("update"),
  ...paletteWriteFields,
  expectedUpdatedAt: z.iso.datetime(),
});
const lifecycleActionSchema = z.strictObject({
  action: z.literal("transition"),
  status: z.enum(["active", "archived"]),
  expectedUpdatedAt: z.iso.datetime(),
});

export const backgroundMutationSchema = z.discriminatedUnion("action", [
  updateBackgroundActionSchema,
  lifecycleActionSchema,
]);
export const paletteMutationSchema = z.discriminatedUnion("action", [
  updatePaletteActionSchema,
  lifecycleActionSchema,
]);
export const deleteCatalogItemSchema = z.strictObject({ expectedUpdatedAt: z.iso.datetime() });

const actorCommandFields = { actorId: sceneCatalogIdSchema } as const;
const itemCommandFields = { ...actorCommandFields, itemId: sceneCatalogIdSchema } as const;
export const createBackgroundCommandSchema = createBackgroundSchema.extend(actorCommandFields);
export const createPaletteCommandSchema = createPaletteSchema.extend(actorCommandFields);
export const updateBackgroundCommandSchema = updateBackgroundActionSchema.extend(itemCommandFields);
export const updatePaletteCommandSchema = updatePaletteActionSchema.extend(itemCommandFields);
export const transitionCatalogItemCommandSchema = lifecycleActionSchema.extend(itemCommandFields).extend({
  kind: z.enum(["background", "palette"]),
});
export const deleteCatalogItemCommandSchema = deleteCatalogItemSchema.extend(itemCommandFields).extend({
  kind: z.enum(["background", "palette"]),
});

export const sceneCatalogImpactSchema = z.strictObject({
  dependency_count: z.null(),
  provenance: z.literal("snapshot_only"),
  saved_scenes_unchanged: z.literal(true),
  storage_cleanup: z.literal("separate"),
});
const managedBaseFields = {
  id: sceneCatalogIdSchema,
  label: z.string(),
  mood_tags: z.array(z.string()),
  status: catalogStatusSchema,
  activated_at: z.iso.datetime().optional(),
  created_at: z.iso.datetime(),
  updated_at: z.iso.datetime(),
  can_hard_delete: z.boolean(),
  impact: sceneCatalogImpactSchema,
} as const;
export const managedBackgroundAssetSchema = z.strictObject({
  ...managedBaseFields,
  render: backgroundRenderSnapshotSchema,
  scope: z.literal("global"),
  source: z.enum(["admin_upload", "author_upload", "ai_generated"]),
  generation_prompt: z.string().optional(),
});
export const managedColorPaletteSchema = z.strictObject({
  ...managedBaseFields,
  colors: paletteRenderSnapshotSchema,
});
export const sceneCatalogAdminCapabilitiesSchema = z.strictObject({
  can_create: z.boolean(),
  can_edit: z.boolean(),
  can_activate: z.boolean(),
  can_archive: z.boolean(),
  hard_delete_never_activated_only: z.boolean(),
});
export const backgroundAdminListSchema = z.strictObject({
  items: z.array(managedBackgroundAssetSchema),
  total: z.number().int().nonnegative(),
  nextCursor: cursorSchema.nullable(),
  capabilities: sceneCatalogAdminCapabilitiesSchema,
});
export const paletteAdminListSchema = z.strictObject({
  items: z.array(managedColorPaletteSchema),
  total: z.number().int().nonnegative(),
  nextCursor: cursorSchema.nullable(),
  capabilities: sceneCatalogAdminCapabilitiesSchema,
});
export const sceneCatalogDeletionResultSchema = z.strictObject({
  id: sceneCatalogIdSchema,
  impact: sceneCatalogImpactSchema,
});

export const backgroundAssetSchema = z.strictObject({
  id: sceneCatalogIdSchema,
  label: z.string(),
  render: backgroundRenderSnapshotSchema,
  mood_tags: z.array(z.string()),
  status: z.literal("active"),
  activated_at: z.iso.datetime().optional(),
  scope: z.literal("global"),
  source: z.enum(["admin_upload", "author_upload", "ai_generated"]),
  generation_prompt: z.string().optional(),
});
export const colorPaletteSchema = z.strictObject({
  id: sceneCatalogIdSchema,
  label: z.string(),
  colors: paletteRenderSnapshotSchema,
  mood_tags: z.array(z.string()),
  status: z.literal("active"),
  activated_at: z.iso.datetime().optional(),
});
export const scenePresetSchema = z.strictObject({
  id: sceneCatalogIdSchema,
  label: z.string(),
  description: z.string().optional(),
  thumbnail_url: z.string().optional(),
  mood_tags: z.array(z.string()),
  status: z.literal("active"),
  activated_at: z.iso.datetime().optional(),
  render_config: sceneRenderConfigV1Schema,
});
export const sceneLibraryDataSchema = z.strictObject({
  backgrounds: z.array(backgroundAssetSchema),
  palettes: z.array(colorPaletteSchema),
  scenePresets: z.array(scenePresetSchema),
});

/** Authoring v2 intentionally exposes only the active Background catalog. */
export const sceneAuthoringLibraryDataSchema = z.strictObject({
  backgrounds: z.array(backgroundAssetSchema),
});
