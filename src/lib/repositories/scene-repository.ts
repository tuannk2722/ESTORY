// lib/repositories/scene-repository.ts
import { BackgroundAsset, ColorPalette, LayoutPreset, ScenePreset, Scene } from "@/types/scene";

export interface SceneLibraryRepository {
  getBackgrounds(): Promise<BackgroundAsset[]>;
  getPalettes(): Promise<ColorPalette[]>;
  getLayouts(): Promise<LayoutPreset[]>;
  getScenePresets(): Promise<ScenePreset[]>;
}

export interface SceneRepository {
  getByChapterId(chapterId: string): Promise<Scene[]>;
  save(scene: Scene): Promise<void>;
  delete(sceneId: string): Promise<void>;
}
