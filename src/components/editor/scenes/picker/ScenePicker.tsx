"use client";

import React, { useCallback, useMemo, useState } from "react";
import { Layers } from "lucide-react";
import type { Scene, SceneAuthoringLibraryData } from "@/types/scene";
import type { StoryBlock } from "@/types/story";
import {
  createEmptySceneDraft,
  draftToRenderConfig,
  draftToScene,
  sceneToDraft,
} from "@/lib/scenes/sceneDraft";
import { createSceneId } from "@/lib/editor/ids";
import { EditorDialog } from "@/components/editor/shared/EditorDialog";
import { CustomSceneTab } from "./CustomSceneTab";
import { ScenePreview } from "./ScenePreview";
import { ScenePickerFooter } from "./ScenePickerControls";

export interface ScenePickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveScene: (scene: Scene) => void;
  startBlockId: string;
  endBlockId: string;
  initialScene?: Scene | null;
  chapterId: string;
  blocks?: StoryBlock[];
  sceneLibrary: SceneAuthoringLibraryData;
}

const SAVED_BACKGROUND_ID = "snapshot:current-background";

export function ScenePicker({
  isOpen,
  onClose,
  onSaveScene,
  startBlockId,
  endBlockId,
  initialScene,
  chapterId,
  blocks = [],
  sceneLibrary,
}: ScenePickerProps) {
  const [draft, setDraft] = useState(() =>
    initialScene ? sceneToDraft(initialScene) : createEmptySceneDraft(),
  );
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const renderConfig = useMemo(() => draftToRenderConfig(draft), [draft]);

  // A saved snapshot stays editable after its catalog item is archived or removed.
  const backgrounds = useMemo(
    () => [
      ...(draft.background && !draft.backgroundId
        ? [
            {
              id: SAVED_BACKGROUND_ID,
              label: "Nền hiện tại",
              mood_tags: [],
              render: draft.background,
            },
          ]
        : []),
      ...sceneLibrary.backgrounds,
    ],
    [draft.background, draft.backgroundId, sceneLibrary.backgrounds],
  );

  const handleClose = useCallback(() => {
    setIsPreviewOpen(false);
    onClose();
  }, [onClose]);

  const { rangeLabel, selectedBlocks, normalizedRange } = useMemo(() => {
    const startIndex = blocks.findIndex((block) => block.id === startBlockId);
    const endIndex = blocks.findIndex((block) => block.id === endBlockId);
    if (startIndex === -1 || endIndex === -1) {
      return {
        rangeLabel: "Dải block không xác định",
        selectedBlocks: [] as StoryBlock[],
        normalizedRange: null,
      };
    }

    const minIndex = Math.min(startIndex, endIndex);
    const maxIndex = Math.max(startIndex, endIndex);
    return {
      rangeLabel: `Đoạn #${minIndex + 1} → #${maxIndex + 1} (${maxIndex - minIndex + 1} đoạn văn)`,
      selectedBlocks: blocks.slice(minIndex, maxIndex + 1),
      normalizedRange: {
        startBlockId: blocks[minIndex].id,
        endBlockId: blocks[maxIndex].id,
      },
    };
  }, [blocks, endBlockId, startBlockId]);

  const activeBackground = useMemo(
    () =>
      backgrounds.find(
        (background) =>
          background.id ===
          (draft.backgroundId || (draft.background ? SAVED_BACKGROUND_ID : "")),
      ),
    [backgrounds, draft.background, draft.backgroundId],
  );
  const previewSceneLabel = activeBackground?.label || "Bối cảnh tùy chỉnh";
  const isSaveDisabled = renderConfig === null || normalizedRange === null;

  const handleSave = useCallback(() => {
    if (isSaveDisabled || !normalizedRange) return;
    const scene = draftToScene(draft, {
      id: initialScene?.id || createSceneId(),
      chapterId,
      startBlockId: normalizedRange.startBlockId,
      endBlockId: normalizedRange.endBlockId,
    });
    setIsPreviewOpen(false);
    onSaveScene(scene);
  }, [
    chapterId,
    draft,
    initialScene?.id,
    isSaveDisabled,
    normalizedRange,
    onSaveScene,
  ]);

  if (!isOpen) return null;

  const footer = (
    <ScenePickerFooter
      editing={Boolean(initialScene)}
      disabled={isSaveDisabled}
      onPreview={() => setIsPreviewOpen(true)}
      onSave={handleSave}
    />
  );

  return (
    <>
      <EditorDialog
        isOpen={isOpen}
        onClose={handleClose}
        title={initialScene ? "Chỉnh sửa Scene" : "Gán Scene cho dải block"}
        description={`Áp dụng cho: ${rangeLabel}`}
        icon={<Layers className="h-6 w-6" aria-hidden="true" />}
        maxWidth="max-w-4xl"
        footer={footer}
      >
        <CustomSceneTab
          draft={{
            ...draft,
            backgroundId:
              draft.backgroundId || (draft.background ? SAVED_BACKGROUND_ID : ""),
          }}
          onChangeDraft={setDraft}
          backgrounds={backgrounds}
          initialBackgroundId={
            draft.background && !draft.backgroundId
              ? SAVED_BACKGROUND_ID
              : undefined
          }
          initialAudioSrc={initialScene?.render_config.ambient_effects.find(
            (effect) => effect.type === "audio" || effect.category === "audio",
          )?.audio_src}
          isLoop
        />
      </EditorDialog>

      <ScenePreview
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        onSave={handleSave}
        isSaveDisabled={isSaveDisabled}
        renderConfig={renderConfig}
        selectedBlocks={selectedBlocks}
        previewSceneLabel={previewSceneLabel}
        rangeLabel={rangeLabel}
      />
    </>
  );
}

export default ScenePicker;
