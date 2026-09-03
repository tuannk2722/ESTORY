"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  X,
  Moon,
  Sun,
  BookOpen,
  Volume2,
  Sparkles,
  Activity,
  Layers,
  EyeOff,
  ChevronDown,
  Check,
} from "lucide-react";
import { useReaderSettings } from "@/components/ui/ThemeProvider";
import { EffectCategory } from "@/types/story";
import { STORY_FONT_OPTIONS } from "@/types/settings";

export interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SettingsPanel({ isOpen, onClose }: SettingsPanelProps) {
  const { settings, updateSettings, setTheme } = useReaderSettings();
  const [isFontOpen, setIsFontOpen] = useState(false);
  const panelRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusFrame = window.requestAnimationFrame(() => closeButtonRef.current?.focus());

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;

      const focusable = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
        )
      );
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousBodyOverflow;
      previouslyFocused?.focus();
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const currentFont =
    STORY_FONT_OPTIONS.find((f) => f.id === settings.font_family) ||
    STORY_FONT_OPTIONS[0];

  const handleCategoryToggle = (category: EffectCategory) => {
    const currentMap = settings.effects_by_category || {
      visual: true,
      audio: true,
      motion: true,
      transition: true,
    };
    updateSettings({
      effects_by_category: {
        ...currentMap,
        [category]: !currentMap[category],
      },
    });
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
      {/* Backdrop mờ */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity duration-300"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer Panel */}
      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="reader-settings-title"
        className="glass-card font-editor relative w-full max-w-md h-full bg-[var(--color-card)]/95 shadow-2xl border-l border-[var(--color-border)] p-6 overflow-y-auto z-10 flex flex-col justify-between animate-fade-in"
      >
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-[var(--color-border)]">
            <h3 id="reader-settings-title" className="font-editor text-xl font-bold text-[var(--color-foreground)] flex items-center gap-2">
              <span>Cài Đặt Đọc Truyện</span>
            </h3>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={onClose}
              className="p-2 rounded-full hover:bg-[var(--color-muted)] text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
              aria-label="Đóng bảng cài đặt"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* 1. Theme Selection */}
          <div className="space-y-3">
            <label className="font-editor text-xs font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">
              Giao Diện
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setTheme("dark")}
                aria-pressed={settings.theme === "dark"}
                className={`flex flex-col items-center gap-2 p-3 rounded-lg border transition-all cursor-pointer min-h-[44px] ${settings.theme === "dark"
                  ? "border-[var(--color-accent)] bg-blue-950/30 text-[var(--color-accent)] font-semibold shadow-sm"
                  : "border-[var(--color-border)] bg-[var(--color-background)] hover:bg-[var(--color-muted)] text-[var(--color-foreground)]"
                  }`}
              >
                <Moon className="w-5 h-5" />
                <span className="text-xs font-editor">Dark OLED</span>
              </button>

              <button
                type="button"
                onClick={() => setTheme("light")}
                aria-pressed={settings.theme === "light"}
                className={`flex flex-col items-center gap-2 p-3 rounded-lg border transition-all cursor-pointer min-h-[44px] ${settings.theme === "light"
                  ? "border-[var(--color-accent)] bg-amber-100/40 text-[var(--color-accent)] font-semibold shadow-sm"
                  : "border-[var(--color-border)] bg-[var(--color-background)] hover:bg-[var(--color-muted)] text-[var(--color-foreground)]"
                  }`}
              >
                <Sun className="w-5 h-5" />
                <span className="text-xs font-editor">Paper Light</span>
              </button>

              <button
                type="button"
                onClick={() => setTheme("sepia")}
                aria-pressed={settings.theme === "sepia"}
                className={`flex flex-col items-center gap-2 p-3 rounded-lg border transition-all cursor-pointer min-h-[44px] ${settings.theme === "sepia"
                  ? "border-[var(--color-accent)] bg-amber-900/20 text-[var(--color-accent)] font-semibold shadow-sm"
                  : "border-[var(--color-border)] bg-[var(--color-background)] hover:bg-[var(--color-muted)] text-[var(--color-foreground)]"
                  }`}
              >
                <BookOpen className="w-5 h-5" />
                <span className="text-xs font-editor">Sepia Warm</span>
              </button>
            </div>
          </div>

          {/* 2. Cỡ chữ (Font Size) */}
          <div className="space-y-3">
            <label className="font-editor text-xs font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">
              Cỡ Chữ
            </label>
            <div className="grid grid-cols-4 gap-2">
              {(["sm", "md", "lg", "xl"] as const).map((size) => (
                <button
                  type="button"
                  key={size}
                  onClick={() => updateSettings({ font_size: size })}
                  aria-pressed={settings.font_size === size}
                  className={`py-2 rounded-lg border text-sm font-editor transition-all cursor-pointer min-h-[44px] ${settings.font_size === size
                    ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white font-semibold"
                    : "border-[var(--color-border)] bg-[var(--color-background)] hover:bg-[var(--color-muted)] text-[var(--color-foreground)]"
                    }`}
                >
                  {size.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* 2. Font chữ nội dung truyện */}
          <div className="space-y-2 relative">
            <label className="font-editor text-xs font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">
              Font Chữ Truyện
            </label>
            <div className="relative">
              {/* Trigger Button */}
              <button
                type="button"
                onClick={() => setIsFontOpen(!isFontOpen)}
                aria-expanded={isFontOpen}
                aria-haspopup="listbox"
                aria-controls="reader-font-options"
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border transition-all duration-200 cursor-pointer min-h-[44px] ${isFontOpen
                  ? "border-[var(--color-primary)] bg-[var(--color-background)] shadow-xs ring-2 ring-[var(--color-primary)]/20"
                  : "border-[var(--color-border)] bg-[var(--color-background)] hover:border-[var(--color-primary)]/70 hover:bg-[var(--color-muted)] text-[var(--color-foreground)]"
                  }`}
              >
                <span className={`text-sm font-medium ${currentFont.className}`}>
                  {currentFont.label}
                </span>
                <ChevronDown
                  className={`w-4 h-4 text-[var(--color-muted-foreground)] transition-transform duration-200 ${isFontOpen ? "rotate-180 text-[var(--color-primary)]" : ""
                    }`}
                />
              </button>

              {/* Dropdown Options */}
              {isFontOpen && (
                <>
                  <div
                    className="fixed inset-0 z-20"
                    onClick={() => setIsFontOpen(false)}
                  />
                  <div
                    id="reader-font-options"
                    role="listbox"
                    aria-label="Font chữ truyện"
                    className="absolute left-0 right-0 top-full mt-1.5 p-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)]/95 backdrop-blur-md shadow-xl z-30 space-y-0.5 animate-fade-in"
                  >
                    {STORY_FONT_OPTIONS.map(({ id, label, className }) => {
                      const isSelected = settings.font_family === id;
                      return (
                        <button
                          key={id}
                          type="button"
                          role="option"
                          aria-selected={isSelected}
                          onClick={() => {
                            updateSettings({ font_family: id });
                            setIsFontOpen(false);
                          }}
                          className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-all cursor-pointer min-h-[44px] ${className} ${isSelected
                            ? "bg-[var(--color-primary)] text-white font-medium shadow-xs"
                            : "hover:bg-[var(--color-muted)] text-[var(--color-foreground)]"
                            }`}
                        >
                          <span>{label}</span>
                          {isSelected && <Check className="w-4 h-4" />}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* 3. Hiệu ứng (Effects Switcher) */}
          <div className="space-y-4 pt-2 border-t border-[var(--color-border)]">
            {/* Master Toggle dạng label có thể click cả dòng */}
            <label className="flex items-center justify-between select-none">
              <div>
                <h4 className="font-editor text-sm font-semibold text-[var(--color-foreground)]">
                  Kích hoạt hiệu ứng
                </h4>
                <p className="font-editor text-xs text-[var(--color-muted-foreground)]">
                  Bật/tắt toàn bộ hiệu ứng chuyển động & âm thanh
                </p>
              </div>
              <input
                type="checkbox"
                checked={settings.effects_enabled}
                onChange={(e) => updateSettings({ effects_enabled: e.target.checked })}
                className="w-5 h-5 accent-[var(--color-primary)] cursor-pointer"
              />
            </label>

            {/* Sub-categories */}
            {settings.effects_enabled && (
              <div className="space-y-1 pl-2 border-l-2 border-[var(--color-border)] pt-1 animate-fade-in">
                {/* Visual */}
                <label className="flex items-center justify-between text-sm py-2 px-2.5 rounded-lg hover:bg-[var(--color-muted)]/60 transition-colors cursor-pointer select-none">
                  <span className="flex items-center gap-2 text-[var(--color-foreground)] font-editor">
                    <Sparkles className="w-4 h-4 text-cyan-400" /> Thị giác (Chớp sáng, Mưa...)
                  </span>
                  <input
                    type="checkbox"
                    checked={settings.effects_by_category?.visual !== false}
                    onChange={() => handleCategoryToggle("visual")}
                    className="w-4 h-4 accent-[var(--color-primary)] cursor-pointer"
                  />
                </label>

                {/* Audio */}
                <label className="flex items-center justify-between text-sm py-2 px-2.5 rounded-lg hover:bg-[var(--color-muted)]/60 transition-colors cursor-pointer select-none">
                  <span className="flex items-center gap-2 text-[var(--color-foreground)] font-editor">
                    <Volume2 className="w-4 h-4 text-amber-400" /> Âm thanh (SFX, BGM)
                  </span>
                  <input
                    type="checkbox"
                    checked={settings.effects_by_category?.audio !== false}
                    onChange={() => handleCategoryToggle("audio")}
                    className="w-4 h-4 accent-[var(--color-primary)] cursor-pointer"
                  />
                </label>

                {/* Motion */}
                <label className="flex items-center justify-between text-sm py-2 px-2.5 rounded-lg hover:bg-[var(--color-muted)]/60 transition-colors cursor-pointer select-none">
                  <span className="flex items-center gap-2 text-[var(--color-foreground)] font-editor">
                    <Activity className="w-4 h-4 text-emerald-400" /> Chuyển động (Rung màn hình...)
                  </span>
                  <input
                    type="checkbox"
                    checked={settings.effects_by_category?.motion !== false}
                    onChange={() => handleCategoryToggle("motion")}
                    className="w-4 h-4 accent-[var(--color-primary)] cursor-pointer"
                  />
                </label>

                {/* Transition */}
                <label className="flex items-center justify-between text-sm py-2 px-2.5 rounded-lg hover:bg-[var(--color-muted)]/60 transition-colors cursor-pointer select-none">
                  <span className="flex items-center gap-2 text-[var(--color-foreground)] font-editor">
                    <Layers className="w-4 h-4 text-purple-400" /> Chuyển cảnh (Fade, Mờ dần)
                  </span>
                  <input
                    type="checkbox"
                    checked={settings.effects_by_category?.transition !== false}
                    onChange={() => handleCategoryToggle("transition")}
                    className="w-4 h-4 accent-[var(--color-primary)] cursor-pointer"
                  />
                </label>
              </div>
            )}
          </div>

          {/* 4. Cường độ hiệu ứng (Intensity Multiplier) */}
          {settings.effects_enabled && (
            <div className="space-y-2 pt-2 border-t border-[var(--color-border)]">
              <div className="flex justify-between items-center text-sm font-editor">
                <label htmlFor="reader-effect-intensity" className="text-[var(--color-foreground)]">
                  Cường độ hiệu ứng:
                </label>
                <span className="font-semibold text-[var(--color-accent)]">
                  {Math.round((settings.intensity_multiplier ?? 1) * 100)}%
                </span>
              </div>
              <input
                id="reader-effect-intensity"
                type="range"
                min="0"
                max="100"
                value={Math.round((settings.intensity_multiplier ?? 1) * 100)}
                onChange={(e) =>
                  updateSettings({ intensity_multiplier: Number(e.target.value) / 100 })
                }
                className="w-full accent-[var(--color-accent)] cursor-pointer"
              />
            </div>
          )}

          {/* 5. Reduced Motion Toggle dạng label click cả dòng */}
          <label className="flex items-center justify-between py-3 px-3 rounded-xl border border-[var(--color-border)] hover:border-[var(--color-accent)]/50 bg-[var(--color-card)]/50 hover:bg-[var(--color-card)] transition-colors cursor-pointer select-none">
            <div>
              <h4 className="font-editor text-sm font-semibold text-[var(--color-foreground)] flex items-center gap-2">
                <EyeOff className="w-4 h-4 text-[var(--color-muted-foreground)]" />
                <span>Giảm Chuyển Động</span>
              </h4>
              <p className="font-editor text-xs text-[var(--color-muted-foreground)]">
                Dành cho người nhạy cảm ánh sáng/chóng mặt
              </p>
            </div>
            <input
              type="checkbox"
              checked={!!settings.reduced_motion}
              onChange={(e) => updateSettings({ reduced_motion: e.target.checked })}
              className="w-5 h-5 accent-[var(--color-primary)] cursor-pointer"
            />
          </label>
        </div>

        {/* Footer */}
        <div className="pt-6 border-t border-[var(--color-border)] text-center text-xs font-editor text-[var(--color-muted-foreground)]">
          Tùy chỉnh được lưu tự động trên trình duyệt.
        </div>
      </aside>
    </div>
  );
}
