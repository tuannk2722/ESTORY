// components/ui/ConfirmModal.tsx
// Phase 2: Global Confirm Modal & useConfirm hook cho toàn web
"use client";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
} from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle2,
  Trash2,
  X,
  LucideIcon,
} from "lucide-react";

export type ConfirmVariant = "danger" | "warning" | "info" | "success";

export interface ConfirmOptions {
  title: string;
  description?: string | React.ReactNode;
  variant?: ConfirmVariant;
  confirmText?: string;
  cancelText?: string;
  icon?: LucideIcon;
  confirmLoading?: boolean;
}

interface ConfirmContextType {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextType | null>(null);

export function useConfirm() {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error("useConfirm must be used within a ConfirmProvider");
  }
  return context.confirm;
}

// ── Variant configuration (Icon, Color, Badges) ──
const VARIANT_CONFIG: Record<
  ConfirmVariant,
  {
    icon: LucideIcon;
    badgeBg: string;
    badgeText: string;
    badgeBorder: string;
    confirmBtnBg: string;
    glowColor: string;
  }
> = {
  danger: {
    icon: Trash2,
    badgeBg: "bg-red-500/10",
    badgeText: "text-red-500",
    badgeBorder: "border-red-500/20",
    confirmBtnBg:
      "bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-600/25 focus-visible:ring-red-500",
    glowColor: "rgba(239, 68, 68, 0.15)",
  },
  warning: {
    icon: AlertTriangle,
    badgeBg: "bg-amber-500/10",
    badgeText: "text-amber-500",
    badgeBorder: "border-amber-500/20",
    confirmBtnBg:
      "bg-amber-600 hover:bg-amber-700 text-white shadow-lg shadow-amber-600/25 focus-visible:ring-amber-500",
    glowColor: "rgba(245, 158, 11, 0.15)",
  },
  info: {
    icon: Info,
    badgeBg: "bg-primary/10",
    badgeText: "text-primary",
    badgeBorder: "border-primary/20",
    confirmBtnBg:
      "bg-editor-action hover:bg-editor-action-hover text-editor-action-foreground shadow-lg shadow-primary/25 focus-visible:ring-primary",
    glowColor: "rgba(59, 130, 246, 0.15)",
  },
  success: {
    icon: CheckCircle2,
    badgeBg: "bg-emerald-500/10",
    badgeText: "text-emerald-500",
    badgeBorder: "border-emerald-500/20",
    confirmBtnBg:
      "bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/25 focus-visible:ring-emerald-500",
    glowColor: "rgba(16, 185, 129, 0.15)",
  },
};

// ── Standalone ConfirmModal Component ──
export interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  description?: string | React.ReactNode;
  variant?: ConfirmVariant;
  confirmText?: string;
  cancelText?: string;
  icon?: LucideIcon;
  confirmLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  isOpen,
  title,
  description,
  variant = "danger",
  confirmText = "Xác nhận",
  cancelText = "Hủy bỏ",
  icon: CustomIcon,
  confirmLoading = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const cancelBtnRef = useRef<HTMLButtonElement>(null);
  const config = VARIANT_CONFIG[variant] || VARIANT_CONFIG.danger;
  const Icon = CustomIcon || config.icon;

  // Focus trap & Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    const focusTimer = setTimeout(() => cancelBtnRef.current?.focus(), 50);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      clearTimeout(focusTimer);
    };
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  const modalContent = (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-desc"
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in text-foreground font-editor"
      onClick={onCancel}
    >
      <div
        className="relative w-full max-w-md bg-card/95 border border-border/80 rounded-3xl shadow-2xl overflow-hidden p-6 md:p-7 transition-all scale-100 flex flex-col gap-5"
        style={{
          boxShadow: `0 20px 40px -15px ${config.glowColor}, 0 0 0 1px rgba(255, 255, 255, 0.08)`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Icon + Title */}
        <div className="flex items-start gap-4">
          <div
            className={`p-3.5 rounded-2xl ${config.badgeBg} ${config.badgeText} border ${config.badgeBorder} shrink-0 shadow-xs`}
          >
            <Icon className="w-6 h-6 stroke-[2.2]" />
          </div>

          <div className="flex-1 min-w-0 pr-6">
            <h3
              id="confirm-dialog-title"
              className="text-lg font-bold text-foreground font-editor leading-snug"
            >
              {title}
            </h3>
            {description && (
              <div
                id="confirm-dialog-desc"
                className="text-sm text-muted-foreground mt-1.5 leading-relaxed font-editor"
              >
                {description}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={onCancel}
            className="absolute top-5 right-5 p-1.5 text-muted-foreground hover:text-foreground rounded-xl hover:bg-secondary/70 transition-colors cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center"
            aria-label="Đóng hộp thoại"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            ref={cancelBtnRef}
            type="button"
            onClick={onCancel}
            className="px-4 py-2.5 rounded-xl font-editor text-sm font-medium bg-secondary hover:bg-secondary/80 text-secondary-foreground border border-border transition-all cursor-pointer min-h-[44px] flex items-center justify-center"
          >
            {cancelText}
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={confirmLoading}
            className={`px-5 py-2.5 rounded-xl font-editor text-sm font-semibold transition-all cursor-pointer min-h-[44px] flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${config.confirmBtnBg}`}
          >
            {confirmLoading ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : null}
            <span>{confirmText}</span>
          </button>
        </div>
      </div>
    </div>
  );

  if (typeof document !== "undefined" && document.body) {
    return createPortal(modalContent, document.body);
  }
  return modalContent;
}

// ── Context Provider cho useConfirm() ──
export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [modalState, setModalState] = useState<
    (ConfirmOptions & { isOpen: boolean }) | null
  >(null);
  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
      setModalState({
        ...options,
        isOpen: true,
      });
    });
  }, []);

  const handleConfirm = useCallback(() => {
    if (resolverRef.current) {
      resolverRef.current(true);
      resolverRef.current = null;
    }
    setModalState(null);
  }, []);

  const handleCancel = useCallback(() => {
    if (resolverRef.current) {
      resolverRef.current(false);
      resolverRef.current = null;
    }
    setModalState(null);
  }, []);

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {modalState && (
        <ConfirmModal
          isOpen={modalState.isOpen}
          title={modalState.title}
          description={modalState.description}
          variant={modalState.variant}
          confirmText={modalState.confirmText}
          cancelText={modalState.cancelText}
          icon={modalState.icon}
          confirmLoading={modalState.confirmLoading}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      )}
    </ConfirmContext.Provider>
  );
}
