// lib/repositories/index.ts
import { JsonStoryRepository } from "./json-story-repository";
import { StoryRepository } from "./story-repository";
import type { SceneLibraryRepository, SceneRepository, LegacySceneLibraryRepository, LegacySceneRepository } from "./scene-repository";
import { JsonSceneLibraryRepository, JsonSceneRepository } from "./json-scene-repository";

export const storyRepository: StoryRepository = new JsonStoryRepository();
export const sceneLibraryRepository: SceneLibraryRepository & LegacySceneLibraryRepository = new JsonSceneLibraryRepository();
export const sceneRepository: SceneRepository & LegacySceneRepository = new JsonSceneRepository(storyRepository, sceneLibraryRepository);

export * from "./story-repository";
export * from "./json-story-repository";
export * from "./scene-repository";
export * from "./json-scene-repository";
