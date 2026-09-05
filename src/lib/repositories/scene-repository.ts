import type { BackgroundAsset, ColorPalette, ScenePreset, Scene } from '@/types/scene';
import type { LegacyBackgroundAsset, LegacyColorPalette, LegacyScenePreset, LegacyScene } from '@/types/scene-legacy';

export interface SceneLibraryRepository {
  getActiveGlobalBackgrounds(): Promise<BackgroundAsset[]>;
  getActivePalettes(): Promise<ColorPalette[]>;
  getActiveScenePresets(): Promise<ScenePreset[]>;
}
export interface SceneRepository {
  getByChapter(storyId: string, chapterId: string): Promise<Scene[]>;
}

/** Temporary JSON editor contracts; retired at the controlled cutover. */
export interface LegacySceneLibraryRepository {
  getBackgrounds(): Promise<LegacyBackgroundAsset[]>;
  getPalettes(): Promise<LegacyColorPalette[]>;
  getScenePresets(): Promise<LegacyScenePreset[]>;
}
export interface LegacySceneRepository {
  getLegacyByChapter(storyId: string, chapterId: string): Promise<LegacyScene[]>;
  replaceLegacyChapterScenes(storyId: string, chapterId: string, scenes: LegacyScene[]): Promise<void>;
}
