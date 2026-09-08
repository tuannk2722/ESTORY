// lib/repositories/index.ts
import { serverEnv } from "@/lib/env";
import { CommandError } from "@/lib/services/command-error";
import { JsonStoryRepository } from "./json-story-repository";
import type {
  PublicChapterReaderData,
  StoryRepository,
} from "./story-repository";
import type {
  LegacySceneLibraryRepository,
  LegacySceneRepository,
  SceneLibraryRepository,
  SceneRepository,
} from "./scene-repository";
import {
  JsonSceneLibraryRepository,
  JsonSceneRepository,
} from "./json-scene-repository";
import { PrismaStoryRepository } from "./prisma-story-repository";
import { PrismaSceneRepository } from "./prisma-scene-repository";
import { PrismaSceneCatalogRepository } from "./prisma-scene-catalog-repository";
import { PrismaEffectAdminRepository } from "./prisma-effect-admin-repository";
import {
  ShadowSceneLibraryRepository,
  ShadowSceneRepository,
  ShadowStoryRepository,
} from "./shadow-read-repository";

const jsonStoryRepository = new JsonStoryRepository();
const jsonSceneLibraryRepository = new JsonSceneLibraryRepository();
const jsonSceneRepository = new JsonSceneRepository(
  jsonStoryRepository,
  jsonSceneLibraryRepository,
);
const prismaStoryRepository = new PrismaStoryRepository();
const prismaSceneRepository = new PrismaSceneRepository();
const prismaSceneLibraryRepository = new PrismaSceneCatalogRepository();

const selectedStoryRead: StoryRepository =
  serverEnv.PHASE3_STORY_READ_SOURCE === "prisma"
    ? prismaStoryRepository
    : jsonStoryRepository;
const otherStoryRead: StoryRepository =
  serverEnv.PHASE3_STORY_READ_SOURCE === "prisma"
    ? jsonStoryRepository
    : prismaStoryRepository;
const activeStoryRead = serverEnv.PHASE3_SHADOW_READ === "true"
  ? new ShadowStoryRepository(selectedStoryRead, otherStoryRead)
  : selectedStoryRead;

// Runtime writes must go through guarded transactional commands from P3-06 onward.
export const storyRepository: StoryRepository = {
  getAll: () => activeStoryRead.getAll(),
  getAllPublic: () => activeStoryRead.getAllPublic(),
  getById: (id: string) => activeStoryRead.getById(id),
  getPublicById: (id: string) => activeStoryRead.getPublicById(id),
  getPublicChapter: (
    storyId: string,
    chapterId: string,
  ): Promise<PublicChapterReaderData | null> =>
    activeStoryRead.getPublicChapter(storyId, chapterId),
  getAllForAuthor: (authorId: string) =>
    activeStoryRead.getAllForAuthor(authorId),
  save: async () => { throw new CommandError(503, "LEGACY_WRITES_DISABLED", "Use transactional content commands."); },
};

const selectedSceneRead: SceneRepository =
  serverEnv.PHASE3_SCENE_READ_SOURCE === "prisma"
    ? prismaSceneRepository
    : jsonSceneRepository;
const otherSceneRead: SceneRepository =
  serverEnv.PHASE3_SCENE_READ_SOURCE === "prisma"
    ? jsonSceneRepository
    : prismaSceneRepository;
const activeSceneRead = serverEnv.PHASE3_SHADOW_READ === "true"
  ? new ShadowSceneRepository(selectedSceneRead, otherSceneRead)
  : selectedSceneRead;

const selectedSceneLibraryRead: SceneLibraryRepository =
  serverEnv.PHASE3_SCENE_READ_SOURCE === "prisma"
    ? prismaSceneLibraryRepository
    : jsonSceneLibraryRepository;
const otherSceneLibraryRead: SceneLibraryRepository =
  serverEnv.PHASE3_SCENE_READ_SOURCE === "prisma"
    ? jsonSceneLibraryRepository
    : prismaSceneLibraryRepository;
const activeSceneLibraryRead = serverEnv.PHASE3_SHADOW_READ === "true"
  ? new ShadowSceneLibraryRepository(
      selectedSceneLibraryRead,
      otherSceneLibraryRead,
    )
  : selectedSceneLibraryRead;

export const sceneRepository: SceneRepository & LegacySceneRepository = {
  getByChapter: (storyId, chapterId) =>
    activeSceneRead.getByChapter(storyId, chapterId),
  getLegacyByChapter: (storyId, chapterId) =>
    jsonSceneRepository.getLegacyByChapter(storyId, chapterId),
  replaceLegacyChapterScenes: async () => { throw new CommandError(503, "LEGACY_WRITES_DISABLED", "Use transactional content commands."); },
};

export const sceneLibraryRepository: SceneLibraryRepository &
  LegacySceneLibraryRepository = {
    getActiveGlobalBackgrounds: () =>
      activeSceneLibraryRead.getActiveGlobalBackgrounds(),
    getActivePalettes: () => activeSceneLibraryRead.getActivePalettes(),
    getActiveScenePresets: () =>
      activeSceneLibraryRead.getActiveScenePresets(),
    getBackgrounds: () => jsonSceneLibraryRepository.getBackgrounds(),
    getPalettes: () => jsonSceneLibraryRepository.getPalettes(),
    getScenePresets: () => jsonSceneLibraryRepository.getScenePresets(),
  };

// Effect overlay/keyword reads are DB-owned from P3-04 onward. P3-12 adds
// guarded mutations and the manifest merge service.
export const effectAdminReadRepository = new PrismaEffectAdminRepository();

export * from "./story-repository";
export * from "./json-story-repository";
export * from "./prisma-story-repository";
export * from "./scene-repository";
export * from "./json-scene-repository";
export * from "./prisma-scene-repository";
export * from "./prisma-scene-catalog-repository";
export * from "./effect-admin-repository";
export * from "./prisma-effect-admin-repository";
export * from "./read-observability";
export * from "./shadow-read-repository";
