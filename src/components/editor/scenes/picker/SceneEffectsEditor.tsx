// src/components/editor/scenes/picker/SceneEffectsEditor.tsx
// Bước 3: Hiệu Ứng Không Gian Đa Tầng — Dropdown thu gọn, chip hiệu ứng nằm cạnh dropdown, nút "Xóa tất cả" và Popover chống tràn màn hình (Task 3)

"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { EffectConfig, EffectType } from "@/types/story";
import {
  EFFECT_METADATA,
  getEffectIcon,
  isSceneEffectType,
} from "@/lib/effects/effectCatalog";
import { createEffectConfig } from "@/lib/effects/effectFactory";
import { Sparkles, X, Trash2 } from "lucide-react";
import SearchableCombobox, { ComboboxOption } from "@/components/ui/SearchableCombobox";
import {
  EffectConfigForm,
  type EffectConfigUpdate,
} from "@/components/editor/effects/EffectConfigForm";

export interface SceneEffectsEditorProps {
  ambientEffects: EffectConfig[];
  onChangeEffects: (effects: EffectConfig[]) => void;
  isLoop?: boolean;
}

export const SceneEffectsEditor = React.memo(function SceneEffectsEditor({
  ambientEffects,
  onChangeEffects,
  isLoop = true,
}: SceneEffectsEditorProps) {
  const [editingEffectId, setEditingEffectId] = useState<string | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const badgeRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number; width: number } | null>(null);

  const effectComboboxOptions: ComboboxOption[] = Object.values(EFFECT_METADATA)
    .filter((meta) => isSceneEffectType(meta.type))
    .map((meta) => {
      const Icon = getEffectIcon(meta.type, meta.category);
      return {
        id: meta.type,
        label: meta.label.split(" (")[0],
        description: meta.description,
        searchTexts: [meta.label, meta.description, meta.category, meta.type],
        icon: Icon,
      };
    });

  // Calculate and clamp popover position so it NEVER overflows or clips
  const updatePopoverPosition = useCallback(() => {
    if (!editingEffectId) {
      setPopoverPos(null);
      return;
    }

    const badgeEl = badgeRefs.current[editingEffectId];
    if (!badgeEl) return;

    const badgeRect = badgeEl.getBoundingClientRect();
    const viewportPadding = 12;
    const popoverWidth = Math.min(330, window.innerWidth - viewportPadding * 2);
    const left = Math.min(
      Math.max(viewportPadding, badgeRect.left),
      window.innerWidth - popoverWidth - viewportPadding
    );
    const estimatedHeight = Math.min(560, window.innerHeight - viewportPadding * 2);
    const fitsBelow =
      window.innerHeight - badgeRect.bottom - viewportPadding >= estimatedHeight;
    const top = fitsBelow
      ? badgeRect.bottom + 8
      : Math.max(viewportPadding, badgeRect.top - estimatedHeight - 8);

    setPopoverPos({ top, left, width: popoverWidth });
  }, [editingEffectId]);

  useEffect(() => {
    if (!editingEffectId) {
      setPopoverPos(null);
      return;
    }

    const animId = requestAnimationFrame(() => {
      updatePopoverPosition();
    });

    window.addEventListener("resize", updatePopoverPosition);
    window.addEventListener("scroll", updatePopoverPosition, true);
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", updatePopoverPosition);
      window.removeEventListener("scroll", updatePopoverPosition, true);
    };
  }, [editingEffectId, updatePopoverPosition]);

  // Close popover when clicking outside
  useEffect(() => {
    if (!editingEffectId) return;

    function handlePointerDown(e: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        !Object.values(badgeRefs.current).some((el) => el?.contains(e.target as Node))
      ) {
        setEditingEffectId(null);
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setEditingEffectId(null);
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [editingEffectId]);

  const handleAddEffect = (type: string) => {
    const existing = ambientEffects.find((e) => e.type === type);
    if (existing) {
      setEditingEffectId(existing.id);
      return;
    }

    const newEffect = createEffectConfig(type as EffectType, {
      loop: isLoop,
    });

    onChangeEffects([...ambientEffects, newEffect]);
    setEditingEffectId(newEffect.id);
  };

  const handleRemoveEffect = (id: string) => {
    onChangeEffects(ambientEffects.filter((e) => e.id !== id));
    if (editingEffectId === id) setEditingEffectId(null);
  };

  const handleClearAllEffects = () => {
    onChangeEffects([]);
    setEditingEffectId(null);
  };

  const handleUpdateEffect = (id: string, update: EffectConfigUpdate) => {
    onChangeEffects(
      ambientEffects.map((effect) =>
        effect.id === id
          ? createEffectConfig(effect.type, { ...effect, ...update })
          : effect
      )
    );
  };

  const activeEditingEffect = ambientEffects.find((e) => e.id === editingEffectId);

  return (
    <div
      className="p-5 rounded-2xl bg-secondary/30 border border-border/60 space-y-4 relative font-editor"
    >
      <div className="flex items-center justify-between">
        <label className="text-sm font-bold text-foreground flex items-center gap-2 font-ui">
          3. Hiệu Ứng Không Gian Đa Tầng (Tùy Chọn)
        </label>

        {/* Nút Xóa tất cả khi có hiệu ứng */}
        {ambientEffects.length > 0 && (
          <button
            type="button"
            onClick={handleClearAllEffects}
            className="px-2.5 py-1 rounded-lg text-xs font-semibold text-destructive hover:bg-destructive/10 border border-destructive/20 flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Xóa toàn bộ hiệu ứng không gian đã chọn"
            aria-label="Xóa tất cả hiệu ứng"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Xóa tất cả</span>
          </button>
        )}
      </div>

      {/* Row chứa Dropdown thu gọn & Chip hiệu ứng xuất hiện bên cạnh */}
      <div className="flex flex-wrap items-end gap-3">
        {/* Dropdown thu gọn */}
        <div className="w-full sm:w-72 shrink-0">
          <SearchableCombobox
            label="Thêm Hiệu Ứng Vào Bối Cảnh"
            icon={Sparkles}
            options={effectComboboxOptions}
            value=""
            onSelect={handleAddEffect}
            placeholder="+ Thêm hiệu ứng..."
            searchPlaceholder="Tìm hiệu ứng..."
          />
        </div>

        {/* Danh Sách Chip Hiệu Ứng Đã Chọn nằm bên cạnh dropdown */}
        {ambientEffects.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0 pb-0.5">
            {ambientEffects.map((eff) => {
              const Icon = getEffectIcon(eff.type, eff.category);
              const meta = EFFECT_METADATA[eff.type];
              const effectLabel = meta?.label?.split(" (")[0] || eff.type;
              const isEditing = editingEffectId === eff.id;

              return (
                <div
                  key={eff.id}
                  className={`rounded-xl border text-xs font-semibold flex items-stretch overflow-hidden transition-all ${isEditing
                    ? "bg-primary text-editor-action-foreground border-primary shadow-sm ring-2 ring-primary/30"
                    : "bg-card border-border text-foreground hover:border-primary/50 hover:bg-secondary/40"
                    }`}
                >
                  <button
                    type="button"
                    ref={(element) => {
                      badgeRefs.current[eff.id] = element;
                    }}
                    onClick={() => setEditingEffectId(isEditing ? null : eff.id)}
                    aria-expanded={isEditing}
                    className="flex min-h-8 items-center gap-2 px-3 py-1.5 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                  >
                    <Icon className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>{effectLabel}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemoveEffect(eff.id)}
                    className="flex min-h-8 min-w-8 items-center justify-center border-l border-current/15 text-current hover:text-destructive hover:bg-secondary transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                    title="Xóa hiệu ứng"
                    aria-label="Xóa hiệu ứng"
                  >
                    <X className="w-3 h-3" aria-hidden="true" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Popover Chỉnh Thông Số Chống Tràn Màn Hình */}
      {activeEditingEffect && popoverPos && (() => {
        const Icon = getEffectIcon(activeEditingEffect.type, activeEditingEffect.category);
        const meta = EFFECT_METADATA[activeEditingEffect.type];
        const effectLabel = meta?.label?.split(" (")[0] || activeEditingEffect.type;

        return createPortal(
          <div
            ref={popoverRef}
            style={{
              top: `${popoverPos.top}px`,
              left: `${popoverPos.left}px`,
              width: `${popoverPos.width}px`,
              maxHeight: `calc(100vh - ${popoverPos.top + 12}px)`,
            }}
            className="fixed z-[110] overflow-y-auto p-4 rounded-2xl bg-card border border-border shadow-2xl space-y-3.5 animate-scale-in text-foreground font-editor"
          >
            {/* Popover Header */}
            <div className="flex items-center justify-between pb-2 border-b border-border/60">
              <div className="flex items-center gap-2">
                <Icon className="w-4 h-4 text-primary" />
                <span className="font-bold text-xs font-editor">{effectLabel}</span>
              </div>
              <button
                type="button"
                onClick={() => setEditingEffectId(null)}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer"
                aria-label="Đóng bảng chỉnh sửa"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <EffectConfigForm
              effect={activeEditingEffect}
              embedded
              onChange={(update) =>
                handleUpdateEffect(activeEditingEffect.id, update)
              }
            />

            {/* Popover Actions */}
            <div className="flex items-center justify-end pt-2 border-t border-border/60">
              <button
                type="button"
                onClick={() => setEditingEffectId(null)}
                className="px-4 py-1.5 rounded-lg bg-primary hover:bg-primary-hover text-editor-action-foreground text-xs font-semibold cursor-pointer transition-colors shadow-xs"
              >
                Xong
              </button>
            </div>
          </div>,
          document.body
        );
      })()}
    </div>
  );
});

export default SceneEffectsEditor;
