import type { Scene } from "@/types/scene";
import type { ChapterCommandContext } from "./story-command-service";

export interface ReplaceChapterScenesCommand extends ChapterCommandContext { scenes: Scene[] }
export interface SceneCommandService {
  replaceChapterScenes(input: ReplaceChapterScenesCommand): Promise<void>;
}
