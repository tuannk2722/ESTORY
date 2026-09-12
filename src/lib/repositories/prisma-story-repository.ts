import type {
  Chapter,
  ChapterStatus,
  EffectConfig,
  Story,
  StoryBlock,
  StoryBlockType,
  StoryStatus,
} from "@/types/story";
import type { Prisma } from "@/generated/prisma/client";
import { effectConfigSchema } from "@/lib/effects/effect-config-schema";
import type {
  PublicChapterReaderData,
  StoryRepository,
} from "./story-repository";
import {
  loadRuntimePrismaClient,
  resolvePrismaReadClient,
  type PrismaReadClientSource,
} from "./prisma-read-client";
import { mapPrismaScenes } from "./prisma-scene-repository";
import {
  consoleRepositoryReadObserver,
  failRepositoryRead,
  RepositoryReadError,
  type RepositoryReadObserver,
} from "./read-observability";

interface EffectRow {
  id: string;
  type: string;
  category: string;
  intensity: number;
  durationMs: number;
  delayMs: number | null;
  audioSrc: string | null;
  audioAssetId: string | null;
  loop: boolean;
}

interface BlockRow {
  id: string;
  type: string;
  text: string;
  moodTag: string | null;
  effects: EffectRow[];
}

interface ChapterRow {
  id: string;
  title: string;
  order: number;
  status: string;
  viewCount: number;
  blocks: BlockRow[];
}

interface StoryRow {
  slug: string;
  title: string;
  authorDisplayName: string;
  description: string;
  coverUrl: string | null;
  coverPositionX: number;
  coverPositionY: number;
  genre: string[];
  status: string;
  viewCount: number;
  chapters: ChapterRow[];
}

const effectSelect = {
  id: true,
  type: true,
  category: true,
  intensity: true,
  durationMs: true,
  delayMs: true,
  audioSrc: true,
  audioAssetId: true,
  loop: true,
} satisfies Prisma.EffectSelect;

const blockSelect = {
  id: true,
  type: true,
  text: true,
  moodTag: true,
  effects: { orderBy: { id: "asc" as const }, select: effectSelect },
} satisfies Prisma.StoryBlockSelect;

const chapterSelect = {
  id: true,
  title: true,
  order: true,
  status: true,
  viewCount: true,
  blocks: {
    orderBy: [{ order: "asc" }, { id: "asc" }],
    select: blockSelect,
  },
} satisfies Prisma.ChapterSelect;

function nonEmpty(
  value: string,
  code: string,
  observer: RepositoryReadObserver,
): string {
  if (!value.trim()) failRepositoryRead(observer, code);
  return value;
}

function mapStoryStatus(
  value: string,
  observer: RepositoryReadObserver,
): StoryStatus {
  const statuses: Record<string, StoryStatus> = {
    DRAFT: "draft",
    PENDING_REVIEW: "pending_review",
    PUBLISHED: "published",
    REJECTED: "rejected",
    ARCHIVED: "archived",
  };
  return statuses[value]
    ?? failRepositoryRead(observer, "P3_PRISMA_INVALID_STORY_STATUS");
}

function mapChapterStatus(
  value: string,
  observer: RepositoryReadObserver,
): ChapterStatus {
  if (value === "DRAFT") return "draft";
  if (value === "PUBLISHED") return "published";
  return failRepositoryRead(observer, "P3_PRISMA_INVALID_CHAPTER_STATUS");
}

function mapEffect(
  row: EffectRow,
  observer: RepositoryReadObserver,
): EffectConfig {
  const result = effectConfigSchema.safeParse({
    id: row.id,
    type: row.type,
    category: row.category,
    intensity: row.intensity,
    duration_ms: row.durationMs,
    ...(row.delayMs === null ? {} : { delay_ms: row.delayMs }),
    ...(row.audioSrc === null ? {} : { audio_src: row.audioSrc }),
    ...(row.audioAssetId === null
      ? {}
      : { audio_asset_id: row.audioAssetId }),
    loop: row.loop,
  });
  if (!result.success) {
    return failRepositoryRead(observer, "P3_PRISMA_INVALID_EFFECT");
  }
  return result.data;
}

