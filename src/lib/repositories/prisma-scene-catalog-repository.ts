import type {
  BackgroundAsset,
  BackgroundSource,
  ColorPalette,
  ScenePreset,
} from "@/types/scene";
import { databaseJson } from "@/lib/db/json-fields";
import { paletteRenderSnapshotSchema } from "@/lib/scenes/scene-render-config";
import type { SceneLibraryRepository } from "./scene-repository";
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

function optionalIso(value: Date | null): string | undefined {
  return value ? value.toISOString() : undefined;
}

function backgroundSource(
  value: string,
  observer: RepositoryReadObserver,
): BackgroundSource {
  if (["admin_upload", "author_upload", "ai_generated"].includes(value)) {
    return value as BackgroundSource;
  }
  return failRepositoryRead(observer, "P3_PRISMA_INVALID_BACKGROUND_SOURCE");
}

export class PrismaSceneCatalogRepository implements SceneLibraryRepository {
  constructor(
    private readonly clientSource: PrismaReadClientSource = loadRuntimePrismaClient,
    private readonly observer: RepositoryReadObserver = consoleRepositoryReadObserver,
  ) {}

  async getActiveGlobalBackgrounds(): Promise<BackgroundAsset[]> {
    const db = await resolvePrismaReadClient(this.clientSource);
    const rows = await db.backgroundAsset.findMany({
      where: { scope: "global", status: "ACTIVE" },
      orderBy: { id: "asc" },
      select: {
        id: true,
        label: true,
        render: true,
        moodTags: true,
        status: true,
        activatedAt: true,
        scope: true,
        ownerId: true,
        source: true,
        generationPrompt: true,
      },
    });
    return rows.map((row) => {
      if (row.scope !== "global" || row.ownerId !== null) {
        return failRepositoryRead(
          this.observer,
          "P3_PRISMA_BACKGROUND_SCOPE_LEAK",
        );
      }
      let render;
      try {
        render = databaseJson.backgroundRender.read(row.render);
      } catch {
        return failRepositoryRead(
          this.observer,
          "P3_PRISMA_INVALID_BACKGROUND_RENDER",
        );
      }
      const activatedAt = optionalIso(row.activatedAt);
      return {
        id: row.id,
        label: row.label,
        render,
        mood_tags: [...row.moodTags],
        status: "active",
        ...(activatedAt ? { activated_at: activatedAt } : {}),
        scope: "global",
        source: backgroundSource(row.source, this.observer),
        ...(row.generationPrompt === null
          ? {}
          : { generation_prompt: row.generationPrompt }),
      } satisfies BackgroundAsset;
    });
  }

  async getActivePalettes(): Promise<ColorPalette[]> {
    const db = await resolvePrismaReadClient(this.clientSource);
    const rows = await db.colorPalette.findMany({
      where: { status: "ACTIVE" },
      orderBy: { id: "asc" },
    });
    return rows.map((row) => {
      const colors = paletteRenderSnapshotSchema.safeParse({
        primary: row.primary,
        secondary: row.secondary,
        accent: row.accent,
        background_tint: {
          color: row.backgroundTintColor,
          opacity: row.backgroundTintOpacity,
        },
      });
      if (!colors.success) {
        return failRepositoryRead(
          this.observer,
          "P3_PRISMA_INVALID_PALETTE",
        );
      }
      const activatedAt = optionalIso(row.activatedAt);
      return {
        id: row.id,
        label: row.label,
        colors: colors.data,
        mood_tags: [...row.moodTags],
        status: "active",
        ...(activatedAt ? { activated_at: activatedAt } : {}),
      } satisfies ColorPalette;
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
        return failRepositoryRead(
          this.observer,
          "P3_PRISMA_INVALID_PRESET_SNAPSHOT",
        );
      }
      const activatedAt = optionalIso(row.activatedAt);
      return {
        id: row.id,
        label: row.label,
        ...(row.description === null ? {} : { description: row.description }),
        ...(row.thumbnailUrl === null
          ? {}
          : { thumbnail_url: row.thumbnailUrl }),
        mood_tags: [...row.moodTags],
        status: "active",
        ...(activatedAt ? { activated_at: activatedAt } : {}),
        render_config: renderConfig,
      } satisfies ScenePreset;
    });
  }
}
