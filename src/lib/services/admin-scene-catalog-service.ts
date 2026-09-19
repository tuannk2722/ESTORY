import "server-only";
import { AuthAccessError } from "@/lib/auth/policy";
import type {
  SceneCatalogAdminTransactionalRepository,
  SceneCatalogAdminTransactionProvider,
} from "@/lib/repositories/scene-catalog-admin-repository";
import { PrismaSceneCatalogAdminTransactions } from "@/lib/repositories/prisma-scene-catalog-repository";
import {
  matchesSearch as matchesTextSearch,
  normalizeSearchText,
} from "@/lib/search/text-search";
import {
  backgroundRenderSnapshotSchema,
} from "@/lib/scenes/scene-render-config";
import {
  backgroundAdminListQuerySchema,
  createBackgroundCommandSchema,
  createPaletteCommandSchema,
  deleteCatalogItemCommandSchema,
  paletteAdminListQuerySchema,
  SCENE_CATALOG_ADMIN_PAGE_SIZE,
  transitionCatalogItemCommandSchema,
  updateBackgroundCommandSchema,
  updatePaletteCommandSchema,
} from "@/lib/validation/scene-catalog-schema";
import { validateCommand } from "@/lib/validation/story-command-schema";
import type { BackgroundRenderSnapshot, CatalogStatus } from "@/types/scene";
import type {
  BackgroundAdminListQuery,
  BackgroundAdminRenderInput,
  ManagedBackgroundAsset,
  PaletteAdminListQuery,
  SceneCatalogImpact,
} from "@/types/scene-catalog-admin";
import { CommandError, notFound } from "./command-error";

const BACKGROUND_CAPABILITIES = Object.freeze({
  can_create: true,
  can_edit: true,
  can_activate: true,
  can_archive: true,
  hard_delete_never_activated_only: true,
} as const);

const RETIRED_PALETTE_CAPABILITIES = Object.freeze({
  can_create: false,
  can_edit: false,
  can_activate: false,
  can_archive: false,
  hard_delete_never_activated_only: false,
} as const);

const IMPACT: SceneCatalogImpact = Object.freeze({
  dependency_count: null,
  provenance: "snapshot_only",
  saved_scenes_unchanged: true,
  storage_cleanup: "separate",
});

export interface SceneCatalogAdminAuditEvent {
  event: "scene_catalog_admin_mutation";
  action: "created" | "updated" | "activated" | "archived" | "deleted";
  kind: "background" | "palette";
  actorId: string;
  itemId: string;
  updatedAt: string;
}
export interface SceneCatalogAdminAuditLogger {
  log(event: SceneCatalogAdminAuditEvent): void;
}

const structuredAuditLogger: SceneCatalogAdminAuditLogger = {
  log(event) {
    // Deliberately excludes labels, tags, colors, media URLs and upload IDs.
    console.info("[scene-catalog-admin]", JSON.stringify(event));
  },
};

async function authorizeExactAdmin(
  repository: SceneCatalogAdminTransactionalRepository,
  actorId: string,
): Promise<void> {
  if (await repository.getActorRole(actorId) !== "admin") throw new AuthAccessError(403);
}

async function requireBackground(
  repository: SceneCatalogAdminTransactionalRepository,
  itemId: string,
): Promise<ManagedBackgroundAsset> {
  return await repository.getAdminBackground(itemId) ?? notFound();
}

interface BackgroundCursorPayload {
  v: 1;
  kind: "background";
  q: string;
  type: BackgroundAdminListQuery["type"];
  motion: BackgroundAdminListQuery["motion"];
  status: BackgroundAdminListQuery["status"];
  lastId: string;
}

interface PaletteCursorPayload {
  v: 1;
  kind: "palette";
  q: string;
  status: PaletteAdminListQuery["status"];
  lastId: string;
}

