// src/lib/scenes/sceneRange.ts
// Pure domain algorithms for Scene Range normalization, validation, collision detection, and reconciliation

import { StoryBlock } from "@/types/story";
import { Scene } from "@/types/scene";

export type SceneRangeValidation =
  | {
      valid: true;
      startIndex: number;
      endIndex: number;
    }
  | {
      valid: false;
      reason:
        | "START_NOT_FOUND"
        | "END_NOT_FOUND"
        | "START_AFTER_END"
        | "OUT_OF_BOUNDS"
        | "EMPTY_RANGE";
    };

export type BlockMoveValidationResult =
  | {
      type: "allowed";
      recomputedScenes: Scene[];
    }
  | {
      type: "membership_change";
      action: "leave" | "join" | "transfer";
      sourceScene?: Scene;
      targetScene?: Scene;
      message: string;
      recomputedScenes: Scene[];
    }
  | {
      type: "invalid";
      reason: string;
    };

export type PendingSceneRangeResult =
  | {
      valid: true;
      startBlockId: string;
      endBlockId: string;
      startIndex: number;
      endIndex: number;
    }
  | {
      valid: false;
      reason: "MISSING_START" | "BOUNDARY_NOT_FOUND" | "OVERLAP";
      overlappingScene?: Scene;
    };

/**
 * Xây dựng Map tra cứu chỉ số index của block theo ID trong O(1)
 */
export function buildBlockIndexMap(blocks: StoryBlock[]): Map<string, number> {
  const map = new Map<string, number>();
  for (let i = 0; i < blocks.length; i++) {
    map.set(blocks[i].id, i);
  }
  return map;
}

/**
 * Chuẩn hóa dải block (đảm bảo start đứng trước end theo thứ tự block hiện tại)
 */
export function normalizeSceneRange(
  startId: string,
  endId: string,
  blockIndexMap: Map<string, number>
): {
  startId: string;
  endId: string;
  startIndex: number;
  endIndex: number;
} | null {
  const sIdx = blockIndexMap.get(startId);
  const eIdx = blockIndexMap.get(endId);

  if (sIdx === undefined || eIdx === undefined) {
    return null;
  }

  const startIndex = Math.min(sIdx, eIdx);
  const endIndex = Math.max(sIdx, eIdx);

  // Tìm block ID tương ứng với startIndex và endIndex
  // Nếu sIdx <= eIdx thì giữ nguyên (startId, endId), nếu ngược lại thì đảo lại
  const finalStartId = sIdx <= eIdx ? startId : endId;
  const finalEndId = sIdx <= eIdx ? endId : startId;

  return {
    startId: finalStartId,
    endId: finalEndId,
    startIndex,
    endIndex,
  };
}

/**
 * Validate dải Scene đối chiếu với thứ tự blocks hiện tại
 */
export function validateSceneRange(
  scene: { start_block_id: string; end_block_id: string },
  blockIndexMap: Map<string, number>,
  blocksLength: number
): SceneRangeValidation {
  if (blocksLength === 0) {
    return { valid: false, reason: "EMPTY_RANGE" };
  }

  const sIdx = blockIndexMap.get(scene.start_block_id);
  const eIdx = blockIndexMap.get(scene.end_block_id);

  if (sIdx === undefined) {
    return { valid: false, reason: "START_NOT_FOUND" };
  }
  if (eIdx === undefined) {
    return { valid: false, reason: "END_NOT_FOUND" };
  }

  if (sIdx < 0 || sIdx >= blocksLength || eIdx < 0 || eIdx >= blocksLength) {
    return { valid: false, reason: "OUT_OF_BOUNDS" };
  }

  if (sIdx > eIdx) {
    return { valid: false, reason: "START_AFTER_END" };
  }

  return {
    valid: true,
    startIndex: sIdx,
    endIndex: eIdx,
  };
}

/**
 * Kiểm tra xem dải block có bị chồng lấn (overlap) với bất kỳ Scene nào khác không
 * Trả về Scene bị chồng lấn đầu tiên (hoặc null nếu không bị chồng lấn)
 */
