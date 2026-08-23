"use client";

import React, { useEffect, useCallback } from "react";
import { BookOpen, ArrowRight, BookMarked, X } from "lucide-react";

export interface ResumeReadingModalProps {
  isOpen: boolean;
  targetChapterTitle: string;
  onResume: () => void;
  onDismiss: () => void;
}

/**
 * Modal hỏi reader có muốn đọc tiếp chapter đã lưu hay đọc chapter vừa chọn.
 * Chỉ hiện ở Detail Page khi:
 *   targetChapter !== resumeReading.chapterId && !resumePromptDismissed
 *
 * Trong thời gian modal hiển thị, toàn bộ effect của block bị tạm dừng.
 */
export default function ResumeReadingModal({
  isOpen,
  targetChapterTitle,
  onResume,
  onDismiss,
}: ResumeReadingModalProps) {
  // Hỗ trợ phím Escape để đóng modal
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onDismiss();
    },
    [onDismiss]
  );

  useEffect(() => {
    if (!isOpen) return;
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="resume-modal-title"
      aria-describedby="resume-modal-desc"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in"
    >
      <div className="glass-card max-w-md w-full p-6 md:p-8 rounded-2xl shadow-2xl border border-[var(--color-border)] text-center space-y-6 relative">
        {/* Nút đóng nhanh góc phải */}
        <button
          onClick={onDismiss}
          className="absolute top-4 right-4 p-2 rounded-lg text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] hover:bg-[var(--color-muted)] transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
          aria-label="Đóng và đọc chương đã chọn"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Icon huy hiệu nổi bật */}
        <div className="w-16 h-16 mx-auto rounded-full bg-[var(--color-primary)]/15 border border-[var(--color-primary)]/30 text-[var(--color-primary)] flex items-center justify-center shadow-inner">
          <BookMarked className="w-8 h-8" />
        </div>

        {/* Tiêu đề & Nội dung */}
        <div className="space-y-2.5">
          <span className="font-ui text-xs font-semibold uppercase tracking-wider text-[var(--color-accent)]">
            Tiến trình đọc trước đó
          </span>
          <h2
            id="resume-modal-title"
            className="font-display text-2xl font-bold text-[var(--color-foreground)] tracking-tight"
          >
            Tiếp Tục Đọc?
          </h2>
          <p
            id="resume-modal-desc"
            className="font-ui text-sm text-[var(--color-muted-foreground)] leading-relaxed"
          >
            Bạn có muốn tiếp tục đọc hay chuyển sang{" "}
            <strong className="text-[var(--color-foreground)] font-semibold">
              {targetChapterTitle}
            </strong>
            ?
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          {/* Nút Phụ: Đọc chapter vừa chọn */}
          <button
            onClick={onDismiss}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] hover:bg-[var(--color-muted)] text-[var(--color-foreground)] font-ui font-medium text-sm transition-all duration-200 cursor-pointer min-h-[44px]"
          >
            <BookOpen className="w-4 h-4 text-[var(--color-muted-foreground)]" />
            <span>Đọc chương này</span>
          </button>

          {/* Nút Chính: Đọc tiếp resume chapter */}
          <button
            onClick={onResume}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white font-ui font-semibold text-sm transition-all duration-200 shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 cursor-pointer min-h-[44px]"
          >
            <span>Đọc tiếp</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
