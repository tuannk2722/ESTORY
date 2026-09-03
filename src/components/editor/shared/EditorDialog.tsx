// src/components/editor/shared/EditorDialog.tsx
// Accessible Dialog primitive with Focus Trap, Focus Restore, Scroll Lock, and Escape closing

"use client";

import React, { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

export interface EditorDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  icon?: React.ReactNode;
  maxWidth?: string;
  bodyClassName?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function EditorDialog({
  isOpen,
  onClose,
  title,
  description,
  icon,
  maxWidth = "max-w-2xl",
  bodyClassName = "p-5",
  children,
  footer,
}: EditorDialogProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();

  // Focus trap & focus restore & scroll lock
  useEffect(() => {
    if (!isOpen) return;

    // Lưu active element trước khi mở
    previousFocusRef.current = document.activeElement as HTMLElement;

    // Khóa cuộn trang nền
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Focus sau khi dialog đã được gắn vào DOM.
    const focusFrame = requestAnimationFrame(() => dialogRef.current?.focus());

    // Escape listener
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }

      // Tab trap
      if (e.key === "Tab" && dialogRef.current) {
        const focusableElements = dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusableElements.length > 0) {
          const first = focusableElements[0];
          const last = focusableElements[focusableElements.length - 1];
          const activeElement = document.activeElement;

          if (
            activeElement === dialogRef.current ||
            !dialogRef.current.contains(activeElement)
          ) {
            (e.shiftKey ? last : first).focus();
            e.preventDefault();
          } else if (e.shiftKey && activeElement === first) {
            last.focus();
            e.preventDefault();
          } else if (!e.shiftKey && activeElement === last) {
            first.focus();
            e.preventDefault();
          }
        } else {
          e.preventDefault();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      cancelAnimationFrame(focusFrame);
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = originalOverflow;
      // Khôi phục focus
      previousFocusRef.current?.focus?.();
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const content = (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in motion-reduce:animate-none font-editor"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className={`w-full ${maxWidth} rounded-3xl bg-card border border-border shadow-2xl overflow-hidden flex flex-col max-h-[calc(100dvh-2rem)] animate-scale-in motion-reduce:animate-none outline-none`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            {icon && <div className="p-2 rounded-2xl bg-primary/10 text-primary" aria-hidden="true">{icon}</div>}
            <div>
              <h2 id={titleId} className="text-base md:text-lg font-bold text-foreground">
                {title}
              </h2>
              {description && (
                <p id={descriptionId} className="text-xs text-muted-foreground mt-0.5">{description}</p>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors motion-reduce:transition-none min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
            title="Đóng (Escape)"
            aria-label="Đóng dialog"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Body */}
        <div className={`flex-1 overflow-y-auto custom-scrollbar ${bodyClassName}`}>
          {children}
        </div>

        {/* Footer */}
        {footer && <div className="p-4 border-t border-border bg-secondary/30">{footer}</div>}
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(content, document.body);
}