export function findSceneOverlap(
  range: { start_block_id: string; end_block_id: string; id?: string },
  scenes: Scene[],
  blockIndexMap: Map<string, number>,
  ignoreSceneId?: string
): Scene | null {
  const norm = normalizeSceneRange(
    range.start_block_id,
    range.end_block_id,
    blockIndexMap
  );
  if (!norm) return null;

  const { startIndex, endIndex } = norm;

  for (const scene of scenes) {
    // Bỏ qua chính nó (khi đang sửa Scene)
    if (
      (ignoreSceneId && scene.id === ignoreSceneId) ||
      (range.id && scene.id === range.id)
    ) {
      continue;
    }

    const sceneNorm = normalizeSceneRange(
      scene.start_block_id,
      scene.end_block_id,
      blockIndexMap
    );
    if (!sceneNorm) continue;

    // Thuật toán giao thoa 2 đoạn [A1, A2] và [B1, B2]: max(A1, B1) <= min(A2, B2)
    if (
      Math.max(startIndex, sceneNorm.startIndex) <=
      Math.min(endIndex, sceneNorm.endIndex)
    ) {
      return scene;
    }
  }

  return null;
}

/**
 * Chuẩn bị dải Scene mới từ state chọn dải. UI chỉ hiển thị kết quả,
 * toàn bộ normalize/overlap rule được giữ tại domain layer này.
 */
export function preparePendingSceneRange(
  startBlockId: string | null,
  endBlockId: string | null,
  blocks: StoryBlock[],
  scenes: Scene[]
): PendingSceneRangeResult {
  if (!startBlockId) {
    return { valid: false, reason: "MISSING_START" };
  }

  const blockIndexMap = buildBlockIndexMap(blocks);
  const normalized = normalizeSceneRange(
    startBlockId,
    endBlockId || startBlockId,
    blockIndexMap
  );

  if (!normalized) {
    return { valid: false, reason: "BOUNDARY_NOT_FOUND" };
  }

  const overlappingScene = findSceneOverlap(
    {
      start_block_id: normalized.startId,
      end_block_id: normalized.endId,
    },
    scenes,
    blockIndexMap
  );

  if (overlappingScene) {
    return {
      valid: false,
      reason: "OVERLAP",
      overlappingScene,
    };
  }

  return {
    valid: true,
    startBlockId: normalized.startId,
    endBlockId: normalized.endId,
    startIndex: normalized.startIndex,
    endIndex: normalized.endIndex,
  };
}

/**
 * Trích xuất danh sách StoryBlock nằm bên trong dải Scene
 */
export function getBlocksInsideRange(
  range: { start_block_id: string; end_block_id: string },
  blocks: StoryBlock[],
  blockIndexMap: Map<string, number>
): StoryBlock[] {
  const norm = normalizeSceneRange(
    range.start_block_id,
    range.end_block_id,
    blockIndexMap
  );
  if (!norm) return [];

  return blocks.slice(norm.startIndex, norm.endIndex + 1);
}

/**
 * Cập nhật lại các Scene sau khi xóa 1 block
 * Xử lý:
 * 1. Block bị xóa nằm bên trong Scene: giữ nguyên start và end.
 * 2. Block bị xóa là start_block_id: dịch start sang block liền sau.
 * 3. Block bị xóa là end_block_id: dịch end sang block liền trước.
 * 4. Block bị xóa là block DUY NHẤT trong Scene: đánh dấu Scene cần xóa.
 */
