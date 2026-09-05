// src/lib/editor/editorReducer.ts
// Pure reducer and domain action types for Story Editor State Management

import { Chapter, StoryBlock, EffectConfig } from "@/types/story";
import { LegacyScene as Scene } from "@/types/scene-legacy";
import { createBlockId } from "./ids";
import {
  updateScenesAfterBlockDelete,
  validateBlockMoveAgainstScenes,
  buildBlockIndexMap,
  findSceneOverlap,
  validateSceneRange,
} from "@/lib/scenes/sceneRange";

export type RangeSelectionState =
  | { status: "idle"; startId: null; endId: null }
  | { status: "selecting"; startId: string | null; endId: string | null };

export type SaveStatus =
  | "idle"
  | "saving"
  | "saved"
  | "error"
  | "conflict";

export interface EditorState {
  chapter: Chapter;
  scenes: Scene[];
  activeBlockId: string | null;
  range: RangeSelectionState;
  preview: boolean;
  scenePanel: "expanded" | "collapsed";
  dirty: boolean;
  changeVersion: number;
  savingVersion: number | null;
  saveStatus: SaveStatus;
  revision: string;
  lastSavedAt: number | null;
}

export type EditorAction =
  | { type: "blockTextUpdated"; payload: { blockId: string; text: string } }
  | {
      type: "blockTypeChanged";
      payload: {
        blockId: string;
        blockType: "paragraph" | "dialogue" | "heading";
      };
    }
  | {
      type: "blockInserted";
      payload: {
        afterIndex: number;
        newBlock?: Partial<StoryBlock>;
      };
    }
  | { type: "blockDeleted"; payload: { blockId: string } }
  | { type: "blockMoved"; payload: { fromIndex: number; toIndex: number } }
  | {
      type: "blockEffectUpserted";
      payload: { blockId: string; effect: EffectConfig };
    }
  | {
      type: "blockEffectDeleted";
      payload: { blockId: string; effectId: string };
    }
  | { type: "sceneUpserted"; payload: { scene: Scene } }
  | { type: "sceneDeleted"; payload: { sceneId: string } }
  | { type: "rangeStarted" }
  | { type: "rangeBlockSelected"; payload: { blockId: string } }
  | { type: "rangeCancelled" }
  | { type: "activeBlockSelected"; payload: { blockId: string | null } }
  | { type: "previewToggled"; payload?: { preview?: boolean } }
  | {
      type: "scenePanelToggled";
      payload?: { state?: "expanded" | "collapsed" };
    }
  | { type: "saveStarted"; payload: { version: number } }
  | { type: "saveSucceeded"; payload: { version: number; revision: string } }
  | { type: "saveFailed"; payload?: { error?: string } }
  | { type: "saveConflict" }
  | {
      type: "stateReset";
      payload: { chapter: Chapter; scenes: Scene[]; revision: string };
    };

export function createInitialEditorState(
  chapter: Chapter,
  scenes: Scene[] = [],
  revision = ""
): EditorState {
  // Scene cùng chapter được giữ lại kể cả khi boundary lỗi để UI hiển thị
  // controlled error, tránh âm thầm làm mất dữ liệu khi tác giả lưu thay đổi khác.
  const chapterScenes = scenes.filter((scene) => scene.chapter_id === chapter.id);

  return {
    chapter,
    scenes: chapterScenes,
    activeBlockId: chapter.blocks[0]?.id || null,
    range: { status: "idle", startId: null, endId: null },
    preview: false,
    scenePanel: "expanded",
    dirty: false,
    changeVersion: 0,
    savingVersion: null,
    saveStatus: "idle",
    revision,
    lastSavedAt: null,
  };
}

function markEditorChanged(
  state: EditorState,
  changes: Partial<EditorState>
): EditorState {
  return {
    ...state,
    ...changes,
    dirty: true,
    changeVersion: state.changeVersion + 1,
    saveStatus: state.saveStatus === "saved" ? "idle" : state.saveStatus,
  };
}

