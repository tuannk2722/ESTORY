// components/editor/BlockEditor.tsx
// Phase 2: Author Editor - Chỉnh sửa nội dung từng block và gắn effect (US-2.1, US-2.2, US-2.3)
"use client";

import React, { useState, useRef, useCallback } from "react";
import { StoryBlock, EffectConfig, EffectType } from "@/types/story";
import { suggestEffectsForText, EffectSuggestion } from "@/lib/effectSuggestion";
import { getEffectIcon, EFFECT_METADATA, AUDIO_EFFECT_PRESETS } from "./effect-meta";
import EffectPicker from "./EffectPicker";
import Popconfirm from "@/components/ui/Popconfirm";
import { toast } from "sonner";
import {
  GripVertical,
  Trash2,
  Plus,
  Sparkles,
  X,
  Type,
  MessageSquare,
  Heading as HeadingIcon,
} from "lucide-react";

export interface BlockEditorProps {
  chapterId: string;
  blocks: StoryBlock[];
  onUpdateBlocks: (blocks: StoryBlock[]) => void;
  activeBlockId?: string | null;
  onSelectBlock?: (blockId: string | null) => void;
}

type DropTarget = { index: number; position: "before" | "after" };

export default function BlockEditor({
  chapterId,
  blocks,
  onUpdateBlocks,
  activeBlockId,
  onSelectBlock,
}: BlockEditorProps) {
  // Modal state cho EffectPicker
  const [pickerOpen, setPickerOpen] = useState<boolean>(false);
  const [targetBlockId, setTargetBlockId] = useState<string | null>(null);
  const [editingEffect, setEditingEffect] = useState<EffectConfig | null>(null);
  const [suggestedType, setSuggestedType] = useState<EffectType | null>(null);
  const [blurredBlockIds, setBlurredBlockIds] = useState<Set<string>>(new Set());

  // ===== Drag & Drop state =====
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);

  // Chỉ cho phép bắt đầu kéo khi nhấn giữ đúng tay cầm (GripVertical),
  const dragHandleActiveRef = useRef(false);
  // Bản sao "tức thời" của dropTarget để đọc được ngay trong handleDrop,
  // không phải chờ setState/re-render (tránh miss 1 frame)
  const dropTargetRef = useRef<DropTarget | null>(null);
  // Chặn spam setState: handleDragOver bắn rất nhiều lần/giây, ta gom lại theo rAF
  const rafDragOverId = useRef<number | null>(null);
  // Auto-scroll khi kéo sát mép màn hình
  const rafScrollId = useRef<number | null>(null);
  const pointerYRef = useRef<number>(0);

  const resetDragState = useCallback(() => {
    setDraggedIndex(null);
    setDropTarget(null);
    dropTargetRef.current = null;
    dragHandleActiveRef.current = false;
    if (rafDragOverId.current !== null) {
      cancelAnimationFrame(rafDragOverId.current);
      rafDragOverId.current = null;
    }
  }, []);

  // Auto-scroll khi kéo block sát mép trên hoặc dưới màn hình
  React.useEffect(() => {
    if (draggedIndex === null) return;

    // Khoá cuộn trang + chọn văn bản khi đang kéo
    const previousUserSelect = document.body.style.userSelect;
    document.body.style.userSelect = "none";

    const EDGE_SIZE = 120; // px: vùng kích hoạt tính từ mép trên/dưới viewport
    const MAX_SPEED = 30; // px/frame: tốc độ cuộn tối đa ngay sát mép

    const handleWindowDragOver = (e: DragEvent) => {
      pointerYRef.current = e.clientY;
    };

    const tick = () => {
      const y = pointerYRef.current;
      const viewportHeight = window.innerHeight;
      let speed = 0;

      if (y > 0 && y < EDGE_SIZE) {
        const ratio = 1 - y / EDGE_SIZE; // 0 -> 1 khi tiến gần mép trên
        speed = -Math.pow(ratio, 2) * MAX_SPEED;
      } else if (y > viewportHeight - EDGE_SIZE) {
        const ratio = 1 - (viewportHeight - y) / EDGE_SIZE; // 0 -> 1 khi tiến gần mép dưới
        speed = Math.pow(ratio, 2) * MAX_SPEED;
      }

      if (speed !== 0) {
        window.scrollBy(0, speed);
      }

      rafScrollId.current = requestAnimationFrame(tick);
    };

    window.addEventListener("dragover", handleWindowDragOver);
    rafScrollId.current = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("dragover", handleWindowDragOver);
      if (rafScrollId.current !== null) {
        cancelAnimationFrame(rafScrollId.current);
        rafScrollId.current = null;
      }
      document.body.style.userSelect = previousUserSelect;
    };
  }, [draggedIndex]);

  // Thêm block mới
  const handleAddBlock = (index: number) => {
    const newBlockId = `${chapterId}-block-${Date.now().toString().slice(-6)}`;
    const newBlock: StoryBlock = {
      id: newBlockId,
      type: "paragraph",
      text: "",
      mood_tag: "",
      effects: [],
    };
    const updated = [...blocks];
    updated.splice(index + 1, 0, newBlock);
    onUpdateBlocks(updated);
    if (onSelectBlock) onSelectBlock(newBlockId);
  };

  // Xóa block
  const handleDeleteBlock = (blockId: string) => {
    if (blocks.length <= 1) {
      toast.error("Chương truyện cần có tối thiểu 1 block.");
      return;
    }
    const updated = blocks.filter((b) => b.id !== blockId);
    onUpdateBlocks(updated);
    if (activeBlockId === blockId && onSelectBlock) {
      onSelectBlock(null);
    }
    toast.success("Đã xóa đoạn văn.");
  };

  // ===== Drag and drop reorder =====

  // Chỉ kích hoạt khi nhấn giữ tay cầm
  const handleHandlePointerDown = () => {
    dragHandleActiveRef.current = true;
  };
  const handleHandlePointerUp = () => {
    dragHandleActiveRef.current = false;
  };

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    if (!dragHandleActiveRef.current) {
      e.preventDefault();
      return;
    }
    e.dataTransfer.effectAllowed = "move";
    setDraggedIndex(index);

    // Ảnh xem trước tùy chỉnh: nhẹ, hơi mờ, hơi nghiêng - thay cho ảnh chụp mặc định của trình duyệt
    const cardEl = e.currentTarget;
    const ghost = cardEl.cloneNode(true) as HTMLElement;
    ghost.style.width = `${cardEl.offsetWidth}px`;
    ghost.style.position = "absolute";
    ghost.style.top = "-9999px";
    ghost.style.left = "-9999px";
    ghost.style.opacity = "0.85";
    ghost.style.transform = "rotate(1.5deg)";
    ghost.style.pointerEvents = "none";
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, 28, 28);
    requestAnimationFrame(() => {
      if (ghost.parentNode) document.body.removeChild(ghost);
    });
  };

  // Xác định thả TRƯỚC hay SAU block đang hover, dựa trên điểm giữa của card,
  // và gom nhiều event `dragover` liên tiếp lại trong 1 khung hình (rAF) để tránh setState dồn dập.
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    e.preventDefault();
    if (draggedIndex === null) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const midpoint = rect.top + rect.height / 2;
    const position: DropTarget["position"] = e.clientY < midpoint ? "before" : "after";
    const next: DropTarget = { index, position };

    const current = dropTargetRef.current;
    if (current && current.index === next.index && current.position === next.position) {
      return; // không đổi gì so với lần trước -> bỏ qua, tránh render thừa
    }
    dropTargetRef.current = next;

    if (rafDragOverId.current !== null) return;
    rafDragOverId.current = requestAnimationFrame(() => {
      setDropTarget(dropTargetRef.current);
      rafDragOverId.current = null;
    });
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const target = dropTargetRef.current;

    if (draggedIndex !== null && target) {
      let insertAt = target.position === "before" ? target.index : target.index + 1;
      if (insertAt > draggedIndex) insertAt -= 1; // bù trừ vị trí sau khi phần tử gốc bị lấy ra

      if (insertAt !== draggedIndex) {
        const updated = [...blocks];
        const [movedItem] = updated.splice(draggedIndex, 1);
        updated.splice(insertAt, 0, movedItem);
        onUpdateBlocks(updated);
      }
    }

    resetDragState();
  };

  const handleDragEnd = () => {
    // Phòng trường hợp thả ra ngoài mọi vùng hợp lệ (drop không bắn) - vẫn phải dọn state
    resetDragState();
  };

  // Cập nhật text hoặc type của block
  const handleUpdateBlockField = (
    blockId: string,
    field: keyof StoryBlock,
    value: unknown
  ) => {
    const updated = blocks.map((b) => {
      if (b.id === blockId) {
        return { ...b, [field]: value };
      }
      return b;
    });
    onUpdateBlocks(updated);
  };

  // Mở picker thêm effect mới
  const handleOpenAddEffect = (blockId: string, preset?: EffectType) => {
    setTargetBlockId(blockId);
    setEditingEffect(null);
    setSuggestedType(preset || null);
    setPickerOpen(true);
  };

  // Mở picker sửa effect đã có
  const handleOpenEditEffect = (blockId: string, effect: EffectConfig) => {
    setTargetBlockId(blockId);
    setEditingEffect(effect);
    setSuggestedType(null);
    setPickerOpen(true);
  };

  // Lưu effect vào block
  const handleSaveEffect = (effect: EffectConfig) => {
    if (!targetBlockId) return;
    const updated = blocks.map((b) => {
      if (b.id === targetBlockId) {
        const effects = [...b.effects];
        const existingIdx = effects.findIndex((e) => e.id === effect.id);
        if (existingIdx >= 0) {
          effects[existingIdx] = effect;
        } else {
          effects.push(effect);
        }
        return { ...b, effects };
      }
      return b;
    });
    onUpdateBlocks(updated);
  };

  // Xóa effect khỏi block
  const handleDeleteEffect = (blockId: string, effectId: string) => {
    const updated = blocks.map((b) => {
      if (b.id === blockId) {
        return { ...b, effects: b.effects.filter((e) => e.id !== effectId) };
      }
      return b;
    });
    onUpdateBlocks(updated);
  };

  return (
    <div className="block-editor-container space-y-2 pb-20">
      {blocks.map((block, index) => {
        const suggestions: EffectSuggestion[] = suggestEffectsForText(block.text);
        const isSelected = activeBlockId === block.id;
        const isBeingDragged = draggedIndex === index;
        const showIndicatorBefore =
          dropTarget?.index === index && dropTarget.position === "before" && draggedIndex !== index;
        const showIndicatorAfter =
          dropTarget?.index === index && dropTarget.position === "after" && draggedIndex !== index;

        return (
          <React.Fragment key={block.id}>
            {/* Đường chỉ báo vị trí thả - phía trên block */}
            <div
              aria-hidden
              className={`mx-2 rounded-full bg-primary shadow-[0_0_10px_rgba(0,0,0,0.15)] shadow-primary/50 transition-all duration-150 ease-out ${showIndicatorBefore ? "h-1 my-1 opacity-100 scale-x-100" : "h-0 my-0 opacity-0 scale-x-95"
                }`}
            />

            {/* Block Card */}
            <div
              id={block.id}
              draggable
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDrop={handleDrop}
              onDragEnd={handleDragEnd}
              onClick={(e) => {
                e.stopPropagation();
                if (onSelectBlock) onSelectBlock(block.id);
              }}
              className={`block-card transition-all duration-200 ease-out rounded-2xl border p-5 bg-card/90 shadow-md ${isSelected
                ? "border-primary ring-2 ring-primary/30"
                : "border-border hover:border-border/80"
                } ${isBeingDragged ? "opacity-50 scale-[0.98] shadow-lg" : "opacity-100 scale-100"}`}
            >
              {/* Block Header Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-3 border-b border-border/60">
                <div className="flex items-center gap-2">
                  {/* Drag Handle for Reordering - điểm khởi tạo kéo DUY NHẤT */}
                  <div
                    onMouseDown={handleHandlePointerDown}
                    onMouseUp={handleHandlePointerUp}
                    onMouseLeave={handleHandlePointerUp}
                    onTouchStart={handleHandlePointerDown}
                    onTouchEnd={handleHandlePointerUp}
                    className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary cursor-grab active:cursor-grabbing transition-colors flex items-center justify-center min-h-[44px] min-w-[44px]"
                    title="Kéo thả để sắp xếp lại vị trí"
                    aria-label="Kéo thả để sắp xếp lại vị trí"
                  >
                    <GripVertical className="w-4 h-4" />
                  </div>

                  <span className="text-xs font-mono font-semibold px-2 py-1 rounded bg-secondary text-secondary-foreground">
                    #{index + 1}
                  </span>

                  {/* Block Type Selector */}
                  <div className="flex items-center gap-1 bg-secondary/50 p-1 rounded-lg border border-border/40">
                    <button
                      type="button"
                      onClick={() => handleUpdateBlockField(block.id, "type", "paragraph")}
                      className={`px-2.5 py-1 text-xs font-medium rounded flex items-center gap-1.5 transition-colors cursor-pointer min-h-[32px] ${block.type === "paragraph"
                        ? "bg-editor-action text-editor-action-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                        }`}
                      aria-pressed={block.type === "paragraph"}
                    >
                      <Type className="w-3.5 h-3.5" />
                      Đoạn Văn
                    </button>
                    <button
                      type="button"
                      onClick={() => handleUpdateBlockField(block.id, "type", "dialogue")}
                      className={`px-2.5 py-1 text-xs font-medium rounded flex items-center gap-1.5 transition-colors cursor-pointer min-h-[32px] ${block.type === "dialogue"
                        ? "bg-editor-action text-editor-action-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                        }`}
                      aria-pressed={block.type === "dialogue"}
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      Đối Thoại
                    </button>
                    <button
                      type="button"
                      onClick={() => handleUpdateBlockField(block.id, "type", "heading")}
                      className={`px-2.5 py-1 text-xs font-medium rounded flex items-center gap-1.5 transition-colors cursor-pointer min-h-[32px] ${block.type === "heading"
                        ? "bg-editor-action text-editor-action-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                        }`}
                      aria-pressed={block.type === "heading"}
                    >
                      <HeadingIcon className="w-3.5 h-3.5" />
                      Tiêu Đề
                    </button>
                  </div>
                </div>

                {/* Delete Button with Smart Popconfirm */}
                {(() => {
                  const isBlockEmpty =
                    !block.text?.trim() &&
                    (!block.effects || block.effects.length === 0) &&
                    !block.mood_tag;

                  return (
                    <Popconfirm
                      title="Xóa đoạn văn?"
                      description="Đoạn văn này sẽ bị xóa khỏi chương"
                      shouldConfirm={!isBlockEmpty}
                      onConfirm={() => handleDeleteBlock(block.id)}
                      variant="danger"
                      confirmText="Xóa"
                      cancelText="Hủy"
                    >
                      <button
                        type="button"
                        className="p-2 rounded-lg text-muted-foreground hover:bg-red-50 hover:text-destructive hover:bg-destructive/15 border border-transparent hover:border-destructive/30 transition-all duration-200 cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center shadow-xs active:scale-95 group"
                        title={isBlockEmpty ? "Xóa block trống" : "Xóa block"}
                        aria-label="Xóa block"
                      >
                        <Trash2 className="w-4 h-4 transition-transform group-hover:scale-110" />
                      </button>
                    </Popconfirm>
                  );
                })()}
              </div>

              {/* Auto-expanding Block Text Area */}
              <div className="relative mb-3">
                <label htmlFor={`${block.id}-text`} className="sr-only">
                  Nội dung block {index + 1}
                </label>
                <textarea
                  id={`${block.id}-text`}
                  value={block.text}
                  ref={(el) => {
                    if (el) {
                      el.style.height = "auto";
                      el.style.height = `${el.scrollHeight}px`;
                    }
                  }}
                  onInput={(e) => {
                    const target = e.currentTarget;
                    target.style.height = "auto";
                    target.style.height = `${target.scrollHeight}px`;
                  }}
                  onChange={(e) => handleUpdateBlockField(block.id, "text", e.target.value)}
                  onBlur={() => setBlurredBlockIds((current) => new Set(current).add(block.id))}
                  placeholder={
                    block.type === "heading"
                      ? "Nhập tiêu đề phân đoạn..."
                      : block.type === "dialogue"
                        ? "\"Nhập lời thoại của nhân vật...\""
                        : "Nhập nội dung đoạn văn..."
                  }
                  className={`w-full p-3 bg-secondary/20 border border-border rounded-xl text-foreground focus-visible:outline-ring resize-none overflow-hidden min-h-[60px] transition-[height] duration-75 ${block.type === "heading"
                    ? "font-display text-lg font-bold"
                    : block.type === "dialogue"
                      ? "font-story italic text-base text-accent"
                      : "font-story text-base"
                    }`}
                />
              </div>

              {/* Keyword Suggestions Chips (US-2.3) */}
              {blurredBlockIds.has(block.id) && suggestions.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 p-2.5 mb-3 rounded-xl bg-accent/5 border border-accent/20">
                  <span className="text-xs font-semibold text-accent flex items-center gap-1 mr-1">
                    <Sparkles className="w-3.5 h-3.5" />
                    Gợi ý hiệu ứng:
                  </span>
                  {suggestions.slice(0, 3).map((sug) => {
                    const meta = EFFECT_METADATA[sug.effect_type];
                    return (
                      <button
                        key={sug.effect_type}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenAddEffect(block.id, sug.effect_type);
                        }}
                        className="px-2.5 py-1 rounded-full text-xs font-medium bg-accent/15 text-accent hover:bg-accent/25 border border-accent/30 flex items-center gap-1.5 transition-colors cursor-pointer min-h-[44px]"
                        title={`Khớp từ khóa: "${sug.keyword}"`}
                        aria-label={`Thêm hiệu ứng ${meta?.label || sug.effect_type}`}
                      >
                        <Plus className="w-3 h-3" />
                        {meta?.label.split("(")[0].trim() || sug.effect_type}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Attached Effects List (US-2.2) */}
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/40">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mr-1">
                  Hiệu ứng ({block.effects.length}):
                </span>

                {block.effects.map((eff) => {
                  const Icon = getEffectIcon(eff.type, eff.category);
                  const meta = EFFECT_METADATA[eff.type];
                  const effectLabel =
                    eff.category === "audio"
                      ? AUDIO_EFFECT_PRESETS.find((preset) => preset.src === eff.audio_src)?.label ||
                      "Âm thanh"
                      : meta?.label?.split("(")[0].trim() || eff.type;
                  return (
                    <div
                      key={eff.id}
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenEditEffect(block.id, eff);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          e.stopPropagation();
                          handleOpenEditEffect(block.id, eff);
                        }
                      }}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/30 text-xs font-medium text-foreground cursor-pointer hover:bg-primary/15 transition-colors"
                    >
                      <Icon className="w-3.5 h-3.5 shrink-0 text-primary" />
                      <span className="max-w-32 truncate">
                        {effectLabel}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteEffect(block.id, eff.id);
                        }}
                        className="p-1.5 hover:text-destructive hover:text-red-600 rounded-lg transition-colors cursor-pointer min-h-[28px] min-w-[28px] flex items-center justify-center"
                        title="Xóa hiệu ứng"
                        aria-label="Xóa hiệu ứng"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenAddEffect(block.id);
                  }}
                  className="px-3 py-1.5 rounded-lg border border-dashed border-border hover:border-primary text-xs font-medium text-muted-foreground hover:text-primary transition-colors flex items-center gap-1.5 cursor-pointer min-h-[44px]"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Gắn Hiệu Ứng
                </button>
              </div>
            </div>

            {/* Đường chỉ báo vị trí thả - phía dưới block */}
            <div
              aria-hidden
              className={`mx-2 rounded-full bg-primary shadow-[0_0_10px_rgba(0,0,0,0.15)] shadow-primary/50 transition-all duration-150 ease-out ${showIndicatorAfter ? "h-1 my-1 opacity-100 scale-x-100" : "h-0 my-0 opacity-0 scale-x-95"
                }`}
            />

            {/* Hover Divider Gap Between Blocks (Item 5) */}
            {index < blocks.length - 1 && !showIndicatorAfter && (
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  handleAddBlock(index);
                }}
                className="group relative h-6 my-1 flex items-center justify-center cursor-pointer transition-all"
                title="Chèn đoạn mới vào giữa"
                role="button"
                tabIndex={0}
                aria-label={`Chèn block sau block ${index + 1}`}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleAddBlock(index);
                  }
                }}
              >
                <div className="w-full h-px bg-transparent group-hover:bg-primary/40 transition-colors" />
                <div className="opacity-0 group-hover:opacity-100 scale-75 group-hover:scale-100 transition-all duration-200 absolute px-3 py-1 rounded-full bg-primary hover:bg-primary-hover text-primary-foreground shadow-md flex items-center gap-1.5 text-xs font-editor font-medium z-10 min-h-[28px]">
                  <Plus className="w-3.5 h-3.5" />
                </div>
              </div>
            )}
          </React.Fragment>
        );
      })}

      {/* Button Thêm Block Cuối Cùng */}
      <div className="pt-6 flex justify-center">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleAddBlock(blocks.length - 1);
          }}
          className="px-6 py-3 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 font-editor font-semibold text-sm flex items-center gap-2 transition-all shadow-sm cursor-pointer min-h-[44px]"
        >
          <Plus className="w-5 h-5" />
          Thêm Đoạn Văn Mới
        </button>
      </div>

      {/* Effect Picker Modal */}
      <EffectPicker
        key={`${targetBlockId ?? "none"}-${editingEffect?.id ?? suggestedType ?? "new"}-${pickerOpen}`}
        isOpen={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSaveEffect={handleSaveEffect}
        initialEffect={editingEffect}
        presetType={suggestedType}
      />
    </div>
  );
}