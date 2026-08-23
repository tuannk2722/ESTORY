// lib/repositories/index.ts
import { JsonStoryRepository } from "./json-story-repository";
import { StoryRepository } from "./story-repository";
import { SceneLibraryRepository, SceneRepository } from "./scene-repository";
import { JsonSceneLibraryRepository, JsonSceneRepository } from "./json-scene-repository";

export const storyRepository: StoryRepository = new JsonStoryRepository();
export const sceneLibraryRepository: SceneLibraryRepository = new JsonSceneLibraryRepository();
export const sceneRepository: SceneRepository = new JsonSceneRepository();

export * from "./story-repository";
export * from "./json-story-repository";
export * from "./scene-repository";
export * from "./json-scene-repository";

