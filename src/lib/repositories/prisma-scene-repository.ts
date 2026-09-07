import type { Scene } from "@/types/scene";
import { databaseJson } from "@/lib/db/json-fields";
import { validateSceneRange } from "@/lib/scenes/sceneRange";
import type { SceneRepository } from "./scene-repository";
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

export interface PrismaSceneRow {
  id: string;
  chapterId: string;
  startBlockId: string;
  endBlockId: string;
  basedOnPresetId: string | null;
  renderConfig: unknown;
}

export function mapPrismaScenes(
  rows: readonly PrismaSceneRow[],
  chapterId: string,
  orderedBlockIds: readonly string[],
  observer: RepositoryReadObserver = consoleRepositoryReadObserver,
): Scene[] {
  const blockIndexes = new Map(
    orderedBlockIds.map((blockId, index) => [blockId, index] as const),
  );
  const ids = new Set<string>();
  const mapped = rows.map((row) => {
    if (
      !row.id.trim()
      || row.chapterId !== chapterId
      || ids.has(row.id)
      || (row.basedOnPresetId !== null && !row.basedOnPresetId.trim())
    ) {
      failRepositoryRead(observer, "P3_PRISMA_INVALID_SCENE_MEMBERSHIP");
    }
    ids.add(row.id);
    let renderConfig;
    try {
      renderConfig = databaseJson.sceneRenderConfig.read(row.renderConfig);
    } catch {
      failRepositoryRead(observer, "P3_PRISMA_INVALID_SCENE_SNAPSHOT");
    }
    return {
      id: row.id,
      chapter_id: row.chapterId,
      start_block_id: row.startBlockId,
      end_block_id: row.endBlockId,
      ...(row.basedOnPresetId
        ? { based_on_preset_id: row.basedOnPresetId }
        : {}),
      render_config: renderConfig,
    } satisfies Scene;
  });

  const ranges = mapped
    .map((scene) => ({
      scene,
      range: validateSceneRange(scene, blockIndexes, orderedBlockIds.length),
    }))
    .sort((left, right) => {
      if (!left.range.valid || !right.range.valid) return 0;
      return left.range.startIndex - right.range.startIndex
        || left.scene.id.localeCompare(right.scene.id);
    });
  if (ranges.some(({ range }) => !range.valid)) {
    failRepositoryRead(observer, "P3_PRISMA_INVALID_SCENE_RANGE");
  }
  for (let index = 1; index < ranges.length; index += 1) {
    const previous = ranges[index - 1].range;
    const current = ranges[index].range;
    if (previous.valid && current.valid && current.startIndex <= previous.endIndex) {
      failRepositoryRead(observer, "P3_PRISMA_OVERLAPPING_SCENE_RANGE");
    }
  }
  return ranges.map(({ scene }) => scene);
}

export class PrismaSceneRepository implements SceneRepository {
  constructor(
    private readonly clientSource: PrismaReadClientSource = loadRuntimePrismaClient,
    private readonly observer: RepositoryReadObserver = consoleRepositoryReadObserver,
  ) {}

  async getByChapter(storyId: string, chapterId: string): Promise<Scene[]> {
    if (!storyId.trim() || !chapterId.trim()) return [];
    const db = await resolvePrismaReadClient(this.clientSource);
    const chapter = await db.chapter.findFirst({
      where: { id: chapterId, story: { slug: storyId } },
      select: {
        id: true,
        blocks: {
          orderBy: [{ order: "asc" }, { id: "asc" }],
          select: { id: true },
        },
        scenes: {
          orderBy: { id: "asc" },
          select: {
            id: true,
            chapterId: true,
            startBlockId: true,
            endBlockId: true,
            basedOnPresetId: true,
            renderConfig: true,
          },
        },
      },
    });
    if (!chapter) return [];
    return mapPrismaScenes(
      chapter.scenes,
      chapter.id,
      chapter.blocks.map((block) => block.id),
      this.observer,
    );
  }
}
