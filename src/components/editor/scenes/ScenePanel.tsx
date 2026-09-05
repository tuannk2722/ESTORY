"use client";

import React, { useCallback, useMemo } from "react";
import { LegacyScene as Scene, LegacySceneLibraryData as SceneLibraryData } from "@/types/scene-legacy";
import { StoryBlock } from "@/types/story";
import { ChevronLeft, ChevronRight, Layers, Plus } from "lucide-react";
import { buildBlockIndexMap } from "@/lib/scenes/sceneRange";
import { buildSceneRangeStatusMap } from "@/lib/scenes/sceneSelectors";
import { scrollToEditorBlock } from "@/lib/editor/scrollToBlock";
import { SceneCard } from "./SceneCard";
import { SceneRangeSelector } from "./SceneRangeSelector";

export interface ScenePanelProps {
  scenes: Scene[];
  blocks: StoryBlock[];
  activeBlockId: string | null;
  onSelectBlock: (blockId: string) => void;
  onOpenScenePicker: (
    startBlockId: string,
    endBlockId: string,
    sceneToEdit?: Scene | null
  ) => void;
  onDeleteScene: (sceneId: string) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  isSelectingRange: boolean;
  onStartRangeSelection: () => void;
  onCancelRangeSelection: () => void;
  onProceedToCreate: () => void;
  rangeStartId: string | null;
  rangeEndId: string | null;
  sceneLibrary: SceneLibraryData;
}

const focusRing =
  "focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2";

