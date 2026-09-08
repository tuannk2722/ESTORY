"use client";

import React, { useCallback, useMemo, useState } from "react";
import { Layers } from "lucide-react";
import { Scene, SceneLibraryData, ScenePreset } from "@/types/scene";
import { StoryBlock } from "@/types/story";
import {
  createEmptySceneDraft,
  draftToRenderConfig,
  draftMatchesPreset,
  draftToScene,
  presetToDraft,
  sceneMatchesPreset,
  sceneToDraft,
} from "@/lib/scenes/sceneDraft";
import { createSceneId } from "@/lib/editor/ids";
import { EditorDialog } from "@/components/editor/shared/EditorDialog";
import { PresetTab } from "./PresetTab";
import { CustomSceneTab } from "./CustomSceneTab";
import { ScenePreview } from "./ScenePreview";
import { ScenePickerFooter, ScenePickerModeTabs } from "./ScenePickerControls";

export interface ScenePickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveScene: (scene: Scene) => void;
  startBlockId: string;
  endBlockId: string;
  initialScene?: Scene | null;
  chapterId: string;
  blocks?: StoryBlock[];
  sceneLibrary: SceneLibraryData;
}

function getInitialMode(
  initialScene: Scene | null | undefined,
  library: SceneLibraryData | undefined
): "preset" | "custom" {
  if (!initialScene) return "preset";
  if (!initialScene.based_on_preset_id || !library) return "custom";

  const sourcePreset = library.scenePresets.find(
    (preset) => preset.id === initialScene.based_on_preset_id
  );
  return sourcePreset && sceneMatchesPreset(initialScene, sourcePreset)
    ? "preset"
    : "custom";
}

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
  const [mode, setMode] = useState<"preset" | "custom">(
    () => getInitialMode(initialScene, sceneLibrary)
  );
  const [draft, setDraft] = useState(() =>
    initialScene ? sceneToDraft(initialScene) : createEmptySceneDraft()
  );
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const { scenePresets: presets } = sceneLibrary;
  const renderConfig = useMemo(() => draftToRenderConfig(draft), [draft]);
  // The saved snapshot remains editable even when no catalog ingredient exists.
  const savedBackgroundId = "snapshot:current-background";
  const savedPaletteId = "snapshot:current-palette";
  const backgrounds = useMemo(() => [
    ...(draft.background && !draft.backgroundId ? [{ id: savedBackgroundId, label: "Nền hiện tại", mood_tags: [], render: draft.background }] : []),
    ...sceneLibrary.backgrounds,
  ], [draft.background, draft.backgroundId, sceneLibrary.backgrounds]);
  const palettes = useMemo(() => [
    ...(draft.palette && !draft.paletteId ? [{ id: savedPaletteId, label: "Bảng màu hiện tại", mood_tags: [], colors: draft.palette }] : []),
    ...sceneLibrary.palettes,
  ], [draft.palette, draft.paletteId, sceneLibrary.palettes]);

  const handleClose = useCallback(() => {
    setIsPreviewOpen(false);
    onClose();
  }, [onClose]);

  const handleSelectPreset = useCallback((preset: ScenePreset) => {
    setDraft(presetToDraft(preset));
  }, []);

  const handleQuickPreviewPreset = useCallback(
    (event: React.MouseEvent, preset: ScenePreset) => {
      event.stopPropagation();
      handleSelectPreset(preset);
      setIsPreviewOpen(true);
    },
    [handleSelectPreset]
  );

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
    () => backgrounds.find((background) => background.id === (draft.backgroundId || savedBackgroundId)),
    [backgrounds, draft.backgroundId]
  );
  const previewSceneLabel = useMemo(() => {
    if (draft.sourcePresetId) {
      const preset = presets.find((item) => item.id === draft.sourcePresetId);
      if (preset) {
        return draftMatchesPreset(draft, preset)
          ? preset.label
          : `${preset.label} · đã tùy chỉnh`;
      }
    }
    return activeBackground?.label || "Bối Cảnh Tùy Chỉnh";
  }, [activeBackground, draft, presets]);

  const selectedPresetId = useMemo(() => {
    if (!draft.sourcePresetId) return undefined;
    const sourcePreset = presets.find(
      (preset) => preset.id === draft.sourcePresetId
    );
    return sourcePreset && draftMatchesPreset(draft, sourcePreset)
      ? sourcePreset.id
      : undefined;
  }, [draft, presets]);

  const isSaveDisabled =
    renderConfig === null || normalizedRange === null;

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
      mode={mode}
      editing={Boolean(initialScene)}
      disabled={isSaveDisabled}
      onPreview={() => {
        setIsPreviewOpen(true);
      }}
      onSave={handleSave}
    />
  );

  return (
    <>
      <EditorDialog
        isOpen={isOpen}
        onClose={handleClose}
        title={initialScene ? "Chỉnh Sửa Scene" : "Gán Scene Cho Dải Block"}
        description={`Áp dụng cho: ${rangeLabel}`}
        icon={<Layers className="w-6 h-6" aria-hidden="true" />}
        maxWidth="max-w-4xl"
        footer={footer}
      >
        <ScenePickerModeTabs mode={mode} presetCount={presets.length} onChange={setMode} />

        {mode === "preset" ? (
          <PresetTab
            presets={presets}
            selectedPresetId={selectedPresetId}
            initialPresetId={initialScene?.based_on_preset_id}
            onSelectPreset={handleSelectPreset}
            onQuickPreview={handleQuickPreviewPreset}
          />
        ) : (
          <CustomSceneTab
            draft={{ ...draft, backgroundId: draft.backgroundId || savedBackgroundId, paletteId: draft.paletteId || savedPaletteId }}
            onChangeDraft={setDraft}
            backgrounds={backgrounds}
            palettes={palettes}
            initialBackgroundId={savedBackgroundId}
            initialPaletteId={savedPaletteId}
            initialAudioSrc={initialScene?.render_config.ambient_effects?.find(
              (effect) => effect.type === "audio" || effect.category === "audio"
            )?.audio_src}
            isLoop
          />
        )}
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
