"use client";

import React from "react";
import {
  LegacyBackgroundAsset as BackgroundAsset,
  LegacyColorPalette as ColorPalette,
  LegacyScene as Scene,
  LegacyScenePreset as ScenePreset,
} from "@/types/scene-legacy";
import { SceneRangeStatus } from "@/lib/scenes/sceneSelectors";
import {
  AlertTriangle,
  Edit2,
  ExternalLink,
  Film,
  Sparkles,
  Trash2,
  Volume2,
} from "lucide-react";
import { useConfirm } from "@/components/ui/ConfirmModal";

export interface SceneCardProps {
  scene: Scene;
  index: number;
  rangeStatus: SceneRangeStatus;
  isActive: boolean;
  backgroundMap: Map<string, BackgroundAsset>;
  paletteMap: Map<string, ColorPalette>;
  presetMap: Map<string, ScenePreset>;
  onScrollToStart: (blockId: string) => void;
  onOpenScenePicker: (
    startBlockId: string,
    endBlockId: string,
    scene: Scene
  ) => void;
  onDeleteScene: (sceneId: string) => void;
}

const focusRing =
  "focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2";

export const SceneCard = React.memo(function SceneCard({
  scene,
  index,
  rangeStatus,
  isActive,
  backgroundMap,
  paletteMap,
  presetMap,
  onScrollToStart,
  onOpenScenePicker,
  onDeleteScene,
}: SceneCardProps) {
  const confirm = useConfirm();
  const background = backgroundMap.get(scene.background_id);
  const palette = paletteMap.get(scene.palette_id);
  const preset = scene.based_on_preset_id
    ? presetMap.get(scene.based_on_preset_id)
    : undefined;

  const rangeText = rangeStatus.valid
    ? rangeStatus.startIndex === rangeStatus.endIndex
      ? `#${rangeStatus.startIndex + 1}`
      : `#${rangeStatus.startIndex + 1} → #${rangeStatus.endIndex + 1}`
    : "Dải không hợp lệ";
  const sceneLabel = preset?.label || background?.label || `Scene #${index + 1}`;
  const hasAudio = scene.effects?.some(
    (effect) => effect.type === "audio" || effect.category === "audio"
  );
  const visualEffectsCount =
    scene.effects?.filter(
      (effect) => effect.type !== "audio" && effect.category !== "audio"
    ).length || 0;

  return (
    <article
      className={`group rounded-2xl border p-3 transition-[background-color,border-color,box-shadow] duration-200 motion-reduce:transition-none relative overflow-hidden flex flex-col gap-2.5 ${
        !rangeStatus.valid
          ? "bg-destructive/10 border-destructive/60"
          : isActive
            ? "bg-primary/10 border-primary ring-2 ring-primary/30 shadow-md"
            : "bg-secondary/30 border-border/70 hover:bg-secondary/60 hover:border-primary/40 hover:shadow-xs"
      }`}
    >
      <button
        type="button"
        onClick={() => onScrollToStart(scene.start_block_id)}
        disabled={!rangeStatus.valid}
        aria-current={isActive ? "true" : undefined}
        aria-label={`${sceneLabel}, ${rangeText}. Xem vị trí trong chương`}
        className={`w-full rounded-xl text-left cursor-pointer disabled:cursor-not-allowed ${focusRing}`}
      >
        <div className="flex items-center justify-between gap-1.5">
          <div className="flex items-center gap-1.5">
            {rangeStatus.valid ? (
              <span className="w-2 h-2 rounded-full bg-accent shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
            )}
            <span className="font-bold text-xs text-foreground">
              Scene {index + 1}
            </span>
          </div>
          <span className="text-[11px] font-mono font-bold px-2 py-1 rounded-full bg-background/90 border border-border/80 text-muted-foreground">
            {rangeText}
          </span>
        </div>

        <div className="flex items-start gap-2.5 mt-2.5">
          <div className="w-14 h-11 rounded-lg overflow-hidden border border-border/60 bg-background shrink-0 relative">
            {background?.type === "gradient" && (
              <div className="w-full h-full" style={{ background: background.value }} />
            )}
            {background?.type === "image" && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={background.value}
                alt=""
                className="w-full h-full object-cover"
              />
            )}
            {background?.type === "video" && (
              <div className="w-full h-full bg-slate-900 flex items-center justify-center text-cyan-400">
                <Film className="w-4 h-4" aria-hidden="true" />
              </div>
            )}
            {background?.type === "particle_composition" && (
              <div className="w-full h-full bg-emerald-950 flex items-center justify-center text-emerald-400">
                <Sparkles className="w-4 h-4" aria-hidden="true" />
              </div>
            )}
            {!background && <div className="w-full h-full bg-secondary/50" />}
          </div>

          <div className="flex-1 min-w-0">
            <h4 className="text-xs font-semibold text-foreground truncate group-hover:text-primary transition-colors motion-reduce:transition-none">
              {sceneLabel}
            </h4>
            {!rangeStatus.valid && (
              <p className="mt-1 text-[11px] text-destructive">
                Scene cần được sửa hoặc xóa trước khi lưu.
              </p>
            )}
            <div className="flex items-center gap-2 mt-1.5">
              {palette && (
                <span
                  className="flex items-center gap-1 p-1 rounded bg-background/80 border border-border/50"
                  title={`Bảng màu: ${palette.label}`}
                >
                  {[palette.colors.primary, palette.colors.accent, palette.colors.secondary].map(
                    (color, swatchIndex) => (
                      <span
                        key={`${color}-${swatchIndex}`}
                        className="w-2 h-2 rounded-full border border-white/20"
                        style={{ backgroundColor: color }}
                      />
                    )
                  )}
                </span>
              )}
              {hasAudio && (
                <span className="p-1 rounded bg-cyan-500/10 text-cyan-500" title="Có nhạc nền">
                  <Volume2 className="w-3 h-3" aria-hidden="true" />
                </span>
              )}
              {visualEffectsCount > 0 && (
                <span
                  className="p-1 rounded bg-amber-500/10 text-amber-500 text-[10px] flex items-center gap-1 font-mono"
                  title={`${visualEffectsCount} hiệu ứng không gian`}
                >
                  <Sparkles className="w-3 h-3" aria-hidden="true" />
                  {visualEffectsCount}
                </span>
              )}
            </div>
          </div>
        </div>
      </button>

      <div className="flex items-center justify-between pt-2 border-t border-border/50 text-[11px]">
        <button
          type="button"
          onClick={() => onScrollToStart(scene.start_block_id)}
          disabled={!rangeStatus.valid}
          className={`min-h-[44px] px-2 rounded-lg text-muted-foreground hover:text-foreground disabled:opacity-50 flex items-center gap-1 cursor-pointer disabled:cursor-not-allowed transition-colors motion-reduce:transition-none ${focusRing}`}
        >
          <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Xem vị trí</span>
        </button>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() =>
              onOpenScenePicker(scene.start_block_id, scene.end_block_id, scene)
            }
            disabled={!rangeStatus.valid}
            className={`min-h-[44px] min-w-[44px] rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 disabled:opacity-50 transition-colors motion-reduce:transition-none cursor-pointer disabled:cursor-not-allowed flex items-center justify-center ${focusRing}`}
            aria-label={`Chỉnh sửa ${sceneLabel}`}
          >
            <Edit2 className="w-4 h-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={async () => {
              const ok = await confirm({
                title: "Xóa Scene bối cảnh?",
                description:
                  "Scene này sẽ bị gỡ khỏi dải block tương ứng. Bạn có chắc chắn muốn tiếp tục?",
                variant: "danger",
                confirmText: "Xóa Scene",
                cancelText: "Hủy bỏ",
              });
              if (ok) onDeleteScene(scene.id);
            }}
            className={`min-h-[44px] min-w-[44px] rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors motion-reduce:transition-none cursor-pointer flex items-center justify-center ${focusRing}`}
            aria-label={`Xóa ${sceneLabel}`}
          >
            <Trash2 className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </article>
  );
});
