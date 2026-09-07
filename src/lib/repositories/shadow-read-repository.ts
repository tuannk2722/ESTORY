import type { Story } from "@/types/story";
import type {
  BackgroundAsset,
  ColorPalette,
  Scene,
  ScenePreset,
} from "@/types/scene";
import type {
  PublicChapterReaderData,
  StoryRepository,
} from "./story-repository";
import type {
  SceneLibraryRepository,
  SceneRepository,
} from "./scene-repository";
import {
  consoleRepositoryReadObserver,
  type RepositoryReadObserver,
} from "./read-observability";

function normalized(value: unknown, root = true): unknown {
  if (Array.isArray(value)) {
    const items = value.map((item) => normalized(item, false));
    const effectCollection = items.every(
      (item) => item && typeof item === "object"
        && "id" in item && "duration_ms" in item,
    );
    const rootEntities = root && items.every(
      (item) => item && typeof item === "object" && "id" in item,
    );
    if (effectCollection || rootEntities) {
      return [...items].sort((left, right) => {
        const leftId = String((left as { id: unknown }).id);
        const rightId = String((right as { id: unknown }).id);
        return leftId.localeCompare(rightId);
      });
    }
    return items;
  }
  if (!value || typeof value !== "object") return value;
  const result: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value).sort(([left], [right]) => left.localeCompare(right))) {
    if (key === "activated_at") continue;
    if (key === "loop" && entry === false) continue;
    if (entry !== undefined) result[key] = normalized(entry, false);
  }
  return result;
}

export function normalizeShadowRead(value: unknown): unknown {
  return normalized(value);
}

export function countShadowDifferences(left: unknown, right: unknown): number {
  if (Object.is(left, right)) return 0;
  if (Array.isArray(left) && Array.isArray(right)) {
    let count = Math.abs(left.length - right.length);
    const length = Math.min(left.length, right.length);
    for (let index = 0; index < length; index += 1) {
      count += countShadowDifferences(left[index], right[index]);
    }
    return count;
  }
  if (left && right && typeof left === "object" && typeof right === "object") {
    const leftRecord = left as Record<string, unknown>;
    const rightRecord = right as Record<string, unknown>;
    const keys = new Set([...Object.keys(leftRecord), ...Object.keys(rightRecord)]);
    let count = 0;
    for (const key of keys) {
      if (!(key in leftRecord) || !(key in rightRecord)) count += 1;
      else count += countShadowDifferences(leftRecord[key], rightRecord[key]);
    }
    return count;
  }
  return 1;
}

class ShadowReader {
  constructor(private readonly observer: RepositoryReadObserver) {}

  async compare<T>(
    code: string,
    primaryRead: () => Promise<T>,
    shadowRead: () => Promise<T>,
  ): Promise<T> {
    const primary = await primaryRead();
    try {
      const shadow = await shadowRead();
      const count = countShadowDifferences(
        normalizeShadowRead(primary),
        normalizeShadowRead(shadow),
      );
      if (count > 0) {
        this.observer.report({ level: "warn", code, count });
      }
    } catch {
      this.observer.report({ level: "error", code: `${code}_ERROR`, count: 1 });
    }
    return primary;
  }
}

export class ShadowStoryRepository implements StoryRepository {
  private readonly shadow: ShadowReader;

  constructor(
    private readonly primary: StoryRepository,
    private readonly secondary: StoryRepository,
    observer: RepositoryReadObserver = consoleRepositoryReadObserver,
  ) {
    this.shadow = new ShadowReader(observer);
  }

  getAll(): Promise<Story[]> {
    return this.shadow.compare(
      "P3_SHADOW_STORY_GET_ALL_MISMATCH",
      () => this.primary.getAll(),
      () => this.secondary.getAll(),
    );
  }

  getAllPublic(): Promise<Story[]> {
    return this.shadow.compare(
      "P3_SHADOW_STORY_GET_ALL_PUBLIC_MISMATCH",
      () => this.primary.getAllPublic(),
      () => this.secondary.getAllPublic(),
    );
  }

  getById(id: string): Promise<Story | null> {
    return this.shadow.compare(
      "P3_SHADOW_STORY_GET_BY_ID_MISMATCH",
      () => this.primary.getById(id),
      () => this.secondary.getById(id),
    );
  }

  getPublicById(id: string): Promise<Story | null> {
    return this.shadow.compare(
      "P3_SHADOW_STORY_GET_PUBLIC_BY_ID_MISMATCH",
      () => this.primary.getPublicById(id),
      () => this.secondary.getPublicById(id),
    );
  }

  getPublicChapter(
    storyId: string,
    chapterId: string,
  ): Promise<PublicChapterReaderData | null> {
    return this.shadow.compare(
      "P3_SHADOW_STORY_GET_PUBLIC_CHAPTER_MISMATCH",
      () => this.primary.getPublicChapter(storyId, chapterId),
      () => this.secondary.getPublicChapter(storyId, chapterId),
    );
  }

  // JSON has no authenticated ownership. Do not execute a misleading shadow query.
  getAllForAuthor(authorId: string): Promise<Story[]> {
    return this.primary.getAllForAuthor(authorId);
  }

  save(story: Story): Promise<void> {
    return this.primary.save(story);
  }
}

export class ShadowSceneRepository implements SceneRepository {
  private readonly shadow: ShadowReader;

  constructor(
    private readonly primary: SceneRepository,
    private readonly secondary: SceneRepository,
    observer: RepositoryReadObserver = consoleRepositoryReadObserver,
  ) {
    this.shadow = new ShadowReader(observer);
  }

  getByChapter(storyId: string, chapterId: string): Promise<Scene[]> {
    return this.shadow.compare(
      "P3_SHADOW_SCENE_GET_BY_CHAPTER_MISMATCH",
      () => this.primary.getByChapter(storyId, chapterId),
      () => this.secondary.getByChapter(storyId, chapterId),
    );
  }
}

export class ShadowSceneLibraryRepository implements SceneLibraryRepository {
  private readonly shadow: ShadowReader;

  constructor(
    private readonly primary: SceneLibraryRepository,
    private readonly secondary: SceneLibraryRepository,
    observer: RepositoryReadObserver = consoleRepositoryReadObserver,
  ) {
    this.shadow = new ShadowReader(observer);
  }

  getActiveGlobalBackgrounds(): Promise<BackgroundAsset[]> {
    return this.shadow.compare(
      "P3_SHADOW_BACKGROUND_CATALOG_MISMATCH",
      () => this.primary.getActiveGlobalBackgrounds(),
      () => this.secondary.getActiveGlobalBackgrounds(),
    );
  }

  getActivePalettes(): Promise<ColorPalette[]> {
    return this.shadow.compare(
      "P3_SHADOW_PALETTE_CATALOG_MISMATCH",
      () => this.primary.getActivePalettes(),
      () => this.secondary.getActivePalettes(),
    );
  }

  getActiveScenePresets(): Promise<ScenePreset[]> {
    return this.shadow.compare(
      "P3_SHADOW_PRESET_CATALOG_MISMATCH",
      () => this.primary.getActiveScenePresets(),
      () => this.secondary.getActiveScenePresets(),
    );
  }
}