function mapBlock(
  row: BlockRow,
  observer: RepositoryReadObserver,
): StoryBlock {
  const blockTypes: readonly StoryBlockType[] = [
    "paragraph",
    "dialogue",
    "heading",
  ];
  if (!blockTypes.includes(row.type as StoryBlockType)) {
    return failRepositoryRead(observer, "P3_PRISMA_INVALID_BLOCK_TYPE");
  }
  return {
    id: nonEmpty(row.id, "P3_PRISMA_INVALID_BLOCK", observer),
    type: row.type as StoryBlockType,
    text: row.text,
    ...(row.moodTag === null ? {} : { mood_tag: row.moodTag }),
    effects: row.effects.map((effect) => mapEffect(effect, observer)),
  };
}

function mapChapter(
  row: ChapterRow,
  observer: RepositoryReadObserver,
): Chapter {
  if (!Number.isInteger(row.order) || row.order < 0 || row.viewCount < 0) {
    return failRepositoryRead(observer, "P3_PRISMA_INVALID_CHAPTER");
  }
  return {
    id: nonEmpty(row.id, "P3_PRISMA_INVALID_CHAPTER", observer),
    title: row.title,
    order: row.order,
    status: mapChapterStatus(row.status, observer),
    ...(row.viewCount === 0 ? {} : { view_count: row.viewCount }),
    blocks: row.blocks.map((block) => mapBlock(block, observer)),
  };
}

function mapStory(
  row: StoryRow,
  observer: RepositoryReadObserver,
): Story {
  if (
    row.viewCount < 0
    || !Array.isArray(row.genre)
    || !Number.isFinite(row.coverPositionX)
    || !Number.isFinite(row.coverPositionY)
    || row.coverPositionX < 0
    || row.coverPositionX > 100
    || row.coverPositionY < 0
    || row.coverPositionY > 100
  ) {
    return failRepositoryRead(observer, "P3_PRISMA_INVALID_STORY");
  }
  return {
    id: nonEmpty(row.slug, "P3_PRISMA_INVALID_STORY", observer),
    title: row.title,
    author: nonEmpty(
      row.authorDisplayName,
      "P3_PRISMA_INVALID_STORY_AUTHOR_DISPLAY",
      observer,
    ),
    description: row.description,
    ...(row.coverUrl === null ? {} : { cover_image: row.coverUrl }),
    ...(row.coverPositionX === 50 && row.coverPositionY === 50
      ? {}
      : { cover_position: { x: row.coverPositionX, y: row.coverPositionY } }),
    genre: [...row.genre],
    status: mapStoryStatus(row.status, observer),
    view_count: row.viewCount,
    chapters: row.chapters.map((chapter) => mapChapter(chapter, observer)),
  };
}

export class PrismaStoryRepository implements StoryRepository {
  constructor(
    private readonly clientSource: PrismaReadClientSource = loadRuntimePrismaClient,
    private readonly observer: RepositoryReadObserver = consoleRepositoryReadObserver,
  ) {}

  private async findStories(options: {
    storyStatus?: "PUBLISHED";
    authorId?: string;
  }): Promise<Story[]> {
    const db = await resolvePrismaReadClient(this.clientSource);
    const rows = await db.story.findMany({
      where: {
        ...(options.storyStatus ? { status: options.storyStatus } : {}),
        ...(options.authorId ? { authorId: options.authorId } : {}),
      },
      orderBy: { slug: "asc" },
      select: {
        slug: true,
        title: true,
        authorDisplayName: true,
        description: true,
        coverUrl: true,
        coverPositionX: true,
        coverPositionY: true,
        genre: true,
        status: true,
        viewCount: true,
        chapters: {
          ...(options.storyStatus
            ? { where: { status: "PUBLISHED" as const } }
            : {}),
          orderBy: [{ order: "asc" }, { id: "asc" }],
          select: chapterSelect,
        },
      },
    });
    if (!options.storyStatus) {
      return rows.map((row) => mapStory(row, this.observer));
    }
    return rows.flatMap((row) => {
      try {
        return [mapStory(row, this.observer)];
      } catch (error) {
        if (error instanceof RepositoryReadError) return [];
        throw error;
      }
    });
  }

