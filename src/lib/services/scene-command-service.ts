import type { Scene } from "@/types/scene";
import type { ChapterCommandContext, CommandResult } from "./story-command-service";
import type { Chapter } from "@/types/story";

export interface ReplaceChapterScenesCommand extends ChapterCommandContext { scenes: Scene[] }
export interface SceneCommandService {
  replaceChapterScenes(input: ReplaceChapterScenesCommand): Promise<CommandResult<Scene[]>>;
}

export interface EditorData { chapter: Chapter; scenes: Scene[] }
export interface ReplaceEditorCommand extends ReplaceChapterScenesCommand { blocks: Chapter["blocks"] }
export interface EditorCommandService {
  replaceEditor(input: ReplaceEditorCommand): Promise<CommandResult<EditorData>>;
}
