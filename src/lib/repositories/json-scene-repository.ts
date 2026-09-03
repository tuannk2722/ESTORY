// lib/repositories/json-scene-repository.ts
import fs from "fs/promises";
import path from "path";
import {
  BackgroundAsset,
  ColorPalette,
  ScenePreset,
  Scene,
} from "@/types/scene";
import { SceneLibraryRepository, SceneRepository } from "./scene-repository";

export class JsonSceneLibraryRepository implements SceneLibraryRepository {
  private getLibraryDirectory(): string {
    return path.join(process.cwd(), "content", "scene-library");
  }

  private async readJsonFile<T>(filename: string, fallback: T): Promise<T> {
    try {
      const filePath = path.join(this.getLibraryDirectory(), filename);
      const content = await fs.readFile(filePath, "utf-8");
      return JSON.parse(content) as T;
    } catch {
      return fallback;
    }
  }

  async getBackgrounds(): Promise<BackgroundAsset[]> {
    return this.readJsonFile<BackgroundAsset[]>("backgrounds.json", []);
  }

  async getPalettes(): Promise<ColorPalette[]> {
    return this.readJsonFile<ColorPalette[]>("palettes.json", []);
  }

  async getScenePresets(): Promise<ScenePreset[]> {
    return this.readJsonFile<ScenePreset[]>("scene-presets.json", []);
  }
}

export class JsonSceneRepository implements SceneRepository {
  private mutationQueue: Promise<void> = Promise.resolve();

  private getStoragePath(): string {
    return path.join(process.cwd(), "content", "scenes", "scenes.json");
  }

  private async readAllScenes(): Promise<Scene[]> {
    try {
      const filePath = this.getStoragePath();
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      const content = await fs.readFile(filePath, "utf-8");
      return JSON.parse(content) as Scene[];
    } catch {
      return [];
    }
  }

  private async writeAllScenes(scenes: Scene[]): Promise<void> {
    const filePath = this.getStoragePath();
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    const temporaryPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
    try {
      await fs.writeFile(temporaryPath, JSON.stringify(scenes, null, 2), "utf-8");
      await fs.rename(temporaryPath, filePath);
    } catch (error) {
      await fs.rm(temporaryPath, { force: true }).catch(() => undefined);
      throw error;
    }
  }

  private enqueueMutation(operation: () => Promise<void>): Promise<void> {
    const queued = this.mutationQueue.then(operation, operation);
    this.mutationQueue = queued.catch(() => undefined);
    return queued;
  }

  async getByChapterId(chapterId: string): Promise<Scene[]> {
    const allScenes = await this.readAllScenes();
    return allScenes.filter((s) => s.chapter_id === chapterId);
  }

  async save(scene: Scene): Promise<void> {
    return this.enqueueMutation(async () => {
      const allScenes = await this.readAllScenes();
      const existingIndex = allScenes.findIndex((s) => s.id === scene.id);

      if (existingIndex >= 0) {
        allScenes[existingIndex] = scene;
      } else {
        allScenes.push(scene);
      }

      await this.writeAllScenes(allScenes);
    });
  }

  async delete(sceneId: string): Promise<void> {
    return this.enqueueMutation(async () => {
      const allScenes = await this.readAllScenes();
      const filteredScenes = allScenes.filter((s) => s.id !== sceneId);
      await this.writeAllScenes(filteredScenes);
    });
  }

  async replaceChapterScenes(chapterId: string, scenes: Scene[]): Promise<void> {
    return this.enqueueMutation(async () => {
      const allScenes = await this.readAllScenes();
      const otherScenes = allScenes.filter((s) => s.chapter_id !== chapterId);
      const updatedScenes = [
        ...otherScenes,
        ...scenes.map((s) => ({ ...s, chapter_id: chapterId })),
      ];
      await this.writeAllScenes(updatedScenes);
    });
  }
}
