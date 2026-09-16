"use client";

import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { PenLine, User } from "lucide-react";
import { signIn } from "next-auth/react";

export type LoginDialogVariant = "general" | "creator";

export interface LoginDialogProps {
  isOpen: boolean;
  onClose: () => void;
  triggerRef?: React.RefObject<HTMLElement | null>;
  variant?: LoginDialogVariant;
  redirectTo?: string;
}

const focusableSelector =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function LoginDialog({
  isOpen,
  onClose,
  triggerRef,
  variant = "general",
  redirectTo,
}: LoginDialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descId = useId();

  // Focus trap & keyboard handler
  useEffect(() => {
    if (!isOpen) return;

    const panel = panelRef.current;
    const trigger = triggerRef?.current;

    const focusFrame = requestAnimationFrame(() => {
      panel?.querySelector<HTMLElement>(focusableSelector)?.focus();
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !panel) return;

      const els = Array.from(panel.querySelectorAll<HTMLElement>(focusableSelector));
      if (els.length === 0) return;

      const first = els[0];
      const last = els[els.length - 1];

      if (event.shiftKey && (document.activeElement === first || document.activeElement === panel)) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", handleKeyDown);
      trigger?.focus();
    };
  }, [isOpen, onClose, triggerRef]);

  if (typeof document === "undefined" || !isOpen) return null;

  const isCreator = variant === "creator";
  const title = isCreator ? "Bắt đầu sáng tác" : "Đăng nhập StoryVerse";
  const description = isCreator
    ? "Đăng nhập để tạo câu chuyện tương tác của riêng bạn"
    : "Chọn một tài khoản để tiếp tục";

  const targetRedirect =
    redirectTo ||
    (isCreator
      ? "/author/stories/new"
      : typeof window !== "undefined"
        ? `${window.location.pathname}${window.location.search}`
        : "/");

  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs motion-reduce:backdrop-blur-none"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        tabIndex={-1}
        className="glass-card w-full max-w-xs sm:max-w-sm rounded-2xl border border-[var(--color-border)] p-5 shadow-2xl outline-none"
      >
        <div className="mb-4 flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--color-secondary)]">
            {isCreator ? (
              <PenLine aria-hidden="true" className="h-5 w-5 text-[var(--color-accent)]" />
            ) : (
              <User aria-hidden="true" className="h-5 w-5 text-[var(--color-accent)]" />
            )}
          </span>
          <div>
            <h2 id={titleId} className="text-base font-bold text-[var(--color-foreground)]">
              {title}
            </h2>
            <p id={descId} className="text-xs text-[var(--color-muted-foreground)]">
              {description}
            </p>
          </div>
        </div>

        <div className="space-y-2.5">
          <button
            type="button"
            onClick={() => void signIn("google", { redirectTo: targetRedirect })}
            className="flex min-h-[44px] w-full items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] px-3.5 py-2.5 text-sm font-semibold text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-muted)] motion-reduce:transition-none"
          >
            <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            <span>Tiếp tục với Google</span>
          </button>

          <button
            type="button"
            onClick={() => void signIn("github", { redirectTo: targetRedirect })}
            className="flex min-h-[44px] w-full items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] px-3.5 py-2.5 text-sm font-semibold text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-muted)] motion-reduce:transition-none"
          >
            <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 .7C5.7.7.6 5.8.6 12.1c0 5 3.3 9.2 7.8 10.7.6.1.8-.3.8-.6v-2.3c-3.2.7-3.9-1.4-3.9-1.4-.5-1.3-1.3-1.7-1.3-1.7-1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.7 1.3 3.4 1 .1-.8.4-1.3.8-1.6-2.6-.3-5.3-1.3-5.3-5.7 0-1.3.5-2.3 1.2-3.1-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.2 1.2a11 11 0 0 1 5.8 0c2.2-1.5 3.2-1.2 3.2-1.2.6 1.6.2 2.8.1 3.1.8.8 1.2 1.8 1.2 3.1 0 4.4-2.7 5.4-5.3 5.7.4.4.8 1.1.8 2.2v3.3c0 .4.2.7.8.6a11.5 11.5 0 0 0 7.8-10.7C23.4 5.8 18.3.7 12 .7Z" />
            </svg>
            <span>Tiếp tục với GitHub</span>
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
