import fs from 'node:fs/promises';
import path from 'node:path';
import type { BackgroundAsset, ColorPalette, ScenePreset, Scene } from '@/types/scene';
import type { Chapter } from '@/types/story';
import type { LegacyBackgroundAsset, LegacyColorPalette, LegacyScenePreset, LegacyScene } from '@/types/scene-legacy';
import type { StoryRepository } from './story-repository';
import type { SceneLibraryRepository, SceneRepository, LegacySceneLibraryRepository, LegacySceneRepository } from './scene-repository';
import { legacyPresetToRenderConfig, resolveBackgroundAsset, resolveLegacyScene, resolvePalette } from '@/lib/scenes/scene-mappers';
import { parseScene, parseSceneRenderConfig } from '@/lib/scenes/scene-render-config';
import { validateSceneRange, buildBlockIndexMap } from '@/lib/scenes/sceneRange';

export class JsonSceneLibraryRepository implements SceneLibraryRepository, LegacySceneLibraryRepository {
  constructor(private readonly rootDirectory = process.cwd()) {}

  private async readJsonFile<T>(filename: string): Promise<T[]> {
    try {
      const contents = await fs.readFile(path.join(this.rootDirectory, 'content', 'scene-library', filename), 'utf8');
      const parsed: unknown = JSON.parse(contents);
      if (!Array.isArray(parsed)) throw new Error('Scene catalog must be an array');
      return parsed as T[];
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw error;
    }
  }
  // Legacy consumers remain on the original catalog shape until read cutover.
  getBackgrounds() { return this.readJsonFile<LegacyBackgroundAsset>('backgrounds.json'); }
  getPalettes() { return this.readJsonFile<LegacyColorPalette>('palettes.json'); }
  getScenePresets() { return this.readJsonFile<LegacyScenePreset>('scene-presets.json'); }

  async getActiveGlobalBackgrounds(): Promise<BackgroundAsset[]> {
    const entries = await this.readJsonFile<BackgroundAsset | LegacyBackgroundAsset>('backgrounds.json');
    return entries.filter(item => 'render' in item
      ? item.scope === 'global' && item.status === 'active'
      : (item.scope ?? 'global') === 'global').map(resolveBackgroundAsset);
  }
  async getActivePalettes(): Promise<ColorPalette[]> {
    const entries = await this.readJsonFile<ColorPalette | LegacyColorPalette>('palettes.json');
    return entries.filter(item => typeof item.colors.background_tint === 'string' || ('status' in item && item.status === 'active')).map(resolvePalette);
  }
  async getActiveScenePresets(): Promise<ScenePreset[]> {
    const entries = await this.readJsonFile<ScenePreset | LegacyScenePreset>('scene-presets.json');
    const active = entries.filter(item => !('render_config' in item) || item.status === 'active');
    // Curated snapshots never need a live ingredient catalog.
    const needsLegacy = active.some(item => !('render_config' in item));
    const [backgrounds, palettes] = needsLegacy ? await Promise.all([this.getBackgrounds(), this.getPalettes()]) : [[], []];
    return active.map(item => 'render_config' in item
      ? { ...structuredClone(item), render_config: parseSceneRenderConfig(item.render_config) }
      : { id: item.id, label: item.label, mood_tags: [...item.mood_tags], status: 'active', render_config: legacyPresetToRenderConfig(item, backgrounds.filter(asset => (asset.scope ?? 'global') === 'global'), palettes) });
  }
}

export class JsonSceneRepository implements SceneRepository, LegacySceneRepository {
  private mutationQueue: Promise<void> = Promise.resolve();
  constructor(
    private readonly stories: Pick<StoryRepository, 'getById' | 'getAll'>,
    private readonly library: LegacySceneLibraryRepository,
    private readonly rootDirectory = process.cwd(),
  ) {}

