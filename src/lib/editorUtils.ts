// src/lib/editorUtils.ts
// Pure utility functions for Editor indexing, collision detection, and effect transformations
// Re-export compatibility bridge mapping to @/lib/scenes/* and @/lib/effects/*

import { EffectConfig } from "@/types/story";
import { LegacyScene as Scene } from "@/types/scene-legacy";
import { EFFECT_METADATA } from "@/lib/effects/effectCatalog";
import { findSceneOverlap } from "@/lib/scenes/sceneRange";

export {
  buildBlockIndexMap,
  findSceneOverlap,
  normalizeSceneRange,
  validateSceneRange,
  getBlocksInsideRange,
  updateScenesAfterBlockDelete,
  validateBlockMoveAgainstScenes,
} from "@/lib/scenes/sceneRange";

export {
  buildSceneByBlockId as buildBlockToSceneMap,
  buildSceneByBlockId,
  findSceneForBlock,
  findActiveScene,
  buildSceneRangeMap,
} from "@/lib/scenes/sceneSelectors";

/**
 * Legacy wrapper: Kiểm tra xem dải block [startBlockId, endBlockId] có bị chồng lấn với bất kỳ Scene nào đã có không
 */
export function checkSceneOverlap(
  startBlockId: string,
  endBlockId: string,
  scenes: Scene[],
  blockIndexMap: Map<string, number>,
  ignoreSceneId?: string
): boolean {
  return (
    findSceneOverlap(
      { start_block_id: startBlockId, end_block_id: endBlockId },
      scenes,
      blockIndexMap,
      ignoreSceneId
    ) !== null
  );
}

/**
 * Phân tách hiệu ứng audio và visual/motion từ mảng EffectConfig
 */
export function extractEffectsState(effects?: EffectConfig[]) {
  const audio = effects?.find((e) => e.type === "audio" || e.category === "audio");
  const nonAudioEffects: EffectConfig[] =
    effects
      ?.filter((e) => e.type !== "audio" && e.category !== "audio")
      .map((e, idx) => {
        const meta = EFFECT_METADATA[e.type];
        return {
          id: e.id || `fx-${e.type}-${Date.now()}-${idx}`,
          type: e.type,
          category: e.category || meta?.category || "visual",
          intensity: e.intensity ?? meta?.defaultIntensity ?? 0.75,
          duration_ms: e.duration_ms ?? meta?.defaultDurationMs ?? 0,
          delay_ms: e.delay_ms ?? 0,
          loop: e.loop ?? true,
        };
      }) || [];

  const firstEffect = effects?.[0];

  return {
    audioSrc: audio?.audio_src || "",
    volume: audio?.intensity ?? 0.5,
    effects: nonAudioEffects,
    loop: firstEffect?.loop ?? true,
  };
}
