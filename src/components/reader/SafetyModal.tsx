"use client";

import React, { useEffect, useState } from "react";
import { AlertTriangle, ShieldCheck, Play } from "lucide-react";
import { Chapter } from "@/types/story";
import { useReaderSettings } from "@/components/ui/ThemeProvider";

export interface SafetyModalProps {
  chapter: Chapter;
  onOpenChange?: (isOpen: boolean) => void;
}

export default function SafetyModal({ chapter, onOpenChange }: SafetyModalProps) {
  const { updateSettings } = useReaderSettings();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // 1. Kiểm tra chapter có chứa effect chớp sáng hoặc rung mạnh không (US-1.5)
    let hasIntenseEffect = false;
    for (const block of chapter.blocks) {
      for (const eff of block.effects) {
        if (
          (eff.type === "lightning_flash" || eff.type === "screen_shake") &&
          eff.intensity > 0.6
        ) {
          hasIntenseEffect = true;
          break;
        }
      }
      if (hasIntenseEffect) break;
    }

    if (!hasIntenseEffect) {
      onOpenChange?.(false);
      return;
    }

    // 2. Kiểm tra đã cảnh báo trong session này chưa
    const sessionKey = `safety_warned_${chapter.id}`;
    if (typeof sessionStorage !== "undefined") {
      const warned = sessionStorage.getItem(sessionKey);
      if (!warned) {
        setIsOpen(true);
        onOpenChange?.(true);
      } else {
        onOpenChange?.(false);
      }
    }
  }, [chapter, onOpenChange]);

  const handleSafeMode = () => {
    // Bật reduced motion và giảm cường độ xuống 0.5
    updateSettings({
      reduced_motion: true,
      intensity_multiplier: 0.5,
    });
    closeModal();
  };

  const handleContinue = () => {
    closeModal();
  };

  const closeModal = () => {
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.setItem(`safety_warned_${chapter.id}`, "true");
    }
    setIsOpen(false);
    onOpenChange?.(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="glass-card max-w-md w-full p-6 shadow-2xl border border-[var(--color-border)] text-center space-y-5">
        <div className="w-14 h-14 mx-auto rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center">
          <AlertTriangle className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <h3 className="font-display text-xl font-bold text-[var(--color-foreground)]">
            Cảnh Báo Hiệu Ứng Mạnh
          </h3>
          <p className="font-ui text-sm text-[var(--color-muted-foreground)] leading-relaxed">
            Chương truyện này có chứa các hiệu ứng chớp sáng và rung chuyển mạnh. Nếu bạn nhạy cảm với ánh sáng hoặc chuyển động, hãy chọn chế độ an toàn.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <button
            onClick={handleSafeMode}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white font-ui font-medium text-sm transition-colors min-h-[44px]"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Chế độ an toàn</span>
          </button>

          <button
            onClick={handleContinue}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] hover:bg-[var(--color-muted)] text-[var(--color-foreground)] font-ui font-medium text-sm transition-colors min-h-[44px]"
          >
            <Play className="w-4 h-4 text-[var(--color-accent)]" />
            <span>Tiếp tục</span>
          </button>
        </div>
      </div>
    </div>
  );
}