  private getStoragePath() { return path.join(this.rootDirectory, 'content', 'scenes', 'scenes.json'); }
  private async readAllScenes(): Promise<Array<LegacyScene | Scene>> {
    try {
      const parsed: unknown = JSON.parse(await fs.readFile(this.getStoragePath(), 'utf8'));
      if (!Array.isArray(parsed)) throw new Error('Scenes must be an array');
      return parsed as Array<LegacyScene | Scene>;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw error;
    }
  }
  private async chapterInStory(storyId: string, chapterId: string) {
    const story = await this.stories.getById(storyId);
    const chapter = story?.id === storyId ? story.chapters.find(item => item.id === chapterId) : undefined;
    if (!chapter) return null;
    // Legacy rows have no story ID: ambiguous chapter IDs must fail instead of leaking another story.
    const owners = (await this.stories.getAll()).filter(item => item.chapters.some(candidate => candidate.id === chapterId));
    if (owners.length !== 1 || owners[0].id !== storyId) throw new Error('Ambiguous legacy chapter ID');
    return chapter;
  }
  private validateRanges(scenes: Array<LegacyScene | Scene>, chapter: Chapter) {
    const indexes = buildBlockIndexMap(chapter.blocks);
    const ids = new Set<string>();
    const ranges = scenes.map(scene => {
      if (scene.chapter_id !== chapter.id || ids.has(scene.id)) throw new Error('Invalid scene membership or duplicate ID');
      ids.add(scene.id);
      const range = validateSceneRange(scene, indexes, chapter.blocks.length);
      if (!range.valid) throw new Error('Invalid scene block range');
      return range;
    }).sort((a, b) => a.startIndex - b.startIndex);
    if (ranges.some((range, index) => index > 0 && range.startIndex <= ranges[index - 1].endIndex)) throw new Error('Overlapping scene ranges');
  }
  async getByChapter(storyId: string, chapterId: string): Promise<Scene[]> {
    const chapter = await this.chapterInStory(storyId, chapterId);
    if (!chapter) return [];
    const rows = (await this.readAllScenes()).filter(scene => scene.chapter_id === chapterId);
    const needsLegacy = rows.some(scene => !('render_config' in scene));
    const [backgrounds, palettes] = needsLegacy ? await Promise.all([this.library.getBackgrounds(), this.library.getPalettes()]) : [[], []];
    const scenes = rows.map(scene => 'render_config' in scene ? parseScene(scene) : resolveLegacyScene(scene, backgrounds, palettes));
    this.validateRanges(scenes, chapter);
    return scenes;
  }
  async getLegacyByChapter(storyId: string, chapterId: string): Promise<LegacyScene[]> {
    if (!await this.chapterInStory(storyId, chapterId)) return [];
    const rows = (await this.readAllScenes()).filter(scene => scene.chapter_id === chapterId);
    if (rows.some(scene => 'render_config' in scene)) throw new Error('Snapshot data requires the snapshot reader; legacy editor cannot overwrite it');
    return rows as LegacyScene[];
  }
  async replaceLegacyChapterScenes(storyId: string, chapterId: string, scenes: LegacyScene[]): Promise<void> {
    const operation = async () => {
      const chapter = await this.chapterInStory(storyId, chapterId);
      if (!chapter) throw new Error('Chapter does not belong to story');
      this.validateRanges(scenes, chapter);
      const all = await this.readAllScenes();
      if (all.some(scene => scene.chapter_id === chapterId && 'render_config' in scene)) throw new Error('Legacy writes cannot replace snapshots');
      const other = all.filter(scene => scene.chapter_id !== chapterId);
      if (scenes.some(scene => other.some(item => item.id === scene.id))) throw new Error('Scene ID belongs to another chapter');
      const filePath = this.getStoragePath();
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      const temporaryPath = filePath + '.' + process.pid + '.' + Date.now() + '.tmp';
      try {
        await fs.writeFile(temporaryPath, JSON.stringify([...other, ...scenes], null, 2), 'utf8');
        await fs.rename(temporaryPath, filePath);
      } catch (error) {
        await fs.rm(temporaryPath, { force: true }).catch(() => undefined);
        throw error;
      }
    };
    const queued = this.mutationQueue.then(operation, operation);
    this.mutationQueue = queued.catch(() => undefined);
    return queued;
  }
}
