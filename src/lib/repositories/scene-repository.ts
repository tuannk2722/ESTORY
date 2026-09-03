import { BackgroundAsset, ColorPalette, ScenePreset, Scene } from "@/types/scene";

export interface SceneLibraryRepository {
  getBackgrounds(): Promise<BackgroundAsset[]>;
  getPalettes(): Promise<ColorPalette[]>;
  getScenePresets(): Promise<ScenePreset[]>;
}

export interface SceneRepository {
  getByChapterId(chapterId: string): Promise<Scene[]>;
  save(scene: Scene): Promise<void>;
  delete(sceneId: string): Promise<void>;
  replaceChapterScenes(chapterId: string, scenes: Scene[]): Promise<void>;
}