function ScenePanelComponent({
  scenes,
  blocks,
  activeBlockId,
  onSelectBlock,
  onOpenScenePicker,
  onDeleteScene,
  isCollapsed,
  onToggleCollapse,
  isSelectingRange,
  onStartRangeSelection,
  onCancelRangeSelection,
  onProceedToCreate,
  rangeStartId,
  rangeEndId,
  sceneLibrary,
}: ScenePanelProps) {
  const { backgrounds, palettes, scenePresets } = sceneLibrary;
  const backgroundMap = useMemo(
    () => new Map(backgrounds.map((background) => [background.id, background])),
    [backgrounds]
  );
  const paletteMap = useMemo(
    () => new Map(palettes.map((palette) => [palette.id, palette])),
    [palettes]
  );
  const presetMap = useMemo(
    () => new Map(scenePresets.map((preset) => [preset.id, preset])),
    [scenePresets]
  );
  const blockIndexMap = useMemo(() => buildBlockIndexMap(blocks), [blocks]);
  const rangeStatusMap = useMemo(
    () => buildSceneRangeStatusMap(scenes, blockIndexMap, blocks.length),
    [scenes, blockIndexMap, blocks.length]
  );
  const activeBlockIndex = activeBlockId
    ? blockIndexMap.get(activeBlockId)
    : undefined;
  const rangeStartIndex = rangeStartId
    ? blockIndexMap.get(rangeStartId) ?? null
    : null;
  const rangeEndIndex = rangeEndId
    ? blockIndexMap.get(rangeEndId) ?? null
    : null;
  const hasInvalidBoundary =
    (rangeStartId !== null && rangeStartIndex === null) ||
    (rangeEndId !== null && rangeEndIndex === null);

  const handleScrollToBlock = useCallback(
    (blockId: string) => {
      onSelectBlock(blockId);
      scrollToEditorBlock(blockId);
    },
    [onSelectBlock]
  );

  if (isCollapsed) {
    return (
      <aside
        aria-label="Bảng quản lý bối cảnh đang thu gọn"
        className="scene-panel-collapsed w-16 rounded-3xl border border-border bg-card/85 p-1.5 backdrop-blur-xl shadow-xl flex flex-col items-center gap-3 transition-[width] duration-300 motion-reduce:transition-none font-editor"
      >
        <button
          type="button"
          onClick={onToggleCollapse}
          className={`rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors motion-reduce:transition-none cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center ${focusRing}`}
          aria-label="Mở rộng bảng Bối Cảnh"
          aria-expanded="false"
        >
          <ChevronRight className="w-5 h-5" aria-hidden="true" />
        </button>

        <div className="w-full h-px bg-border/60" />
        <div className="flex flex-col items-center gap-1" aria-label={`${scenes.length} bối cảnh`}>
          <Layers className="w-4 h-4 text-accent" aria-hidden="true" />
          <span className="text-[11px] font-mono font-bold text-accent">{scenes.length}</span>
        </div>

        <button
          type="button"
          onClick={() => {
            onToggleCollapse();
            onStartRangeSelection();
          }}
          className={`rounded-xl bg-primary/10 hover:bg-primary/20 text-primary transition-colors motion-reduce:transition-none cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center shadow-2xs ${focusRing}`}
          aria-label="Tạo Scene mới"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
        </button>

        <div className="flex flex-col items-center gap-1.5 overflow-y-auto max-h-[calc(100vh-16rem)] w-full py-1 custom-scrollbar">
          {scenes.map((scene, index) => {
            const rangeStatus = rangeStatusMap.get(scene.id) || {
              valid: false as const,
              error: "INVALID_BOUNDARY" as const,
            };
            const isCurrent =
              rangeStatus.valid &&
              activeBlockIndex !== undefined &&
              activeBlockIndex >= rangeStatus.startIndex &&
              activeBlockIndex <= rangeStatus.endIndex;

            return (
              <button
                key={scene.id}
                type="button"
                onClick={() => handleScrollToBlock(scene.start_block_id)}
                disabled={!rangeStatus.valid}
                aria-current={isCurrent ? "true" : undefined}
                aria-label={`Scene ${index + 1}${rangeStatus.valid
                  ? `, từ block ${rangeStatus.startIndex + 1} đến ${rangeStatus.endIndex + 1}`
                  : ", dải không hợp lệ"
                  }`}
                className={`h-11 w-11 shrink-0 rounded-full border text-xs font-bold font-mono transition-[background-color,border-color,box-shadow] motion-reduce:transition-none cursor-pointer disabled:cursor-not-allowed flex items-center justify-center ${focusRing} ${!rangeStatus.valid
                  ? "bg-destructive/10 text-destructive border-destructive/50"
                  : isCurrent
                    ? "bg-accent text-accent-foreground border-accent shadow-xs ring-2 ring-accent/30"
                    : "bg-secondary/60 text-muted-foreground border-border hover:text-foreground hover:bg-secondary"
                  }`}
              >
                {index + 1}
              </button>
            );
          })}
        </div>
      </aside>
    );
  }

  return (
    <aside
      aria-label="Quản lý bối cảnh"
      className="scene-panel-expanded w-full rounded-3xl border border-border bg-card/85 p-4 backdrop-blur-xl shadow-xl max-h-[calc(100vh-6rem)] flex flex-col font-editor transition-[width] duration-300 motion-reduce:transition-none"
    >
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-accent/15 text-accent">
            <Layers className="w-4 h-4" aria-hidden="true" />
          </div>
          <div>
            <h2 className="font-bold text-sm text-foreground">Bối Cảnh (Scenes)</h2>
            <p className="text-[11px] text-muted-foreground">
              {scenes.length} bối cảnh được áp dụng
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onToggleCollapse}
          className={`rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors motion-reduce:transition-none cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center ${focusRing}`}
          aria-label="Thu gọn bảng Bối Cảnh"
          aria-expanded="true"
        >
          <ChevronLeft className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>

      <SceneRangeSelector
        isSelectingRange={isSelectingRange}
        startIndex={rangeStartIndex}
        endIndex={rangeEndIndex}
        hasInvalidBoundary={hasInvalidBoundary}
        onStartRangeSelection={onStartRangeSelection}
        onCancelRangeSelection={onCancelRangeSelection}
        onProceedToCreate={onProceedToCreate}
      />

      <div className="flex-1 overflow-y-auto space-y-3 pr-1 custom-scrollbar">
        {scenes.length === 0 ? (
          <div className="text-center py-8 text-xs text-muted-foreground space-y-1">
            <Layers className="w-8 h-8 mx-auto text-muted-foreground/40 stroke-1" aria-hidden="true" />
            <p>Chưa có Bối Cảnh nào trong chương.</p>
            <p className="text-[11px] text-muted-foreground/80">
              Hãy chọn dải đoạn văn để tạo bối cảnh đầu tiên.
            </p>
          </div>
        ) : (
          scenes.map((scene, index) => {
            const rangeStatus = rangeStatusMap.get(scene.id) || {
              valid: false as const,
              error: "INVALID_BOUNDARY" as const,
            };
            const isActive =
              rangeStatus.valid &&
              activeBlockIndex !== undefined &&
              activeBlockIndex >= rangeStatus.startIndex &&
              activeBlockIndex <= rangeStatus.endIndex;

            return (
              <SceneCard
                key={scene.id}
                scene={scene}
                index={index}
                rangeStatus={rangeStatus}
                isActive={isActive}
                backgroundMap={backgroundMap}
                paletteMap={paletteMap}
                presetMap={presetMap}
                onScrollToStart={handleScrollToBlock}
                onOpenScenePicker={onOpenScenePicker}
                onDeleteScene={onDeleteScene}
              />
            );
          })
        )}
      </div>
    </aside>
  );
}

function equalBlockOrder(previous: StoryBlock[], next: StoryBlock[]): boolean {
  return (
    previous.length === next.length &&
    previous.every((block, index) => block.id === next[index]?.id)
  );
}

export const ScenePanel = React.memo(
  ScenePanelComponent,
  (previous, next) =>
    previous.scenes === next.scenes &&
    equalBlockOrder(previous.blocks, next.blocks) &&
    previous.activeBlockId === next.activeBlockId &&
    previous.isCollapsed === next.isCollapsed &&
    previous.isSelectingRange === next.isSelectingRange &&
    previous.rangeStartId === next.rangeStartId &&
    previous.rangeEndId === next.rangeEndId &&
    previous.sceneLibrary === next.sceneLibrary &&
    previous.onSelectBlock === next.onSelectBlock &&
    previous.onOpenScenePicker === next.onOpenScenePicker &&
    previous.onDeleteScene === next.onDeleteScene &&
    previous.onToggleCollapse === next.onToggleCollapse &&
    previous.onStartRangeSelection === next.onStartRangeSelection &&
    previous.onCancelRangeSelection === next.onCancelRangeSelection &&
    previous.onProceedToCreate === next.onProceedToCreate
);

export default ScenePanel;