export function editorReducer(
  state: EditorState,
  action: EditorAction
): EditorState {
  switch (action.type) {
    case "blockTextUpdated": {
      const { blockId, text } = action.payload;
      const blockIndex = state.chapter.blocks.findIndex(
        (b) => b.id === blockId
      );
      if (blockIndex === -1) return state;

      const currentBlock = state.chapter.blocks[blockIndex];
      if (currentBlock.text === text) return state;

      const updatedBlocks = [...state.chapter.blocks];
      updatedBlocks[blockIndex] = {
        ...currentBlock,
        text,
      };

      return markEditorChanged(state, {
        chapter: {
          ...state.chapter,
          blocks: updatedBlocks,
        },
      });
    }

    case "blockTypeChanged": {
      const { blockId, blockType } = action.payload;
      const blockIndex = state.chapter.blocks.findIndex(
        (b) => b.id === blockId
      );
      if (blockIndex === -1) return state;

      const currentBlock = state.chapter.blocks[blockIndex];
      if (currentBlock.type === blockType) return state;

      const updatedBlocks = [...state.chapter.blocks];
      updatedBlocks[blockIndex] = {
        ...currentBlock,
        type: blockType,
      };

      return markEditorChanged(state, {
        chapter: {
          ...state.chapter,
          blocks: updatedBlocks,
        },
      });
    }

    case "blockInserted": {
      const { afterIndex, newBlock: customBlock } = action.payload;
      const newBlockId =
        customBlock?.id || createBlockId(state.chapter.id);

      const newBlock: StoryBlock = {
        id: newBlockId,
        type: customBlock?.type || "paragraph",
        text: customBlock?.text || "",
        mood_tag: customBlock?.mood_tag || "",
        effects: customBlock?.effects || [],
      };

      const updatedBlocks = [...state.chapter.blocks];
      const insertIndex = Math.max(
        0,
        Math.min(afterIndex + 1, updatedBlocks.length)
      );
      updatedBlocks.splice(insertIndex, 0, newBlock);

      return markEditorChanged(state, {
        chapter: {
          ...state.chapter,
          blocks: updatedBlocks,
        },
        activeBlockId: newBlockId,
      });
    }

    case "blockDeleted": {
      const { blockId } = action.payload;
      if (state.chapter.blocks.length <= 1) {
        return state; // Giữ tối thiểu 1 block cho chapter
      }

      const blockIndex = state.chapter.blocks.findIndex(
        (b) => b.id === blockId
      );
      if (blockIndex === -1) return state;

      // Reconcile Scene ranges trước khi commit
      const { updatedScenes } = updateScenesAfterBlockDelete(
        blockId,
        state.scenes,
        state.chapter.blocks
      );

      const updatedBlocks = state.chapter.blocks.filter(
        (b) => b.id !== blockId
      );

      const nextActiveId =
        state.activeBlockId === blockId
          ? updatedBlocks[Math.min(blockIndex, updatedBlocks.length - 1)]?.id || null
          : state.activeBlockId;

      const rangeTouchesDeletedBlock =
        state.range.startId === blockId || state.range.endId === blockId;

      return markEditorChanged(state, {
        chapter: {
          ...state.chapter,
          blocks: updatedBlocks,
        },
        scenes: updatedScenes,
        activeBlockId: nextActiveId,
        range: rangeTouchesDeletedBlock
          ? { status: "idle", startId: null, endId: null }
          : state.range,
      });
    }

    case "blockMoved": {
      const { fromIndex, toIndex } = action.payload;
      if (
        fromIndex < 0 ||
        fromIndex >= state.chapter.blocks.length ||
        toIndex < 0 ||
        toIndex >= state.chapter.blocks.length ||
        fromIndex === toIndex
      ) {
        return state;
      }

      const moveValidation = validateBlockMoveAgainstScenes(
        fromIndex,
        toIndex,
        state.chapter.blocks,
        state.scenes
      );

      if (moveValidation.type === "invalid") {
        return state;
      }

      const updatedBlocks = [...state.chapter.blocks];
      const [movedBlock] = updatedBlocks.splice(fromIndex, 1);
      updatedBlocks.splice(toIndex, 0, movedBlock);

      return markEditorChanged(state, {
        chapter: {
          ...state.chapter,
          blocks: updatedBlocks,
        },
        scenes: moveValidation.recomputedScenes,
      });
    }

    case "blockEffectUpserted": {
      const { blockId, effect } = action.payload;
      const blockIndex = state.chapter.blocks.findIndex(
        (b) => b.id === blockId
      );
      if (blockIndex === -1) return state;

      const currentBlock = state.chapter.blocks[blockIndex];
      const existingEffectIndex = currentBlock.effects.findIndex(
        (e) => e.id === effect.id
      );

      let nextEffects: EffectConfig[];
      if (existingEffectIndex >= 0) {
        nextEffects = [...currentBlock.effects];
        nextEffects[existingEffectIndex] = effect;
      } else {
        nextEffects = [...currentBlock.effects, effect];
      }

      const updatedBlocks = [...state.chapter.blocks];
      updatedBlocks[blockIndex] = {
        ...currentBlock,
        effects: nextEffects,
      };

      return markEditorChanged(state, {
        chapter: {
          ...state.chapter,
          blocks: updatedBlocks,
        },
      });
    }

    case "blockEffectDeleted": {
      const { blockId, effectId } = action.payload;
      const blockIndex = state.chapter.blocks.findIndex(
        (b) => b.id === blockId
      );
      if (blockIndex === -1) return state;

      const currentBlock = state.chapter.blocks[blockIndex];
      const nextEffects = currentBlock.effects.filter(
        (e) => e.id !== effectId
      );

      if (nextEffects.length === currentBlock.effects.length) {
        return state;
      }

      const updatedBlocks = [...state.chapter.blocks];
      updatedBlocks[blockIndex] = {
        ...currentBlock,
        effects: nextEffects,
      };

      return markEditorChanged(state, {
        chapter: {
          ...state.chapter,
          blocks: updatedBlocks,
        },
      });
    }

    case "sceneUpserted": {
      const { scene } = action.payload;
      if (scene.chapter_id !== state.chapter.id) return state;

      const blockIndexMap = buildBlockIndexMap(state.chapter.blocks);
      const rangeValidation = validateSceneRange(
        scene,
        blockIndexMap,
        state.chapter.blocks.length
      );
      if (!rangeValidation.valid) return state;

      if (findSceneOverlap(scene, state.scenes, blockIndexMap, scene.id)) {
        return state;
      }

      const existingIdx = state.scenes.findIndex((s) => s.id === scene.id);

      let nextScenes: Scene[];
      if (existingIdx >= 0) {
        nextScenes = [...state.scenes];
        nextScenes[existingIdx] = scene;
      } else {
        nextScenes = [...state.scenes, scene];
      }

      return markEditorChanged(state, {
        scenes: nextScenes,
      });
    }

    case "sceneDeleted": {
      const { sceneId } = action.payload;
      const nextScenes = state.scenes.filter((s) => s.id !== sceneId);

      if (nextScenes.length === state.scenes.length) {
        return state;
      }

      return markEditorChanged(state, {
        scenes: nextScenes,
      });
    }

    case "rangeStarted": {
      return {
        ...state,
        range: { status: "selecting", startId: null, endId: null },
      };
    }

    case "rangeBlockSelected": {
      const { blockId } = action.payload;
      if (state.range.status !== "selecting") {
        return {
          ...state,
          range: { status: "selecting", startId: blockId, endId: null },
        };
      }

      const { startId, endId } = state.range;
      if (!startId) {
        return {
          ...state,
          range: { status: "selecting", startId: blockId, endId: null },
        };
      } else if (startId && !endId) {
        return {
          ...state,
          range: { status: "selecting", startId, endId: blockId },
        };
      } else {
        // Đã có cả 2 -> click mới bắt đầu chọn lại dải từ blockId này
        return {
          ...state,
          range: { status: "selecting", startId: blockId, endId: null },
        };
      }
    }

    case "rangeCancelled": {
      return {
        ...state,
        range: { status: "idle", startId: null, endId: null },
      };
    }

    case "activeBlockSelected": {
      return {
        ...state,
        activeBlockId: action.payload.blockId,
      };
    }

    case "previewToggled": {
      const nextPreview =
        action.payload?.preview !== undefined
          ? action.payload.preview
          : !state.preview;
      return {
        ...state,
        preview: nextPreview,
      };
    }

    case "scenePanelToggled": {
      const nextState =
        action.payload?.state ||
        (state.scenePanel === "expanded" ? "collapsed" : "expanded");
      return {
        ...state,
        scenePanel: nextState,
      };
    }

    case "saveStarted": {
      return {
        ...state,
        saveStatus: "saving",
        savingVersion: action.payload.version,
      };
    }

    case "saveSucceeded": {
      const hasNewerChanges = state.changeVersion !== action.payload.version;
      return {
        ...state,
        saveStatus: "saved",
        dirty: hasNewerChanges,
        savingVersion: null,
        revision: action.payload.revision,
        lastSavedAt: Date.now(),
      };
    }

    case "saveFailed": {
      return {
        ...state,
        saveStatus: "error",
        savingVersion: null,
      };
    }

    case "saveConflict": {
      return {
        ...state,
        saveStatus: "conflict",
        savingVersion: null,
      };
    }

    case "stateReset": {
      return {
        ...state,
        chapter: action.payload.chapter,
        scenes: action.payload.scenes,
        revision: action.payload.revision,
        dirty: false,
        changeVersion: 0,
        savingVersion: null,
        saveStatus: "idle",
      };
    }

    default:
      return state;
  }
}