export function updateScenesAfterBlockDelete(
  deletedBlockId: string,
  scenes: Scene[],
  currentBlocks: StoryBlock[]
): {
  updatedScenes: Scene[];
  deletedSceneIds: string[];
  affectedScenes: Scene[];
} {
  const deletedIndex = currentBlocks.findIndex((b) => b.id === deletedBlockId);
  if (deletedIndex === -1) {
    return {
      updatedScenes: scenes,
      deletedSceneIds: [],
      affectedScenes: [],
    };
  }

  const blockIndexMap = buildBlockIndexMap(currentBlocks);
  const updatedScenes: Scene[] = [];
  const deletedSceneIds: string[] = [];
  const affectedScenes: Scene[] = [];

  for (const scene of scenes) {
    const sIdx = blockIndexMap.get(scene.start_block_id);
    const eIdx = blockIndexMap.get(scene.end_block_id);

    if (sIdx === undefined || eIdx === undefined) {
      // Scene đã có boundary không hợp lệ từ trước -> xóa bỏ
      deletedSceneIds.push(scene.id);
      affectedScenes.push(scene);
      continue;
    }

    const minIdx = Math.min(sIdx, eIdx);
    const maxIdx = Math.max(sIdx, eIdx);

    // Trường hợp 1: Block bị xóa hoàn toàn không liên quan đến Scene này
    if (deletedIndex < minIdx || deletedIndex > maxIdx) {
      updatedScenes.push(scene);
      continue;
    }

    // Trường hợp 2: Block bị xóa là block duy nhất của Scene
    if (minIdx === maxIdx && minIdx === deletedIndex) {
      deletedSceneIds.push(scene.id);
      affectedScenes.push(scene);
      continue;
    }

    // Trường hợp 3: Scene có nhiều hơn 1 block
    affectedScenes.push(scene);

    if (deletedIndex === minIdx) {
      // Xóa block bắt đầu -> start mới là block tiếp theo trong dải
      const newStartBlock = currentBlocks[minIdx + 1];
      const endBlock = currentBlocks[maxIdx];
      if (newStartBlock && endBlock) {
        updatedScenes.push({
          ...scene,
          start_block_id: newStartBlock.id,
          end_block_id: endBlock.id,
        });
      } else {
        deletedSceneIds.push(scene.id);
      }
    } else if (deletedIndex === maxIdx) {
      // Xóa block kết thúc -> end mới là block liền trước trong dải
      const startBlock = currentBlocks[minIdx];
      const newEndBlock = currentBlocks[maxIdx - 1];
      if (startBlock && newEndBlock) {
        updatedScenes.push({
          ...scene,
          start_block_id: startBlock.id,
          end_block_id: newEndBlock.id,
        });
      } else {
        deletedSceneIds.push(scene.id);
      }
    } else {
      // Xóa block ở giữa dải -> start và end không đổi
      updatedScenes.push(scene);
    }
  }

  return {
    updatedScenes,
    deletedSceneIds,
    affectedScenes,
  };
}

/**
 * Validate và điều hòa Scene khi di chuyển / đổi chỗ 1 Block
 */