function encodeBackgroundCursor(query: BackgroundAdminListQuery, lastId: string): string {
  const payload: BackgroundCursorPayload = {
    v: 1,
    kind: "background",
    q: normalizeSearchText(query.q),
    type: query.type,
    motion: query.motion,
    status: query.status,
    lastId,
  };
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function decodeBackgroundCursor(query: BackgroundAdminListQuery): string | null {
  if (!query.cursor) return null;
  try {
    const parsed = JSON.parse(
      Buffer.from(query.cursor, "base64url").toString("utf8"),
    ) as Partial<BackgroundCursorPayload>;
    return parsed.v === 1
      && parsed.kind === "background"
      && parsed.q === normalizeSearchText(query.q)
      && parsed.type === query.type
      && parsed.motion === query.motion
      && parsed.status === query.status
      && typeof parsed.lastId === "string"
      && Boolean(parsed.lastId)
      ? parsed.lastId
      : null;
  } catch {
    return null;
  }
}

function encodePaletteCursor(query: PaletteAdminListQuery, lastId: string): string {
  const payload: PaletteCursorPayload = {
    v: 1,
    kind: "palette",
    q: normalizeSearchText(query.q),
    status: query.status,
    lastId,
  };
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function decodePaletteCursor(query: PaletteAdminListQuery): string | null {
  if (!query.cursor) return null;
  try {
    const parsed = JSON.parse(
      Buffer.from(query.cursor, "base64url").toString("utf8"),
    ) as Partial<PaletteCursorPayload>;
    return parsed.v === 1
      && parsed.kind === "palette"
      && parsed.q === normalizeSearchText(query.q)
      && parsed.status === query.status
      && typeof parsed.lastId === "string"
      && Boolean(parsed.lastId)
      ? parsed.lastId
      : null;
  } catch {
    return null;
  }
}

function paginate<T extends { id: string }>(
  filtered: T[],
  cursorId: string | null,
  encodeCursor: (lastId: string) => string,
) {
  const cursorIndex = cursorId === null
    ? -1
    : filtered.findIndex((item) => item.id === cursorId);
  const start = cursorIndex < 0 ? 0 : cursorIndex + 1;
  const items = filtered.slice(start, start + SCENE_CATALOG_ADMIN_PAGE_SIZE);
  const hasMore = start + items.length < filtered.length;
  return {
    items,
    total: filtered.length,
    nextCursor: hasMore && items.length > 0 ? encodeCursor(items.at(-1)!.id) : null,
  };
}

function matchesCatalogSearch(
  item: { id: string; label: string; mood_tags: string[] },
  query: string,
): boolean {
  return matchesTextSearch(query, item.id, item.label, ...item.mood_tags);
}

function invalidUpload(field: string, message: string): never {
  throw new CommandError(400, "VALIDATION_ERROR", "Invalid request data", { [field]: [message] });
}

async function resolveBackgroundRender(
  repository: SceneCatalogAdminTransactionalRepository,
  actorId: string,
  input: BackgroundAdminRenderInput,
  current?: BackgroundRenderSnapshot,
): Promise<BackgroundRenderSnapshot> {
  const claimedAt = new Date();
  if (input.kind === "image") {
    if (!input.uploadId) {
      if (current?.render_data.kind !== "image") {
        invalidUpload("render.uploadId", "Hãy tải ảnh nền trước khi lưu.");
      }
      return backgroundRenderSnapshotSchema.parse(current);
    }
    const media = await repository.claimGlobalBackgroundUpload(actorId, input.uploadId, "image", claimedAt);
    return backgroundRenderSnapshotSchema.parse({
      render_data: { kind: "image", media_url: media.primary.url },
      motion: "static",
    });
  }
  if (input.kind === "video") {
    if (!input.uploadId) {
      if (current?.render_data.kind !== "video") {
        invalidUpload("render.uploadId", "Hãy tải video và poster trước khi lưu.");
      }
      return backgroundRenderSnapshotSchema.parse(current);
    }
    const media = await repository.claimGlobalBackgroundUpload(actorId, input.uploadId, "video", claimedAt);
    if (!media.poster) invalidUpload("render.uploadId", "Video nền cần một ảnh poster hợp lệ.");
    return backgroundRenderSnapshotSchema.parse({
      render_data: { kind: "video", media_url: media.primary.url },
      motion: "looping",
      poster_frame: media.poster.url,
    });
  }
  if (input.kind === "gradient") {
    return backgroundRenderSnapshotSchema.parse({
      render_data: { kind: "gradient", angle_deg: input.angleDeg, stops: input.stops },
      motion: "static",
    });
  }
  if (input.kind === "radial_gradient") {
    return backgroundRenderSnapshotSchema.parse({
      render_data: {
        kind: "radial_gradient",
        shape: input.shape,
        center: input.center,
        stops: input.stops,
      },
      motion: "static",
    });
  }

  let posterFrame: string | undefined;
  if (input.posterUploadId) {
    const media = await repository.claimGlobalBackgroundUpload(actorId, input.posterUploadId, "image", claimedAt);
    posterFrame = media.primary.url;
  } else if (current?.render_data.kind === "particle_composition") {
    posterFrame = current.poster_frame;
  }
  if (input.motion === "looping" && !posterFrame) {
    invalidUpload("render.posterUploadId", "Bối cảnh hạt chuyển động cần một ảnh poster.");
  }
  return backgroundRenderSnapshotSchema.parse({
    render_data: {
      kind: "particle_composition",
      composition_key: input.compositionKey,
      config: input.config,
    },
    motion: input.motion,
    ...(posterFrame ? { poster_frame: posterFrame } : {}),
  });
}

function assertTransition(current: CatalogStatus, target: "active" | "archived"): void {
  const allowed = target === "active"
    ? current === "draft" || current === "archived"
    : current === "draft" || current === "active";
  if (!allowed) {
    throw new CommandError(409, "INVALID_CATALOG_TRANSITION", "This catalog status transition is not allowed.");
  }
}

export class AdminSceneCatalogService {
  constructor(
    private readonly transactions: SceneCatalogAdminTransactionProvider = new PrismaSceneCatalogAdminTransactions(),
    private readonly audit: SceneCatalogAdminAuditLogger = structuredAuditLogger,
  ) {}

  async listBackgrounds(actorId: string, rawQuery: BackgroundAdminListQuery) {
    const query = validateCommand(backgroundAdminListQuerySchema, rawQuery);
    return this.transactions.transaction(async (repository) => {
      await authorizeExactAdmin(repository, actorId);
      const filtered = (await repository.getAdminBackgrounds()).filter((item) =>
        matchesCatalogSearch(item, query.q)
        && (query.type === "all" || item.render.render_data.kind === query.type)
        && (query.motion === "all" || item.render.motion === query.motion)
        && (query.status === "all" || item.status === query.status));
      return {
        ...paginate(
          filtered,
          decodeBackgroundCursor(query),
          (lastId) => encodeBackgroundCursor(query, lastId),
        ),
        capabilities: BACKGROUND_CAPABILITIES,
      };
    });
  }

  async listPalettes(actorId: string, rawQuery: PaletteAdminListQuery) {
    const query = validateCommand(paletteAdminListQuerySchema, rawQuery);
    return this.transactions.transaction(async (repository) => {
      await authorizeExactAdmin(repository, actorId);
      const filtered = (await repository.getAdminPalettes()).filter((item) =>
        matchesCatalogSearch(item, query.q)
        && (query.status === "all" || item.status === query.status));
      return {
        ...paginate(
          filtered,
          decodePaletteCursor(query),
          (lastId) => encodePaletteCursor(query, lastId),
        ),
        capabilities: RETIRED_PALETTE_CAPABILITIES,
      };
    });
  }

  async createBackground(rawCommand: unknown) {
    const command = validateCommand(createBackgroundCommandSchema, rawCommand);
    const result = await this.transactions.transaction(async (repository) => {
      await authorizeExactAdmin(repository, command.actorId);
      const render = await resolveBackgroundRender(repository, command.actorId, command.render);
      const data = await repository.createBackground({
        label: command.label,
        moodTags: command.moodTags,
        render,
      });
      return this.mutationResult("created", "background", command.actorId, data);
    });
    this.writeAudit(result.audit);
    return { data: result.data, meta: result.meta };
  }

  async createPalette(rawCommand: unknown) {
    const command = validateCommand(createPaletteCommandSchema, rawCommand);
    return this.transactions.transaction(async (repository) => {
      await authorizeExactAdmin(repository, command.actorId);
      this.paletteRetired();
    });
  }

  async updateBackground(rawCommand: unknown) {
    const command = validateCommand(updateBackgroundCommandSchema, rawCommand);
    const result = await this.transactions.transaction(async (repository) => {
      await authorizeExactAdmin(repository, command.actorId);
      const current = await requireBackground(repository, command.itemId);
      const render = await resolveBackgroundRender(repository, command.actorId, command.render, current.render);
      const data = await repository.updateBackground(command.itemId, command.expectedUpdatedAt, {
        label: command.label,
        moodTags: command.moodTags,
        render,
      });
      return this.mutationResult("updated", "background", command.actorId, data);
    });
    this.writeAudit(result.audit);
    return { data: result.data, meta: result.meta };
  }

  async updatePalette(rawCommand: unknown) {
    const command = validateCommand(updatePaletteCommandSchema, rawCommand);
    return this.transactions.transaction(async (repository) => {
      await authorizeExactAdmin(repository, command.actorId);
      this.paletteRetired();
    });
  }

  async transition(rawCommand: unknown) {
    const command = validateCommand(transitionCatalogItemCommandSchema, rawCommand);
    const result = await this.transactions.transaction(async (repository) => {
      await authorizeExactAdmin(repository, command.actorId);
      if (command.kind === "palette") this.paletteRetired();
      const current = await requireBackground(repository, command.itemId);
      assertTransition(current.status, command.status);
      if (command.status === "active") backgroundRenderSnapshotSchema.parse(current.render);
      const activatedAt = current.activated_at
        ? new Date(current.activated_at)
        : command.status === "active" ? new Date() : null;
      const data = await repository.transitionBackground(
        command.itemId,
        command.expectedUpdatedAt,
        command.status,
        activatedAt,
      );
      return this.mutationResult(
        command.status === "active" ? "activated" : "archived",
        "background",
        command.actorId,
        data,
      );
    });
    this.writeAudit(result.audit);
    return { data: result.data, meta: result.meta };
  }

  async delete(rawCommand: unknown) {
    const command = validateCommand(deleteCatalogItemCommandSchema, rawCommand);
    const result = await this.transactions.transaction(async (repository) => {
      await authorizeExactAdmin(repository, command.actorId);
      if (command.kind === "palette") this.paletteRetired();
      const current = await requireBackground(repository, command.itemId);
      if (!current.can_hard_delete) this.deleteActivatedConflict();
      await repository.deleteBackground(command.itemId, command.expectedUpdatedAt);
      const audit = {
        event: "scene_catalog_admin_mutation",
        action: "deleted",
        kind: command.kind,
        actorId: command.actorId,
        itemId: command.itemId,
        updatedAt: new Date().toISOString(),
      } satisfies SceneCatalogAdminAuditEvent;
      return {
        data: { id: command.itemId, impact: { ...IMPACT } },
        meta: { updatedAt: command.expectedUpdatedAt },
        audit,
      };
    });
    this.writeAudit(result.audit);
    return { data: result.data, meta: result.meta };
  }

  private mutationResult<T extends ManagedBackgroundAsset>(
    action: SceneCatalogAdminAuditEvent["action"],
    kind: SceneCatalogAdminAuditEvent["kind"],
    actorId: string,
    data: T,
  ) {
    return {
      data,
      meta: { updatedAt: data.updated_at },
      audit: {
        event: "scene_catalog_admin_mutation",
        action,
        kind,
        actorId,
        itemId: data.id,
        updatedAt: data.updated_at,
      } satisfies SceneCatalogAdminAuditEvent,
    };
  }

  private deleteActivatedConflict(): never {
    throw new CommandError(
      409,
      "CATALOG_ITEM_WAS_ACTIVATED",
      "A catalog item that has been activated must be archived instead of deleted.",
    );
  }

  private paletteRetired(): never {
    throw new CommandError(
      410,
      "PALETTE_CATALOG_RETIRED",
      "Palette catalog is read-only after the Scene v2 cutover.",
    );
  }

  private writeAudit(event: SceneCatalogAdminAuditEvent): void {
    try {
      this.audit.log(event);
    } catch {
      console.error("[scene-catalog-admin] SCENE_CATALOG_AUDIT_LOG_FAILED");
    }
  }
}
