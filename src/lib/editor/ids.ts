// src/lib/editor/ids.ts
// Centralized ID generation for Blocks, Scenes, and Effects in the Story Editor

/**
 * Sinh unique ID cho Block trong Chapter
 * Format: `${chapterId}-block-${uuid.slice(0, 8)}` hoặc `block-${uuid.slice(0, 8)}`
 */
export function createBlockId(chapterId?: string): string {
  const shortId =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return chapterId ? `${chapterId}-block-${shortId}` : `block-${shortId}`;
}

/**
 * Sinh unique ID cho Scene
 * Format: `scene-${uuid}`
 */
export function createSceneId(): string {
  const uuid =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return `scene-${uuid}`;
}

/**
 * Sinh unique ID cho Effect
 * Format: `fx-${type}-${uuid.slice(0, 8)}`
 */
export function createEffectId(type: string = "effect"): string {
  const shortId =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `fx-${type}-${shortId}`;
}
