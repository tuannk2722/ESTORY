// lib/repositories/index.ts
import { JsonStoryRepository } from "./json-story-repository";
import { StoryRepository } from "./story-repository";

export const storyRepository: StoryRepository = new JsonStoryRepository();

export * from "./story-repository";
export * from "./json-story-repository";
export * from "./scene-repository";
