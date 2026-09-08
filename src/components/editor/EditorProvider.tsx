// src/components/editor/EditorProvider.tsx
// Context and State Controller for the Story Editor Aggregate

"use client";

import React, {
  createContext,
  useContext,
  useReducer,
  useMemo,
} from "react";
import { Chapter, StoryBlock, EffectConfig } from "@/types/story";
import { Scene } from "@/types/scene";
import {
  EditorState,
  editorReducer,
  createInitialEditorState,
} from "@/lib/editor/editorReducer";

export interface EditorCommands {
  blocks: {
    updateText: (blockId: string, text: string) => void;
    changeType: (
      blockId: string,
      type: "paragraph" | "dialogue" | "heading"
    ) => void;
    insertBlock: (afterIndex: number, newBlock?: Partial<StoryBlock>) => void;
    deleteBlock: (blockId: string) => void;
    moveBlock: (fromIndex: number, toIndex: number) => void;
    upsertEffect: (blockId: string, effect: EffectConfig) => void;
    deleteEffect: (blockId: string, effectId: string) => void;
    selectActive: (blockId: string | null) => void;
  };
  scenes: {
    upsertScene: (scene: Scene) => void;
    deleteScene: (sceneId: string) => void;
    togglePanel: (state?: "expanded" | "collapsed") => void;
  };
  range: {
    startRange: () => void;
    selectRangeBlock: (blockId: string) => void;
    cancelRange: () => void;
  };
  preview: {
    togglePreview: (preview?: boolean) => void;
  };
  save: {
    startSave: (version: number) => void;
    succeedSave: (version: number, revision: string) => void;
    failSave: (error?: string) => void;
    conflictSave: () => void;
  };
}

interface EditorContextValue {
  state: EditorState;
  commands: EditorCommands;
}

const EditorContext = createContext<EditorContextValue | null>(null);

export interface EditorProviderProps {
  initialChapter: Chapter;
  initialScenes?: Scene[];
  initialRevision: string;
  children: React.ReactNode;
}

export function EditorProvider({
  initialChapter,
  initialScenes = [],
  initialRevision,
  children,
}: EditorProviderProps) {
  const [state, dispatch] = useReducer(
    editorReducer,
    { chapter: initialChapter, scenes: initialScenes, revision: initialRevision },
    (init) => createInitialEditorState(init.chapter, init.scenes, init.revision)
  );

  // Grouped domain commands to shield components from raw dispatch calls
  const commands = useMemo<EditorCommands>(() => {
    return {
      blocks: {
        updateText: (blockId, text) =>
          dispatch({ type: "blockTextUpdated", payload: { blockId, text } }),
        changeType: (blockId, blockType) =>
          dispatch({
            type: "blockTypeChanged",
            payload: { blockId, blockType },
          }),
        insertBlock: (afterIndex, newBlock) =>
          dispatch({
            type: "blockInserted",
            payload: { afterIndex, newBlock },
          }),
        deleteBlock: (blockId) =>
          dispatch({ type: "blockDeleted", payload: { blockId } }),
        moveBlock: (fromIndex, toIndex) =>
          dispatch({ type: "blockMoved", payload: { fromIndex, toIndex } }),
        upsertEffect: (blockId, effect) =>
          dispatch({
            type: "blockEffectUpserted",
            payload: { blockId, effect },
          }),
        deleteEffect: (blockId, effectId) =>
          dispatch({
            type: "blockEffectDeleted",
            payload: { blockId, effectId },
          }),
        selectActive: (blockId) =>
          dispatch({ type: "activeBlockSelected", payload: { blockId } }),
      },
      scenes: {
        upsertScene: (scene) =>
          dispatch({ type: "sceneUpserted", payload: { scene } }),
        deleteScene: (sceneId) =>
          dispatch({ type: "sceneDeleted", payload: { sceneId } }),
        togglePanel: (panelState) =>
          dispatch({
            type: "scenePanelToggled",
            payload: panelState ? { state: panelState } : undefined,
          }),
      },
      range: {
        startRange: () => dispatch({ type: "rangeStarted" }),
        selectRangeBlock: (blockId) =>
          dispatch({ type: "rangeBlockSelected", payload: { blockId } }),
        cancelRange: () => dispatch({ type: "rangeCancelled" }),
      },
      preview: {
        togglePreview: (preview) =>
          dispatch({
            type: "previewToggled",
            payload: preview !== undefined ? { preview } : undefined,
          }),
      },
      save: {
        startSave: (version) =>
          dispatch({ type: "saveStarted", payload: { version } }),
        succeedSave: (version, revision) =>
          dispatch({
            type: "saveSucceeded",
            payload: { version, revision },
          }),
        failSave: (error) =>
          dispatch({ type: "saveFailed", payload: { error } }),
        conflictSave: () => dispatch({ type: "saveConflict" }),
      },
    };
  }, []);

  const contextValue = useMemo(
    () => ({ state, commands }),
    [state, commands]
  );

  return (
    <EditorContext.Provider value={contextValue}>
      {children}
    </EditorContext.Provider>
  );
}

export function useEditor(): EditorContextValue {
  const context = useContext(EditorContext);
  if (!context) {
    throw new Error("useEditor must be used within an EditorProvider");
  }
  return context;
}

export function useEditorState(): EditorState {
  return useEditor().state;
}

export function useEditorCommands(): EditorCommands {
  return useEditor().commands;
}
