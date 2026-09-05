"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Layers } from "lucide-react";
import { LegacyScene as Scene, LegacySceneLibraryData as SceneLibraryData, LegacyScenePreset as ScenePreset } from "@/types/scene-legacy";
import { StoryBlock } from "@/types/story";
import {
  SceneDraft,
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
  sceneLibrary?: SceneLibraryData;
}

const EMPTY_DRAFT: SceneDraft = {
  backgroundId: "",
  paletteId: "",
  ambientAudio: null,
  ambientEffects: [],
};

const EMPTY_LIBRARY: SceneLibraryData = {
  backgrounds: [],
  palettes: [],
  scenePresets: [],
};

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
  const [fetchedLibrary, setFetchedLibrary] = useState<SceneLibraryData | null>(null);
  const [loading, setLoading] = useState(!sceneLibrary);
  const [mode, setMode] = useState<"preset" | "custom">(
    () => getInitialMode(initialScene, sceneLibrary)
  );
  const [draft, setDraft] = useState<SceneDraft>(() =>
    initialScene ? sceneToDraft(initialScene) : EMPTY_DRAFT
  );
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const library = sceneLibrary || fetchedLibrary || EMPTY_LIBRARY;
  const { backgrounds, palettes, scenePresets: presets } = library;

  useEffect(() => {
    if (!isOpen || sceneLibrary) return;
    const controller = new AbortController();

    fetch("/api/scene-library", { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("Không thể tải thư viện Scene");
        return response.json() as Promise<SceneLibraryData>;
      })
      .then((data) => setFetchedLibrary(data))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        console.error("Error fetching scene library:", error);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [isOpen, sceneLibrary]);

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
    () => backgrounds.find((background) => background.id === draft.backgroundId),
    [backgrounds, draft.backgroundId]
  );
  const activeColorPalette = useMemo(
    () => palettes.find((palette) => palette.id === draft.paletteId),
    [palettes, draft.paletteId]
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
    !draft.backgroundId || !draft.paletteId || normalizedRange === null;

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

        {loading ? (
          <div className="py-20 text-center text-muted-foreground" aria-live="polite">
            <div className="inline-block w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin motion-reduce:animate-none mb-3" />
            <p className="text-sm">Đang nạp thư viện Scene…</p>
          </div>
        ) : mode === "preset" ? (
          <PresetTab
            presets={presets}
            backgrounds={backgrounds}
            palettes={palettes}
            selectedPresetId={selectedPresetId}
            selectedBackgroundId={draft.backgroundId}
            initialPresetId={initialScene?.based_on_preset_id}
            onSelectPreset={handleSelectPreset}
            onQuickPreview={handleQuickPreviewPreset}
          />
        ) : (
          <CustomSceneTab
            draft={draft}
            onChangeDraft={setDraft}
            backgrounds={backgrounds}
            palettes={palettes}
            initialBackgroundId={initialScene?.background_id}
            initialPaletteId={initialScene?.palette_id}
            initialAudioSrc={initialScene?.effects?.find(
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
        background={activeBackground}
        palette={activeColorPalette}
        ambientAudio={draft.ambientAudio}
        effects={draft.ambientEffects}
        selectedBlocks={selectedBlocks}
        previewSceneLabel={previewSceneLabel}
        rangeLabel={rangeLabel}
      />
    </>
  );
}

export default ScenePicker;
