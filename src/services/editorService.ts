// Domain service for validating and persisting the Editor Aggregate (Chapter + Scenes)

import { createHash } from "node:crypto";
import { Chapter, EffectConfig, EffectType, StoryBlock } from "@/types/story";
import { LegacyScene as Scene } from "@/types/scene-legacy";
import {
  sceneLibraryRepository,
  sceneRepository,
  storyRepository,
} from "@/lib/repositories";
import { EFFECT_MANIFEST } from "@/lib/effects/effect-manifest";
import {
  buildBlockIndexMap,
  findSceneOverlap,
  validateSceneRange,
} from "@/lib/scenes/sceneRange";

export interface EditorSnapshot {
  chapter: Chapter;
  scenes: Scene[];
  revision?: string;
}

export type SaveEditorSnapshotResult =
  | { success: true; message: string; revision: string }
  | { success: false; conflict?: false; errors: string[] }
  | { success: false; conflict: true; errors: string[]; revision: string };

const saveQueues = new Map<string, Promise<void>>();

function stableSerialize(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableSerialize).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableSerialize(record[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function createEditorRevision(chapter: Chapter, scenes: Scene[]): string {
  const canonicalScenes = [...scenes].sort((a, b) => a.id.localeCompare(b.id));
  return createHash("sha256")
    .update(stableSerialize({ chapter, scenes: canonicalScenes }))
    .digest("hex");
}

async function withSaveLock<T>(key: string, task: () => Promise<T>): Promise<T> {
  const previous = saveQueues.get(key) ?? Promise.resolve();
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const queued = previous.then(() => gate);
  saveQueues.set(key, queued);

  await previous;
  try {
    return await task();
  } finally {
    release();
    if (saveQueues.get(key) === queued) saveQueues.delete(key);
  }
}

export interface EditorValidationContext {
  backgroundIds?: ReadonlySet<string>;
  paletteIds?: ReadonlySet<string>;
  presetIds?: ReadonlySet<string>;
}

export type EditorValidationResult =
  | { valid: true }
  | { valid: false; errors: string[] };

const BLOCK_TYPES = new Set(["paragraph", "dialogue", "heading"]);

function validateEffects(
  owner: string,
  effects: EffectConfig[] | undefined,
  errors: string[]
) {
  if (effects === undefined) return;
  if (!Array.isArray(effects)) {
    errors.push(`${owner} có danh sách hiệu ứng không hợp lệ.`);
    return;
  }

  const effectIds = new Set<string>();
  effects.forEach((effect, index) => {
    const label = `${owner}, hiệu ứng #${index + 1}`;
    if (!effect || typeof effect !== "object") {
      errors.push(`${label} không hợp lệ.`);
      return;
    }
    if (!effect.id || effectIds.has(effect.id)) {
      errors.push(`${label} thiếu ID hoặc trùng ID.`);
    } else {
      effectIds.add(effect.id);
    }

    const metadata = EFFECT_MANIFEST[effect.type as EffectType];
    if (!metadata) {
      errors.push(`${label} có loại không được hỗ trợ.`);
    } else if (effect.category !== metadata.category) {
      errors.push(`${label} có category không khớp với loại ${effect.type}.`);
    }
    if (!Number.isFinite(effect.intensity) || effect.intensity < 0 || effect.intensity > 1) {
      errors.push(`${label} phải có intensity trong khoảng 0–1.`);
    }
    if (!Number.isFinite(effect.duration_ms) || effect.duration_ms < 0) {
      errors.push(`${label} phải có duration_ms không âm.`);
    }
    if (effect.delay_ms !== undefined && (!Number.isFinite(effect.delay_ms) || effect.delay_ms < 0)) {
      errors.push(`${label} phải có delay_ms không âm.`);
    }
    if (effect.category === "audio" && !effect.audio_src?.trim()) {
      errors.push(`${label} âm thanh phải có audio_src.`);
    }
  });
}

/** Validate the complete Chapter + Scene aggregate at the server boundary. */
export function validateEditorSnapshot(
  chapterId: string,
  snapshot: EditorSnapshot,
  context: EditorValidationContext = {}
): EditorValidationResult {
  const errors: string[] = [];

  if (!snapshot?.chapter || snapshot.chapter.id !== chapterId) {
    errors.push("Chapter ID không hợp lệ hoặc không khớp.");
  }

  const blocks = Array.isArray(snapshot?.chapter?.blocks)
    ? snapshot.chapter.blocks
    : [];
  if (!Array.isArray(snapshot?.chapter?.blocks)) {
    errors.push("Danh sách block không hợp lệ.");
  } else if (blocks.length === 0) {
    errors.push("Chương truyện phải có tối thiểu 1 block.");
  }

  const blockIds = new Set<string>();
  const validBlocks: StoryBlock[] = [];
  blocks.forEach((block, index) => {
    if (!block || typeof block !== "object" || !block.id) {
      errors.push(`Block #${index + 1} không có ID hợp lệ.`);
      return;
    }
    if (blockIds.has(block.id)) {
      errors.push(`Trùng lặp Block ID: ${block.id}`);
    } else {
      blockIds.add(block.id);
      validBlocks.push(block);
    }
    if (!BLOCK_TYPES.has(block.type)) {
      errors.push(`Block #${block.id} có loại không hợp lệ.`);
    }
    if (typeof block.text !== "string") {
      errors.push(`Block #${block.id} phải có nội dung dạng chuỗi.`);
    }
    validateEffects(`Block #${block.id}`, block.effects, errors);
  });

  const scenes = Array.isArray(snapshot?.scenes) ? snapshot.scenes : [];
  if (!Array.isArray(snapshot?.scenes)) {
    errors.push("Danh sách Scene không hợp lệ.");
  }
  const sceneIds = new Set<string>();
  const blockIndexMap = buildBlockIndexMap(validBlocks);

  scenes.forEach((scene, index) => {
    if (!scene || typeof scene !== "object" || !scene.id) {
      errors.push(`Scene #${index + 1} không có ID hợp lệ.`);
      return;
    }
    if (sceneIds.has(scene.id)) {
      errors.push(`Trùng lặp Scene ID: ${scene.id}`);
    } else {
      sceneIds.add(scene.id);
    }
    if (scene.chapter_id !== chapterId) {
      errors.push(`Scene #${scene.id} không thuộc chapter ${chapterId}.`);
    }

    const range = validateSceneRange(scene, blockIndexMap, validBlocks.length);
    if (!range.valid) {
      errors.push(`Scene #${scene.id} có dải không hợp lệ: ${range.reason}`);
    }

    const overlap = findSceneOverlap(scene, scenes.slice(index + 1), blockIndexMap);
    if (overlap) {
      errors.push(`Scene #${scene.id} bị chồng lấn với Scene #${overlap.id}.`);
    }
    if (context.backgroundIds && !context.backgroundIds.has(scene.background_id)) {
      errors.push(`Scene #${scene.id} tham chiếu background không tồn tại.`);
    }
    if (context.paletteIds && !context.paletteIds.has(scene.palette_id)) {
      errors.push(`Scene #${scene.id} tham chiếu palette không tồn tại.`);
    }
    if (
      scene.based_on_preset_id &&
      context.presetIds &&
      !context.presetIds.has(scene.based_on_preset_id)
    ) {
      errors.push(`Scene #${scene.id} tham chiếu preset không tồn tại.`);
    }
    validateEffects(`Scene #${scene.id}`, scene.effects, errors);
  });

  return errors.length === 0 ? { valid: true } : { valid: false, errors };
}

/**
 * Persist the aggregate using atomic per-file writes and compensating rollback
 * when the second repository update fails.
 */
export async function saveEditorSnapshot(
  storyId: string,
  chapterId: string,
  snapshot: EditorSnapshot
): Promise<SaveEditorSnapshotResult> {
  return withSaveLock(`${storyId}:${chapterId}`, async () => {
  const [story, existingScenes, backgrounds, palettes, presets] = await Promise.all([
    storyRepository.getById(storyId),
    sceneRepository.getLegacyByChapter(storyId, chapterId),
    sceneLibraryRepository.getBackgrounds(),
    sceneLibraryRepository.getPalettes(),
    sceneLibraryRepository.getScenePresets(),
  ]);

  if (!story || story.id !== storyId) {
    return { success: false, errors: ["Không tìm thấy tác phẩm."] };
  }
  if (!story.chapters.some((chapter) => chapter.id === chapterId)) {
    return { success: false, errors: ["Không tìm thấy chương truyện trong tác phẩm."] };
  }

  const currentChapter = story.chapters.find(
    (chapter) => chapter.id === chapterId
  )!;
  const currentRevision = createEditorRevision(currentChapter, existingScenes);
  if (!snapshot.revision || snapshot.revision !== currentRevision) {
    return {
      success: false,
      conflict: true,
      revision: currentRevision,
      errors: [
        "Nội dung chương đã thay đổi ở một phiên khác. Hãy tải lại trang trước khi lưu tiếp.",
      ],
    };
  }

  const validation = validateEditorSnapshot(chapterId, snapshot, {
    backgroundIds: new Set(backgrounds.map((item) => item.id)),
    paletteIds: new Set(palettes.map((item) => item.id)),
    presetIds: new Set(presets.map((item) => item.id)),
  });
  if (!validation.valid) {
    return { success: false, errors: validation.errors };
  }

  const updatedStory = {
    ...story,
    chapters: story.chapters.map((chapter) =>
      chapter.id === chapterId ? snapshot.chapter : chapter
    ),
  };

  await storyRepository.save(updatedStory);
  try {
    await sceneRepository.replaceLegacyChapterScenes(storyId, chapterId, snapshot.scenes);
  } catch (error) {
    try {
      // Scene membership/ranges are checked against persisted chapter blocks.
      // Restore those blocks before restoring the old scene ranges.
      await storyRepository.save(story);
      await sceneRepository.replaceLegacyChapterScenes(storyId, chapterId, existingScenes);
    } catch (rollbackError) {
      console.error("Editor aggregate rollback was incomplete", rollbackError);
    }
    throw error;
  }

  return {
    success: true,
    revision: createEditorRevision(snapshot.chapter, snapshot.scenes),
    message: "Lưu chương truyện và bối cảnh thành công!",
  };
  });
}