  private async findStory(id: string, publicOnly: boolean): Promise<Story | null> {
    if (!id.trim()) return null;
    const db = await resolvePrismaReadClient(this.clientSource);
    const row = await db.story.findFirst({
      where: {
        slug: id,
        ...(publicOnly ? { status: "PUBLISHED" as const } : {}),
      },
      select: {
        slug: true,
        title: true,
        authorDisplayName: true,
        description: true,
        coverUrl: true,
        coverPositionX: true,
        coverPositionY: true,
        genre: true,
        status: true,
        viewCount: true,
        chapters: {
          ...(publicOnly ? { where: { status: "PUBLISHED" as const } } : {}),
          orderBy: [{ order: "asc" }, { id: "asc" }],
          select: chapterSelect,
        },
      },
    });
    if (!row) return null;
    try {
      return mapStory(row, this.observer);
    } catch (error) {
      if (publicOnly && error instanceof RepositoryReadError) return null;
      throw error;
    }
  }

  getAll(): Promise<Story[]> {
    return this.findStories({});
  }

  getAllPublic(): Promise<Story[]> {
    return this.findStories({ storyStatus: "PUBLISHED" });
  }

  getById(id: string): Promise<Story | null> {
    return this.findStory(id, false);
  }

  getPublicById(id: string): Promise<Story | null> {
    return this.findStory(id, true);
  }

  getAllForAuthor(authorId: string): Promise<Story[]> {
    if (!authorId.trim()) return Promise.resolve([]);
    return this.findStories({ authorId });
  }

  async getPublicChapter(
    storyId: string,
    chapterId: string,
  ): Promise<PublicChapterReaderData | null> {
    if (!storyId.trim() || !chapterId.trim()) return null;
    const db = await resolvePrismaReadClient(this.clientSource);
    const story = await db.story.findFirst({
      where: { slug: storyId, status: "PUBLISHED" },
      select: { id: true, slug: true, title: true },
    });
    if (!story || !story.slug.trim()) return null;
    const chapter = await db.chapter.findFirst({
      where: { id: chapterId, storyId: story.id, status: "PUBLISHED" },
      select: {
        ...chapterSelect,
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
    if (!chapter) return null;
    const navigation = await db.chapter.findMany({
      where: { storyId: story.id, status: "PUBLISHED" },
      orderBy: [{ order: "asc" }, { id: "asc" }],
      select: { id: true },
    });

    let mappedChapter: Chapter;
    try {
      mappedChapter = mapChapter(chapter, this.observer);
    } catch (error) {
      if (error instanceof RepositoryReadError) return null;
      throw error;
    }
    const scenes = mapPrismaScenes(
      chapter.scenes,
      chapter.id,
      mappedChapter.blocks.map((block) => block.id),
      this.observer,
    );
    const currentIndex = navigation.findIndex((item) => item.id === chapter.id);
    if (currentIndex === -1) return null;
    return {
      story: { id: story.slug, title: story.title },
      chapter: mappedChapter,
      scenes,
      previousChapterId: navigation[currentIndex - 1]?.id ?? null,
      nextChapterId: navigation[currentIndex + 1]?.id ?? null,
      isLastChapter: currentIndex === navigation.length - 1,
    };
  }

  async save(_story: Story): Promise<void> {
    void _story;
    throw new Error("Prisma writes are not available in P3-05");
  }
}
