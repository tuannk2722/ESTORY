import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { databaseJson } from "@/lib/db/json-fields";
import {
  backgroundRenderSnapshotSchema,
  paletteRenderSnapshotSchema,
} from "@/lib/scenes/scene-render-config";
import { CommandError, conflict, mapCommandDatabaseError, notFound } from "@/lib/services/command-error";
import { completedMediaUploadSchema } from "@/lib/validation/media-upload-schema";
import type {
  BackgroundAsset,
  BackgroundSource,
  CatalogStatus,
  ColorPalette,
  ScenePreset,
} from "@/types/scene";
import type {
  ManagedBackgroundAsset,
  ManagedColorPalette,
  SceneCatalogImpact,
} from "@/types/scene-catalog-admin";
import type {
  BackgroundCatalogPersistenceWrite,
  PaletteCatalogPersistenceWrite,
  SceneCatalogAdminTransactionalRepository,
  SceneCatalogAdminTransactionProvider,
} from "./scene-catalog-admin-repository";
import type { SceneCompatibilityLibraryRepository, SceneLibraryRepository } from "./scene-repository";
import {
  loadRuntimePrismaClient,
  resolvePrismaReadClient,
  type PrismaReadClientSource,
} from "./prisma-read-client";
import {
  consoleRepositoryReadObserver,
  failRepositoryRead,
  type RepositoryReadObserver,
} from "./read-observability";

const backgroundAdminSelect = {
  id: true,
  label: true,
  render: true,
  moodTags: true,
  status: true,
  activatedAt: true,
  scope: true,
  source: true,
  generationPrompt: true,
  ownerId: true,
  createdAt: true,
  updatedAt: true,
} as const satisfies Prisma.BackgroundAssetSelect;

const paletteAdminSelect = {
  id: true,
  label: true,
  primary: true,
  secondary: true,
  accent: true,
  backgroundTintColor: true,
  backgroundTintOpacity: true,
  moodTags: true,
  status: true,
  activatedAt: true,
  createdAt: true,
  updatedAt: true,
} as const satisfies Prisma.ColorPaletteSelect;

type BackgroundAdminRow = Prisma.BackgroundAssetGetPayload<{ select: typeof backgroundAdminSelect }>;
type PaletteAdminRow = Prisma.ColorPaletteGetPayload<{ select: typeof paletteAdminSelect }>;

const CATALOG_IMPACT: SceneCatalogImpact = Object.freeze({
  dependency_count: null,
  provenance: "snapshot_only",
  saved_scenes_unchanged: true,
  storage_cleanup: "separate",
});

function optionalIso(value: Date | null): string | undefined {
  return value ? value.toISOString() : undefined;
}
function catalogStatus(value: "DRAFT" | "ACTIVE" | "ARCHIVED"): CatalogStatus {
  return value.toLowerCase() as CatalogStatus;
}

function databaseCatalogStatus(value: "active" | "archived"): "ACTIVE" | "ARCHIVED" {
  return value.toUpperCase() as "ACTIVE" | "ARCHIVED";
}

function backgroundSource(value: string, observer: RepositoryReadObserver): BackgroundSource {
  if (["admin_upload", "author_upload", "ai_generated"].includes(value)) {
    return value as BackgroundSource;
  }
  return failRepositoryRead(observer, "P3_PRISMA_INVALID_BACKGROUND_SOURCE");
}

function parsePalette(row: Pick<PaletteAdminRow,
  "primary" | "secondary" | "accent" | "backgroundTintColor" | "backgroundTintOpacity"
>) {
  const colors = paletteRenderSnapshotSchema.safeParse({
    primary: row.primary,
    secondary: row.secondary,
    accent: row.accent,
    background_tint: {
      color: row.backgroundTintColor,
      opacity: row.backgroundTintOpacity,
    },
  });
  return colors.success ? colors.data : null;
}

function mapAdminBackground(
  row: BackgroundAdminRow,
  observer: RepositoryReadObserver,
): ManagedBackgroundAsset {
  if (row.scope !== "global" || row.ownerId !== null) {
    return failRepositoryRead(observer, "P3_PRISMA_BACKGROUND_SCOPE_LEAK");
  }
  let render;
  try {
    render = databaseJson.backgroundRender.read(row.render);
  } catch {
    return failRepositoryRead(observer, "P3_PRISMA_INVALID_BACKGROUND_RENDER");
  }
  const activatedAt = optionalIso(row.activatedAt);
  return {
    id: row.id,
    label: row.label,
    render,
    mood_tags: [...row.moodTags],
    status: catalogStatus(row.status),
    ...(activatedAt ? { activated_at: activatedAt } : {}),
    scope: "global",
    source: backgroundSource(row.source, observer),
    ...(row.generationPrompt === null ? {} : { generation_prompt: row.generationPrompt }),
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
    can_hard_delete: row.activatedAt === null,
    impact: { ...CATALOG_IMPACT },
  };
}

