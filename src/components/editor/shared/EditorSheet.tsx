"use client";

import React, { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

export interface EditorSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  position?: "left" | "right" | "bottom";
  children: React.ReactNode;
}

export function EditorSheet({
  isOpen,
  onClose,
  title,
  position = "right",
  children,
}: EditorSheetProps) {
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    if (!isOpen) return;

    previousFocusRef.current = document.activeElement as HTMLElement | null;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    sheetRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab" || !sheetRef.current) return;

      const focusable = sheetRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) {
        event.preventDefault();
        sheetRef.current.focus();
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
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = originalOverflow;
      previousFocusRef.current?.focus();
    };
  }, [isOpen, onClose]);

  if (!isOpen || typeof document === "undefined") return null;

  const positionClasses =
    position === "left"
      ? "left-0 top-0 bottom-0 w-full sm:w-96 max-w-[92vw] animate-slide-in-left"
      : position === "bottom"
        ? "left-0 right-0 bottom-0 max-h-[85vh] rounded-t-3xl animate-slide-in-bottom"
        : "right-0 top-0 bottom-0 w-full sm:w-96 max-w-[92vw] animate-slide-in-right";

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-xs flex font-editor animate-fade-in motion-reduce:animate-none"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={sheetRef}
        tabIndex={-1}
        className={`fixed bg-card border-border shadow-2xl flex flex-col z-[85] outline-none motion-reduce:animate-none ${positionClasses}`}
      >
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h2 id={titleId} className="font-bold text-sm text-foreground">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors motion-reduce:transition-none min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
            aria-label="Đóng bảng"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">{children}</div>
      </div>
    </div>,
    document.body
  );
}
