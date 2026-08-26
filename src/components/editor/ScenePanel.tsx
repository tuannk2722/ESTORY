// components/editor/ScenePanel.tsx
// Phase 2: Cột Quản Lý Bối Cảnh (Scenes) bên trái Editor — hỗ trợ đóng/mở, hiển thị trực quan và chọn dải block
"use client";

import React, { useState, useEffect } from "react";
import { StoryBlock } from "@/types/story";
import { Scene, BackgroundAsset, ColorPalette, ScenePreset } from "@/types/scene";
import {
  Layers,
  Plus,
  Trash2,
  Edit2,
  X,
  Check,
  Sparkles,
  Volume2,
  Film,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { useConfirm } from "@/components/ui/ConfirmModal";

export interface ScenePanelProps {
  scenes: Scene[];
  blocks: StoryBlock[];
  activeBlockId?: string | null;
  onSelectBlock: (blockId: string) => void;
  onOpenScenePicker: (startBlockId: string, endBlockId: string, sceneToEdit?: Scene | null) => void;
  onDeleteScene: (sceneId: string) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  isSelectingRange: boolean;
  setIsSelectingRange: (val: boolean) => void;
  rangeStartId: string | null;
  setRangeStartId: (id: string | null) => void;
  rangeEndId: string | null;
  setRangeEndId: (id: string | null) => void;
}

export default function ScenePanel({
  scenes = [],
  blocks = [],
  activeBlockId,
  onSelectBlock,
  onOpenScenePicker,
  onDeleteScene,
  isCollapsed,
  onToggleCollapse,
  isSelectingRange,
  setIsSelectingRange,
  rangeStartId,
  setRangeStartId,
  rangeEndId,
  setRangeEndId,
}: ScenePanelProps) {
  const confirm = useConfirm();

  // Scene library data for rich preview
  const [library, setLibrary] = useState<{
    backgrounds: BackgroundAsset[];
    palettes: ColorPalette[];
    scenePresets: ScenePreset[];
  }>({
    backgrounds: [],
    palettes: [],
    scenePresets: [],
  });

  useEffect(() => {
    let mounted = true;
    async function loadLib() {
      try {
        const res = await fetch("/api/scene-library");
        if (res.ok) {
          const data = await res.json();
          if (mounted) {
            setLibrary({
              backgrounds: data.backgrounds || [],
              palettes: data.palettes || [],
              scenePresets: data.scenePresets || [],
            });
          }
        }
      } catch (err) {
        console.error("Failed to load scene library for ScenePanel:", err);
      }
    }
    loadLib();
    return () => {
      mounted = false;
    };
  }, []);

  const handleScrollToBlock = (blockId: string) => {
    onSelectBlock(blockId);
    if (typeof window !== "undefined") {
      const element = document.getElementById(blockId);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  };

  const handleStartRangeSelection = () => {
    setIsSelectingRange(true);
    setRangeStartId(null);
    setRangeEndId(null);
  };

  const cancelRangeSelection = () => {
    setIsSelectingRange(false);
    setRangeStartId(null);
    setRangeEndId(null);
  };

  const handleConfirmRange = () => {
    if (!rangeStartId) {
      toast.error("Vui lòng chọn ít nhất một block bắt đầu.");
      return;
    }

    const effectiveEndId = rangeEndId || rangeStartId;

    const sIdx = blocks.findIndex((b) => b.id === rangeStartId);
    const eIdx = blocks.findIndex((b) => b.id === effectiveEndId);
    const startIndex = Math.min(sIdx, eIdx);
    const endIndex = Math.max(sIdx, eIdx);

    // Kiểm tra chồng lấn với Scene khác
    const hasOverlap = scenes.some((scene) => {
      const sceneStart = blocks.findIndex((b) => b.id === scene.start_block_id);
      const sceneEnd = blocks.findIndex((b) => b.id === scene.end_block_id);
      const minS = Math.min(sceneStart, sceneEnd);
      const maxS = Math.max(sceneStart, sceneEnd);
      return Math.max(startIndex, minS) <= Math.min(endIndex, maxS);
    });

    if (hasOverlap) {
      toast.error("Dải block đã chọn bị chồng lấn với một Scene đã có trong chương này!");
      return;
    }

    const finalStartId = blocks[startIndex].id;
    const finalEndId = blocks[endIndex].id;

    setIsSelectingRange(false);
    setRangeStartId(null);
    setRangeEndId(null);

    if (onOpenScenePicker) {
      onOpenScenePicker(finalStartId, finalEndId, null);
    }
  };

  // ── 1. COLLAPSED VIEW (Cột thu gọn tinh gọn ~52px) ──
  if (isCollapsed) {
    return (
      <aside className="w-13 rounded-3xl border border-border bg-card/85 p-2 backdrop-blur-xl shadow-xl flex flex-col items-center gap-3 transition-all duration-300 max-h-[calc(100vh-6rem)]">
        {/* Toggle Expand button */}
        <button
          type="button"
          onClick={onToggleCollapse}
          className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer"
          title="Mở rộng danh sách Bối Cảnh (Scenes)"
          aria-label="Mở rộng danh sách Bối Cảnh"
        >
          <ChevronRight className="w-5 h-5 text-primary" />
        </button>

        {/* Scene Count Badge */}
        <div
          className="flex flex-col items-center gap-1 cursor-pointer"
          onClick={onToggleCollapse}
          title={`${scenes.length} bối cảnh (Click để mở)`}
        >
          <div className="p-2 rounded-xl bg-primary/10 text-primary">
            <Layers className="w-4 h-4" />
          </div>
          <span className="text-[11px] font-mono font-bold text-accent">
            {scenes.length}
          </span>
        </div>

        {/* Quick Add Button */}
        <button
          type="button"
          onClick={() => {
            onToggleCollapse();
            handleStartRangeSelection();
          }}
          className="p-2 rounded-xl bg-secondary/80 hover:bg-primary/20 text-muted-foreground hover:text-primary transition-colors cursor-pointer mt-1"
          title="Tạo Scene mới"
          aria-label="Tạo Scene mới"
        >
          <Plus className="w-4 h-4" />
        </button>

        {/* Mini Scene Dots */}
        <div className="flex flex-col gap-2 mt-2 max-h-64 overflow-y-auto custom-scrollbar w-full items-center">
          {scenes.map((scene, idx) => {
            const sIdx = blocks.findIndex((b) => b.id === scene.start_block_id);
            const eIdx = blocks.findIndex((b) => b.id === scene.end_block_id);
            const isInside =
              activeBlockId &&
              sIdx >= 0 &&
              eIdx >= 0 &&
              (() => {
                const curIdx = blocks.findIndex((b) => b.id === activeBlockId);
                return curIdx >= Math.min(sIdx, eIdx) && curIdx <= Math.max(sIdx, eIdx);
              })();

            return (
              <button
                key={scene.id}
                type="button"
                onClick={() => {
                  handleScrollToBlock(scene.start_block_id);
                }}
                className={`w-7 h-7 rounded-lg text-[10px] font-mono font-bold flex items-center justify-center border transition-all cursor-pointer ${
                  isInside
                    ? "bg-accent text-accent-foreground border-accent ring-2 ring-accent/30 scale-110"
                    : "bg-secondary/60 text-muted-foreground border-border hover:border-primary/50 hover:text-foreground"
                }`}
                title={`Scene ${idx + 1} (Block #${sIdx + 1} → #${eIdx + 1})`}
              >
                {idx + 1}
              </button>
            );
          })}
        </div>
      </aside>
    );
  }

  // ── 2. EXPANDED VIEW (Cột mở rộng đầy đủ chức năng) ──
  return (
    <aside className="w-full rounded-3xl border border-border bg-card/85 p-4 backdrop-blur-xl shadow-xl max-h-[calc(100vh-6rem)] flex flex-col transition-all duration-300 font-editor">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-border">
        <div className="flex items-center gap-2 text-foreground font-semibold text-sm">
          <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
            <Layers className="w-4 h-4" />
          </div>
          <span>Bối Cảnh (Scenes)</span>
          <span className="px-2 py-0.5 rounded-full bg-accent/15 text-accent text-[11px] font-mono font-bold">
            {scenes.length}
          </span>
        </div>

        {/* Collapse Button */}
        <button
          type="button"
          onClick={onToggleCollapse}
          className="p-1.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer"
          title="Thu gọn cột Bối Cảnh"
          aria-label="Thu gọn cột Bối Cảnh"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>

      {/* Action / Range Selector Section */}
      <div className="mb-3.5">
        {isSelectingRange ? (
          <div className="p-3 rounded-2xl bg-primary/10 border border-primary/30 space-y-2.5 animate-fade-in">
            <div className="text-xs font-semibold text-primary flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                Chọn dải block (2 bước)
              </span>
              <button
                type="button"
                onClick={cancelRangeSelection}
                className="text-muted-foreground hover:text-foreground p-1 rounded-md cursor-pointer"
                title="Hủy chọn"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <p className="text-[11px] text-muted-foreground leading-relaxed">
              {!rangeStartId ? (
                "1. Nhấp chọn block BẮT ĐẦU trong danh sách hoặc nội dung"
              ) : !rangeEndId ? (
                <span>
                  Đã chọn điểm đầu:{" "}
                  <strong className="text-primary font-mono">
                    #{blocks.findIndex((b) => b.id === rangeStartId) + 1}
                  </strong>
                  . Nhấp chọn block KẾT THÚC (hoặc bấm Tiếp tục cho 1 block).
                </span>
              ) : (
                (() => {
                  const sIdx = blocks.findIndex((b) => b.id === rangeStartId);
                  const eIdx = blocks.findIndex((b) => b.id === rangeEndId);
                  const minIdx = Math.min(sIdx, eIdx);
                  const maxIdx = Math.max(sIdx, eIdx);
                  return (
                    <span>
                      Đã chọn:{" "}
                      <strong className="text-primary font-mono">
                        #{minIdx + 1} → #{maxIdx + 1}
                      </strong>{" "}
                      ({maxIdx - minIdx + 1} đoạn văn)
                    </span>
                  );
                })()
              )}
            </p>

            <div className="flex gap-2 pt-0.5">
              <button
                type="button"
                disabled={!rangeStartId}
                onClick={handleConfirmRange}
                className="flex-1 py-1.5 px-3 rounded-xl bg-primary text-primary-foreground text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-40 cursor-pointer min-h-[34px] transition-all"
              >
                <Check className="w-3.5 h-3.5" />
                Tiếp Tục Tạo Scene
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleStartRangeSelection}
            className="w-full py-2.5 px-3 rounded-xl bg-secondary/60 hover:bg-primary/15 border border-dashed border-border hover:border-primary text-xs font-semibold text-foreground hover:text-primary transition-all flex items-center justify-center gap-2 cursor-pointer min-h-[40px] shadow-xs"
          >
            <Plus className="w-4 h-4 text-primary" />
            <span>Tạo Scene Cho Dải Block</span>
          </button>
        )}
      </div>

      {/* Scene Cards List */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-1 custom-scrollbar">
        {scenes.length === 0 ? (
          <div className="py-10 px-3 text-center rounded-2xl border border-dashed border-border/80 bg-secondary/10">
            <Layers className="w-7 h-7 text-muted-foreground/50 mx-auto mb-2" />
            <p className="text-xs font-medium text-foreground mb-1">Chưa có Scene nào</p>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Tạo Scene để áp dụng bối cảnh, bảng màu và nhạc nền cho dải block.
            </p>
          </div>
        ) : (
          scenes.map((scene, idx) => {
            const sIdx = blocks.findIndex((b) => b.id === scene.start_block_id);
            const eIdx = blocks.findIndex((b) => b.id === scene.end_block_id);
            const minIdx = Math.min(sIdx, eIdx);
            const maxIdx = Math.max(sIdx, eIdx);
            const blockCount = maxIdx - minIdx + 1;
            const rangeText =
              sIdx >= 0 && eIdx >= 0
                ? `#${minIdx + 1} → #${maxIdx + 1} (${blockCount} đoạn)`
                : "Dải block";

            // Resolve assets
            const preset = library.scenePresets.find((p) => p.id === scene.based_on_preset_id);
            const bg = library.backgrounds.find((b) => b.id === scene.background_id);
            const pal = library.palettes.find((p) => p.id === scene.palette_id);

            const sceneLabel =
              preset?.label || bg?.label || `Bối Cảnh ${idx + 1}`;

            const hasAudio = scene.effects?.some(
              (e) => e.type === "audio" || e.category === "audio"
            );
            const visualEffectsCount =
              scene.effects?.filter((e) => e.type !== "audio" && e.category !== "audio").length || 0;

            const isCurrentBlockInScene =
              activeBlockId &&
              (() => {
                const curIdx = blocks.findIndex((b) => b.id === activeBlockId);
                return curIdx >= minIdx && curIdx <= maxIdx;
              })();

            return (
              <div
                key={scene.id}
                onClick={() => handleScrollToBlock(scene.start_block_id)}
                className={`group rounded-2xl border p-3 transition-all duration-200 cursor-pointer relative overflow-hidden flex flex-col gap-2.5 ${
                  isCurrentBlockInScene
                    ? "bg-primary/10 border-primary ring-2 ring-primary/30 shadow-md"
                    : "bg-secondary/30 border-border/70 hover:bg-secondary/60 hover:border-primary/40 hover:shadow-sm"
                }`}
              >
                {/* Header: Scene Number + Block Range Badge */}
                <div className="flex items-center justify-between gap-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-accent shrink-0" />
                    <span className="font-bold text-xs text-foreground">
                      Scene {idx + 1}
                    </span>
                  </div>

                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-background/90 border border-border/80 text-muted-foreground">
                    {rangeText}
                  </span>
                </div>

                {/* Body: Thumbnail & Scene Details */}
                <div className="flex items-start gap-2.5">
                  {/* Thumbnail / Swatch */}
                  <div className="w-14 h-11 rounded-lg overflow-hidden border border-border/60 bg-background shrink-0 relative">
                    {bg?.type === "gradient" && (
                      <div className="w-full h-full" style={{ background: bg.value }} />
                    )}
                    {bg?.type === "image" && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={bg.value} alt={bg.label} className="w-full h-full object-cover" />
                    )}
                    {bg?.type === "video" && (
                      <div className="w-full h-full bg-slate-900 flex items-center justify-center text-[10px] text-cyan-400">
                        <Film className="w-3.5 h-3.5" />
                      </div>
                    )}
                    {bg?.type === "particle_composition" && (
                      <div className="w-full h-full bg-emerald-950 flex items-center justify-center text-[10px] text-emerald-400">
                        <Sparkles className="w-3.5 h-3.5" />
                      </div>
                    )}
                    {!bg && <div className="w-full h-full bg-secondary/50" />}
                  </div>

                  {/* Text Details */}
                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                      {sceneLabel}
                    </h4>

                    {/* Palette & Effects indicators */}
                    <div className="flex items-center gap-2 mt-1.5">
                      {/* Palette 3 dots */}
                      {pal && (
                        <div
                          className="flex items-center gap-1 p-0.5 rounded bg-background/80 border border-border/50"
                          title={`Bảng màu: ${pal.label}`}
                        >
                          <span
                            className="w-2 h-2 rounded-full border border-white/20"
                            style={{ backgroundColor: pal.colors.primary }}
                          />
                          <span
                            className="w-2 h-2 rounded-full border border-white/20"
                            style={{ backgroundColor: pal.colors.accent }}
                          />
                          <span
                            className="w-2 h-2 rounded-full border border-white/20"
                            style={{ backgroundColor: pal.colors.secondary }}
                          />
                        </div>
                      )}

                      {/* Audio Icon */}
                      {hasAudio && (
                        <span
                          className="p-0.5 px-1 rounded bg-cyan-500/10 text-cyan-500 text-[10px] flex items-center gap-0.5"
                          title="Có nhạc nền"
                        >
                          <Volume2 className="w-3 h-3" />
                        </span>
                      )}

                      {/* Visual particle badge */}
                      {visualEffectsCount > 0 && (
                        <span
                          className="p-0.5 px-1 rounded bg-amber-500/10 text-amber-500 text-[10px] flex items-center gap-0.5 font-mono"
                          title={`${visualEffectsCount} hiệu ứng không gian`}
                        >
                          <Sparkles className="w-3 h-3" />
                          <span>{visualEffectsCount}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Footer Actions */}
                <div
                  className="flex items-center justify-between pt-2 border-t border-border/50 text-[11px]"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={() => handleScrollToBlock(scene.start_block_id)}
                    className="text-muted-foreground hover:text-foreground flex items-center gap-1 cursor-pointer transition-colors py-0.5"
                    title="Cuộn tới đầu Scene"
                  >
                    <ExternalLink className="w-3 h-3" />
                    <span>Xem vị trí</span>
                  </button>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        if (onOpenScenePicker) {
                          onOpenScenePicker(scene.start_block_id, scene.end_block_id, scene);
                        }
                      }}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors cursor-pointer"
                      title="Chỉnh sửa Scene"
                      aria-label="Chỉnh sửa Scene"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={async () => {
                        const ok = await confirm({
                          title: "Xóa Scene bối cảnh?",
                          description: "Scene này sẽ bị gỡ khỏi dải block tương ứng. Bạn có chắc chắn muốn tiếp tục?",
                          variant: "danger",
                          confirmText: "Xóa Scene",
                          cancelText: "Hủy bỏ",
                        });
                        if (ok && onDeleteScene) {
                          onDeleteScene(scene.id);
                        }
                      }}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer min-h-[32px] min-w-[32px] flex items-center justify-center"
                      title="Xóa Scene"
                      aria-label="Xóa Scene"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
}