function mapAdminPalette(
  row: PaletteAdminRow,
  observer: RepositoryReadObserver,
): ManagedColorPalette {
  const colors = parsePalette(row);
  if (!colors) return failRepositoryRead(observer, "P3_PRISMA_INVALID_PALETTE");
  const activatedAt = optionalIso(row.activatedAt);
  return {
    id: row.id,
    label: row.label,
    colors,
    mood_tags: [...row.moodTags],
    status: catalogStatus(row.status),
    ...(activatedAt ? { activated_at: activatedAt } : {}),
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
    // Palette is compatibility-only through P3-17. The read DTO must not
    // advertise an operation that every write boundary rejects with 410.
    can_hard_delete: false,
    impact: { ...CATALOG_IMPACT },
  };
}

function nextRevision(expectedUpdatedAt: string): Date {
  return new Date(Math.max(Date.now(), Date.parse(expectedUpdatedAt) + 1));
}

export class PrismaSceneCatalogRepository implements
  SceneLibraryRepository,
  SceneCompatibilityLibraryRepository,
  SceneCatalogAdminTransactionalRepository {
  constructor(
    private readonly clientSource: PrismaReadClientSource = loadRuntimePrismaClient,
    private readonly observer: RepositoryReadObserver = consoleRepositoryReadObserver,
  ) {}

  async getActiveGlobalBackgrounds(): Promise<BackgroundAsset[]> {
    const db = await resolvePrismaReadClient(this.clientSource);
    const rows = await db.backgroundAsset.findMany({
      where: { scope: "global", ownerId: null, status: "ACTIVE" },
      orderBy: { id: "asc" },
      select: backgroundAdminSelect,
    });
    return rows.map((row) => {
      const managed = mapAdminBackground(row, this.observer);
      return {
        id: managed.id,
        label: managed.label,
        render: managed.render,
        mood_tags: managed.mood_tags,
        status: "active",
        ...(managed.activated_at ? { activated_at: managed.activated_at } : {}),
        scope: "global",
        source: managed.source,
        ...(managed.generation_prompt ? { generation_prompt: managed.generation_prompt } : {}),
      };
    });
  }

  async getActivePalettes(): Promise<ColorPalette[]> {
    const db = await resolvePrismaReadClient(this.clientSource);
    const rows = await db.colorPalette.findMany({
      where: { status: "ACTIVE" },
      orderBy: { id: "asc" },
      select: paletteAdminSelect,
    });
    return rows.map((row) => {
      const managed = mapAdminPalette(row, this.observer);
      return {
        id: managed.id,
        label: managed.label,
        colors: managed.colors,
        mood_tags: managed.mood_tags,
        status: "active",
        ...(managed.activated_at ? { activated_at: managed.activated_at } : {}),
      };
    });
  }

  async getActiveScenePresets(): Promise<ScenePreset[]> {
    const db = await resolvePrismaReadClient(this.clientSource);
    const rows = await db.scenePreset.findMany({
      where: { status: "ACTIVE" },
      orderBy: { id: "asc" },
    });
    return rows.map((row) => {
      let renderConfig;
      try {
        renderConfig = databaseJson.presetRenderConfig.read(row.renderConfig);
      } catch {
        return failRepositoryRead(this.observer, "P3_PRISMA_INVALID_PRESET_SNAPSHOT");
      }
      const activatedAt = optionalIso(row.activatedAt);
      return {
        id: row.id,
        label: row.label,
        ...(row.description === null ? {} : { description: row.description }),
        ...(row.thumbnailUrl === null ? {} : { thumbnail_url: row.thumbnailUrl }),
        mood_tags: [...row.moodTags],
        status: "active",
        ...(activatedAt ? { activated_at: activatedAt } : {}),
        render_config: renderConfig,
      };
    });
  }

  async getActorRole(actorId: string): Promise<"reader" | "author" | "admin" | null> {
    const db = await resolvePrismaReadClient(this.clientSource);
    const actor = await db.user.findUnique({ where: { id: actorId }, select: { role: true } });
    return actor ? actor.role.toLowerCase() as "reader" | "author" | "admin" : null;
  }

  async getAdminBackgrounds(): Promise<ManagedBackgroundAsset[]> {
    const db = await resolvePrismaReadClient(this.clientSource);
    const rows = await db.backgroundAsset.findMany({
      where: { scope: "global", ownerId: null },
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      select: backgroundAdminSelect,
    });
    return rows.map((row) => mapAdminBackground(row, this.observer));
  }

  async getAdminPalettes(): Promise<ManagedColorPalette[]> {
    const db = await resolvePrismaReadClient(this.clientSource);
    const rows = await db.colorPalette.findMany({
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      select: paletteAdminSelect,
    });
    return rows.map((row) => mapAdminPalette(row, this.observer));
  }

  async getAdminBackground(itemId: string): Promise<ManagedBackgroundAsset | null> {
    const db = await resolvePrismaReadClient(this.clientSource);
    const row = await db.backgroundAsset.findFirst({
      where: { id: itemId, scope: "global", ownerId: null },
      select: backgroundAdminSelect,
    });
    return row ? mapAdminBackground(row, this.observer) : null;
  }

  async getAdminPalette(itemId: string): Promise<ManagedColorPalette | null> {
    const db = await resolvePrismaReadClient(this.clientSource);
    const row = await db.colorPalette.findUnique({ where: { id: itemId }, select: paletteAdminSelect });
    return row ? mapAdminPalette(row, this.observer) : null;
  }

  async claimGlobalBackgroundUpload(
    actorId: string,
    uploadId: string,
    expectedKind: "image" | "video",
    claimedAt: Date,
  ) {
    const db = await resolvePrismaReadClient(this.clientSource);
    const upload = await db.mediaUpload.findFirst({
      where: {
        id: uploadId,
        ownerId: actorId,
        purpose: "global_background",
        mediaKind: expectedKind,
      },
      select: { id: true, status: true, result: true },
    });
    if (!upload) notFound();
    if (upload.status !== "COMPLETED") {
      conflict("UPLOAD_NOT_CLAIMABLE", "The background upload is not ready to be claimed.");
    }
    const parsed = completedMediaUploadSchema.safeParse(upload.result);
    const media = parsed.success ? parsed.data : null;
    if (
      !media
      || media.kind !== expectedKind
      || !media.primary.contentType.startsWith(`${expectedKind}/`)
      || (expectedKind === "video" && (!media.poster || !media.poster.contentType.startsWith("image/")))
    ) {
      conflict("UPLOAD_INVALID", "The completed background upload is invalid.");
    }
    const claimed = await db.mediaUpload.updateMany({
      where: {
        id: upload.id,
        ownerId: actorId,
        purpose: "global_background",
        mediaKind: expectedKind,
        status: "COMPLETED",
      },
      data: { status: "CLAIMED", claimedAt },
    });
    if (claimed.count !== 1) {
      conflict("UPLOAD_NOT_CLAIMABLE", "The background upload is not ready to be claimed.");
    }
    return media;
  }

  async createBackground(input: BackgroundCatalogPersistenceWrite): Promise<ManagedBackgroundAsset> {
    const db = await resolvePrismaReadClient(this.clientSource);
    const render = backgroundRenderSnapshotSchema.parse(input.render);
    const row = await db.backgroundAsset.create({
      data: {
        label: input.label,
        moodTags: input.moodTags,
        render: databaseJson.backgroundRender.write(render),
        status: "DRAFT",
        scope: "global",
        source: "admin_upload",
        ownerId: null,
      },
      select: backgroundAdminSelect,
    });
    return mapAdminBackground(row, this.observer);
  }

  async createPalette(input: PaletteCatalogPersistenceWrite): Promise<ManagedColorPalette> {
    const db = await resolvePrismaReadClient(this.clientSource);
    const colors = paletteRenderSnapshotSchema.parse(input.colors);
    const row = await db.colorPalette.create({
      data: {
        label: input.label,
        moodTags: input.moodTags,
        primary: colors.primary,
        secondary: colors.secondary,
        accent: colors.accent,
        backgroundTintColor: colors.background_tint.color,
        backgroundTintOpacity: colors.background_tint.opacity,
        status: "DRAFT",
      },
      select: paletteAdminSelect,
    });
    return mapAdminPalette(row, this.observer);
  }

  async updateBackground(
    itemId: string,
    expectedUpdatedAt: string,
    input: BackgroundCatalogPersistenceWrite,
  ): Promise<ManagedBackgroundAsset> {
    const db = await resolvePrismaReadClient(this.clientSource);
    const render = backgroundRenderSnapshotSchema.parse(input.render);
    const updatedAt = nextRevision(expectedUpdatedAt);
    const result = await db.backgroundAsset.updateMany({
      where: {
        id: itemId,
        scope: "global",
        ownerId: null,
        updatedAt: new Date(expectedUpdatedAt),
      },
      data: {
        label: input.label,
        moodTags: input.moodTags,
        render: databaseJson.backgroundRender.write(render),
        updatedAt,
      },
    });
    if (result.count !== 1) conflict();
    return await this.getAdminBackground(itemId) ?? notFound();
  }

  async updatePalette(
    itemId: string,
    expectedUpdatedAt: string,
    input: PaletteCatalogPersistenceWrite,
  ): Promise<ManagedColorPalette> {
    const db = await resolvePrismaReadClient(this.clientSource);
    const colors = paletteRenderSnapshotSchema.parse(input.colors);
    const updatedAt = nextRevision(expectedUpdatedAt);
    const result = await db.colorPalette.updateMany({
      where: { id: itemId, updatedAt: new Date(expectedUpdatedAt) },
      data: {
        label: input.label,
        moodTags: input.moodTags,
        primary: colors.primary,
        secondary: colors.secondary,
        accent: colors.accent,
        backgroundTintColor: colors.background_tint.color,
        backgroundTintOpacity: colors.background_tint.opacity,
        updatedAt,
      },
    });
    if (result.count !== 1) conflict();
    return await this.getAdminPalette(itemId) ?? notFound();
  }

  async transitionBackground(
    itemId: string,
    expectedUpdatedAt: string,
    status: "active" | "archived",
    activatedAt: Date | null,
  ): Promise<ManagedBackgroundAsset> {
    const db = await resolvePrismaReadClient(this.clientSource);
    const updatedAt = nextRevision(expectedUpdatedAt);
    const result = await db.backgroundAsset.updateMany({
      where: {
        id: itemId,
        scope: "global",
        ownerId: null,
        updatedAt: new Date(expectedUpdatedAt),
      },
      data: { status: databaseCatalogStatus(status), activatedAt, updatedAt },
    });
    if (result.count !== 1) conflict();
    return await this.getAdminBackground(itemId) ?? notFound();
  }

  async transitionPalette(
    itemId: string,
    expectedUpdatedAt: string,
    status: "active" | "archived",
    activatedAt: Date | null,
  ): Promise<ManagedColorPalette> {
    const db = await resolvePrismaReadClient(this.clientSource);
    const updatedAt = nextRevision(expectedUpdatedAt);
    const result = await db.colorPalette.updateMany({
      where: { id: itemId, updatedAt: new Date(expectedUpdatedAt) },
      data: { status: databaseCatalogStatus(status), activatedAt, updatedAt },
    });
    if (result.count !== 1) conflict();
    return await this.getAdminPalette(itemId) ?? notFound();
  }

  async deleteBackground(itemId: string, expectedUpdatedAt: string): Promise<void> {
    const db = await resolvePrismaReadClient(this.clientSource);
    const result = await db.backgroundAsset.deleteMany({
      where: {
        id: itemId,
        scope: "global",
        ownerId: null,
        activatedAt: null,
        updatedAt: new Date(expectedUpdatedAt),
      },
    });
    if (result.count !== 1) conflict();
  }

  async deletePalette(itemId: string, expectedUpdatedAt: string): Promise<void> {
    const db = await resolvePrismaReadClient(this.clientSource);
    const result = await db.colorPalette.deleteMany({
      where: { id: itemId, activatedAt: null, updatedAt: new Date(expectedUpdatedAt) },
    });
    if (result.count !== 1) conflict();
  }
}

export type SceneCatalogAdminRepositoryFactory = (
  tx: Prisma.TransactionClient,
) => SceneCatalogAdminTransactionalRepository;

export class PrismaSceneCatalogAdminTransactions implements SceneCatalogAdminTransactionProvider {
  constructor(
    private readonly clientSource: () => Promise<PrismaClient> = loadRuntimePrismaClient,
    private readonly repositoryFactory: SceneCatalogAdminRepositoryFactory =
      (tx) => new PrismaSceneCatalogRepository(tx),
  ) {}

  async transaction<T>(
    work: (repository: SceneCatalogAdminTransactionalRepository) => Promise<T>,
  ): Promise<T> {
    const db = await this.clientSource();
    try {
      return await db.$transaction((tx) => work(this.repositoryFactory(tx)), {
        isolationLevel: "Serializable",
        maxWait: 10_000,
        timeout: 30_000,
      });
    } catch (error) {
      if (error instanceof CommandError) throw error;
      return mapCommandDatabaseError(error);
    }
  }
}