export function validateBlockMoveAgainstScenes(
  fromIndex: number,
  toIndex: number,
  blocks: StoryBlock[],
  scenes: Scene[]
): BlockMoveValidationResult {
  if (
    fromIndex < 0 ||
    fromIndex >= blocks.length ||
    toIndex < 0 ||
    toIndex >= blocks.length ||
    fromIndex === toIndex
  ) {
    return { type: "allowed", recomputedScenes: scenes };
  }

  const movingBlock = blocks[fromIndex];
  const oldIndexMap = buildBlockIndexMap(blocks);

  // Tạo mảng blocks giả lập sau khi di chuyển
  const nextBlocks = [...blocks];
  const [removed] = nextBlocks.splice(fromIndex, 1);
  nextBlocks.splice(toIndex, 0, removed);
  const nextIndexMap = buildBlockIndexMap(nextBlocks);

  // Tìm Scene chứa block trước khi di chuyển
  const sourceScene = scenes.find((s) => {
    const sIdx = oldIndexMap.get(s.start_block_id);
    const eIdx = oldIndexMap.get(s.end_block_id);
    if (sIdx === undefined || eIdx === undefined) return false;
    return fromIndex >= Math.min(sIdx, eIdx) && fromIndex <= Math.max(sIdx, eIdx);
  });

  // Tìm Scene chứa vị trí đích sau khi di chuyển
  const targetScene = scenes.find((s) => {
    const sIdx = oldIndexMap.get(s.start_block_id);
    const eIdx = oldIndexMap.get(s.end_block_id);
    if (sIdx === undefined || eIdx === undefined) return false;
    return toIndex >= Math.min(sIdx, eIdx) && toIndex <= Math.max(sIdx, eIdx);
  });

  // 1. Di chuyển trong cùng 1 Scene (hoặc cả 2 đều không thuộc Scene nào)
  if (sourceScene?.id === targetScene?.id) {
    // Điều hòa lại start/end nếu block di chuyển là boundary
    const recomputedScenes = scenes.map((scene) => {
      if (scene.id !== sourceScene?.id) return scene;
      // Thu thập tất cả blocks ban đầu của Scene này
      const originalBlocks = getBlocksInsideRange(scene, blocks, oldIndexMap);
      // Tìm index nhỏ nhất và lớn nhất của chúng trong nextBlocks
      const indices = originalBlocks
        .map((b) => nextIndexMap.get(b.id))
        .filter((idx): idx is number => idx !== undefined)
        .sort((a, b) => a - b);

      if (indices.length === 0) return scene;

      return {
        ...scene,
        start_block_id: nextBlocks[indices[0]].id,
        end_block_id: nextBlocks[indices[indices.length - 1]].id,
      };
    });

    return {
      type: "allowed",
      recomputedScenes,
    };
  }

  // 2. Chuyển từ trong Scene ra ngoài Scene
  if (sourceScene && !targetScene) {
    // Rời Scene
    const recomputedScenes = scenes
      .map((scene) => {
        if (scene.id !== sourceScene.id) return scene;
        // Loại bỏ movingBlock khỏi Scene này
        const remainingBlocks = getBlocksInsideRange(
          scene,
          blocks,
          oldIndexMap
        ).filter((b) => b.id !== movingBlock.id);

        if (remainingBlocks.length === 0) return null;

        const indices = remainingBlocks
          .map((b) => nextIndexMap.get(b.id))
          .filter((idx): idx is number => idx !== undefined)
          .sort((a, b) => a - b);

        if (indices.length === 0) return null;

        return {
          ...scene,
          start_block_id: nextBlocks[indices[0]].id,
          end_block_id: nextBlocks[indices[indices.length - 1]].id,
        };
      })
      .filter((s): s is Scene => s !== null);

    return {
      type: "membership_change",
      action: "leave",
      sourceScene,
      message: `Đoạn văn sẽ được đưa ra khỏi Bối Cảnh hiện tại.`,
      recomputedScenes,
    };
  }

  // 3. Chuyển từ ngoài vào trong một Scene
  if (!sourceScene && targetScene) {
    // Gia nhập Scene
    const recomputedScenes = scenes.map((scene) => {
      if (scene.id !== targetScene.id) return scene;
      const targetBlocks = [
        ...getBlocksInsideRange(scene, blocks, oldIndexMap),
        movingBlock,
      ];
      const indices = targetBlocks
        .map((b) => nextIndexMap.get(b.id))
        .filter((idx): idx is number => idx !== undefined)
        .sort((a, b) => a - b);

      return {
        ...scene,
        start_block_id: nextBlocks[indices[0]].id,
        end_block_id: nextBlocks[indices[indices.length - 1]].id,
      };
    });

    return {
      type: "membership_change",
      action: "join",
      targetScene,
      message: `Đoạn văn sẽ được gán vào Bối Cảnh này.`,
      recomputedScenes,
    };
  }

  // 4. Chuyển từ Scene A sang Scene B
  if (sourceScene && targetScene && sourceScene.id !== targetScene.id) {
    const recomputedScenes = scenes
      .map((scene) => {
        if (scene.id === sourceScene.id) {
          const remainingBlocks = getBlocksInsideRange(
            scene,
            blocks,
            oldIndexMap
          ).filter((b) => b.id !== movingBlock.id);

          if (remainingBlocks.length === 0) return null;

          const indices = remainingBlocks
            .map((b) => nextIndexMap.get(b.id))
            .filter((idx): idx is number => idx !== undefined)
            .sort((a, b) => a - b);

          if (indices.length === 0) return null;

          return {
            ...scene,
            start_block_id: nextBlocks[indices[0]].id,
            end_block_id: nextBlocks[indices[indices.length - 1]].id,
          };
        }

        if (scene.id === targetScene.id) {
          const targetBlocks = [
            ...getBlocksInsideRange(scene, blocks, oldIndexMap),
            movingBlock,
          ];
          const indices = targetBlocks
            .map((b) => nextIndexMap.get(b.id))
            .filter((idx): idx is number => idx !== undefined)
            .sort((a, b) => a - b);

          return {
            ...scene,
            start_block_id: nextBlocks[indices[0]].id,
            end_block_id: nextBlocks[indices[indices.length - 1]].id,
          };
        }

        return scene;
      })
      .filter((s): s is Scene => s !== null);

    return {
      type: "membership_change",
      action: "transfer",
      sourceScene,
      targetScene,
      message: `Đoạn văn sẽ được chuyển từ Bối Cảnh nguồn sang Bối Cảnh đích.`,
      recomputedScenes,
    };
  }

  return { type: "allowed", recomputedScenes: scenes };
}
