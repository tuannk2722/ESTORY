// src/lib/editor/editorSelectors.ts
// Prepared data selectors for Editor state to avoid redundant calculations in UI components

import { EditorState } from "./editorReducer";
import { StoryBlock, Chapter } from "@/types/story";
import { Scene } from "@/types/scene";
import { buildBlockIndexMap } from "@/lib/scenes/sceneRange";
import { buildSceneByBlockId, findActiveScene, SceneBlockInfo } from "@/lib/scenes/sceneSelectors";

export function selectChapter(state: EditorState): Chapter {
  return state.chapter;
}

export function selectBlocks(state: EditorState): StoryBlock[] {
  return state.chapter.blocks;
}

export function selectBlockById(
  state: EditorState,
  blockId: string
): StoryBlock | undefined {
  return state.chapter.blocks.find((b) => b.id === blockId);
}

export function selectBlockIndexMap(state: EditorState): Map<string, number> {
  return buildBlockIndexMap(state.chapter.blocks);
}

export function selectScenes(state: EditorState): Scene[] {
  return state.scenes;
}

export function selectSceneByBlockId(
  state: EditorState
): Map<string, SceneBlockInfo> {
  const indexMap = selectBlockIndexMap(state);
  return buildSceneByBlockId(state.chapter.blocks, state.scenes, indexMap);
}

export function selectActiveScene(state: EditorState): Scene | null {
  const sceneByBlockId = selectSceneByBlockId(state);
  return findActiveScene(state.activeBlockId, sceneByBlockId);
}

export function selectPendingRange(state: EditorState): {
  isSelecting: boolean;
  startId: string | null;
  endId: string | null;
} {
  return {
    isSelecting: state.range.status === "selecting",
    startId: state.range.startId,
    endId: state.range.endId,
  };
}

export function selectDirtyState(state: EditorState): boolean {
  return state.dirty;
}

export function selectSaveStatus(state: EditorState): EditorState["saveStatus"] {
  return state.saveStatus;
}
