// src/lib/scenes/sceneSelectors.ts
// O(1) selectors and lookup map builders for Scenes and Blocks

import { StoryBlock } from "@/types/story";
import { Scene } from "@/types/scene";
import { findSceneOverlap, validateSceneRange } from "./sceneRange";

export interface SceneBlockInfo {
  scene: Scene;
  index: number;
}

export interface SceneRangeInfo {
  startIndex: number;
  endIndex: number;
  length: number;
}

export type SceneRangeStatus =
  | ({ valid: true } & SceneRangeInfo)
  | {
      valid: false;
      error: "INVALID_BOUNDARY" | "REVERSED_BOUNDARY" | "OVERLAP";
    };

/**
 * Xây dựng Map tra cứu O(1) từ blockId -> { scene, index }
 */
export function buildSceneByBlockId(
  blocks: StoryBlock[],
  scenes: Scene[],
  blockIndexMap: Map<string, number>
): Map<string, SceneBlockInfo> {
  const map = new Map<string, SceneBlockInfo>();

  scenes.forEach((scene, sIdx) => {
    const startIdx = blockIndexMap.get(scene.start_block_id);
    const endIdx = blockIndexMap.get(scene.end_block_id);

    if (startIdx !== undefined && endIdx !== undefined) {
      const minIdx = Math.min(startIdx, endIdx);
      const maxIdx = Math.max(startIdx, endIdx);
      for (let i = minIdx; i <= maxIdx; i++) {
        const block = blocks[i];
        if (block) {
          map.set(block.id, { scene, index: sIdx });
        }
      }
    }
  });

  return map;
}

/**
 * Tìm Scene gắn với một block cụ thể trong O(1)
 */
export function findSceneForBlock(
  blockId: string,
  blockToSceneMap: Map<string, SceneBlockInfo>
): Scene | undefined {
  return blockToSceneMap.get(blockId)?.scene;
}

/**
 * Tìm Scene đang active dựa trên blockId đang chọn
 */
export function findActiveScene(
  activeBlockId: string | null,
  blockToSceneMap: Map<string, SceneBlockInfo>
): Scene | null {
  if (!activeBlockId) return null;
  return blockToSceneMap.get(activeBlockId)?.scene || null;
}

/**
 * Xây dựng Map tra cứu phạm vi vị trí (startIndex, endIndex, length) của từng Scene theo ID
 */
export function buildSceneRangeMap(
  scenes: Scene[],
  blockIndexMap: Map<string, number>
): Map<string, SceneRangeInfo> {
  const map = new Map<string, SceneRangeInfo>();

  scenes.forEach((scene) => {
    const startIdx = blockIndexMap.get(scene.start_block_id);
    const endIdx = blockIndexMap.get(scene.end_block_id);

    if (startIdx !== undefined && endIdx !== undefined) {
      const minIdx = Math.min(startIdx, endIdx);
      const maxIdx = Math.max(startIdx, endIdx);
      map.set(scene.id, {
        startIndex: minIdx,
        endIndex: maxIdx,
        length: maxIdx - minIdx + 1,
      });
    }
  });

  return map;
}

export function buildSceneRangeStatusMap(
  scenes: Scene[],
  blockIndexMap: Map<string, number>,
  blocksLength: number
): Map<string, SceneRangeStatus> {
  const map = new Map<string, SceneRangeStatus>();

  for (const scene of scenes) {
    const validation = validateSceneRange(scene, blockIndexMap, blocksLength);
    if (!validation.valid) {
      map.set(scene.id, {
        valid: false,
        error:
          validation.reason === "START_AFTER_END"
            ? "REVERSED_BOUNDARY"
            : "INVALID_BOUNDARY",
      });
      continue;
    }

    const overlap = findSceneOverlap(
      scene,
      scenes,
      blockIndexMap,
      scene.id
    );
    if (overlap) {
      map.set(scene.id, { valid: false, error: "OVERLAP" });
      continue;
    }

    map.set(scene.id, {
      valid: true,
      startIndex: validation.startIndex,
      endIndex: validation.endIndex,
      length: validation.endIndex - validation.startIndex + 1,
    });
  }

  return map;
}
