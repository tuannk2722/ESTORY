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
    await fs.writeFile(filePath, JSON.stringify(scenes, null, 2), "utf-8");
  }

  async getByChapterId(chapterId: string): Promise<Scene[]> {
    const allScenes = await this.readAllScenes();
    return allScenes.filter((s) => s.chapter_id === chapterId);
  }

  async save(scene: Scene): Promise<void> {
    const allScenes = await this.readAllScenes();
    const existingIndex = allScenes.findIndex((s) => s.id === scene.id);

    if (existingIndex >= 0) {
      allScenes[existingIndex] = scene;
    } else {
      allScenes.push(scene);
    }

    await this.writeAllScenes(allScenes);
  }

  async delete(sceneId: string): Promise<void> {
    const allScenes = await this.readAllScenes();
    const filteredScenes = allScenes.filter((s) => s.id !== sceneId);
    await this.writeAllScenes(filteredScenes);
  }
}
