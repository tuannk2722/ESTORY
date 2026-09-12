"use client";

import Link from "next/link";
import { useEffect, useId, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { BookOpen, ChevronRight, LogOut, Shield, User, X } from "lucide-react";
import { signOut } from "next-auth/react";
import type { SessionUser } from "@/lib/auth/policy";
import IntegrationsSection from "./IntegrationsSection";
import ThemeSwitcher from "./ThemeSwitcher";

interface ProfileModalProps {
  user: SessionUser;
  onClose: () => void;
  triggerRef: RefObject<HTMLButtonElement | null>;
}

const focusableSelector =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function UserAvatar({ user, large = false }: { user: SessionUser; large?: boolean }) {
  const [imageFailed, setImageFailed] = useState(false);
  const sizeClass = large ? "h-14 w-14" : "h-9 w-9";

  if (user.image && !imageFailed) {
    return (
      // OAuth avatar hosts are user-dependent, so this small profile image stays unoptimized.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={user.image}
        alt=""
        referrerPolicy="no-referrer"
        onError={() => setImageFailed(true)}
        className={`${sizeClass} rounded-full border border-[var(--color-border)] object-cover`}
      />
    );
  }

  return (
    <span className={`${sizeClass} flex items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-secondary)]`}>
      <User aria-hidden="true" className={`${large ? "h-6 w-6" : "h-4 w-4"} text-[var(--color-accent)]`} />
    </span>
  );
}

export { UserAvatar };

export default function ProfileModal({ user, onClose, triggerRef }: ProfileModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const [position, setPosition] = useState({ top: 80, right: 12 });

  useLayoutEffect(() => {
    const updatePosition = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      setPosition({ top: rect.bottom + 8, right: Math.max(12, window.innerWidth - rect.right) });
    };
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [triggerRef]);

  useEffect(() => {
    const panel = panelRef.current;
    const trigger = triggerRef.current;
    const focusFrame = requestAnimationFrame(() => {
      panel?.querySelector<HTMLElement>('[data-profile-autofocus="true"]')?.focus();
    });

    const handlePointerDown = (event: PointerEvent) => {
      if (panel && !panel.contains(event.target as Node) && !trigger?.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !panel) return;

      const focusable = Array.from(panel.querySelectorAll<HTMLElement>(focusableSelector));
      if (focusable.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === panel)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      cancelAnimationFrame(focusFrame);
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      trigger?.focus();
    };
  }, [onClose, triggerRef]);

  const roleLabel = user.role === "admin" ? "Quản trị viên" : user.role === "author" ? "Tác giả" : null;

  const modal = (
    <div
      ref={panelRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      style={{ top: position.top, right: position.right }}
      className="glass-card fixed left-3 z-[80] max-h-[calc(100dvh-6rem)] overflow-y-auto p-4 shadow-2xl outline-none sm:left-auto sm:w-80"
    >
      <div className="flex items-start gap-3 border-b border-[var(--color-border)] pb-4 pr-10">
        <UserAvatar user={user} large />
        <div className="min-w-0 flex-1">
          <h2 id={titleId} className="truncate font-display text-base font-bold text-[var(--color-foreground)]">
            {user.name || "Người đọc StoryVerse"}
          </h2>
          <p className="truncate text-xs text-[var(--color-muted-foreground)]">{user.email}</p>
          {roleLabel ? (
            <span className="mt-2 inline-flex items-center gap-1 rounded-full border border-[var(--color-accent)]/40 bg-[var(--color-accent)]/10 px-2 py-1 text-[11px] font-semibold text-[var(--color-accent)]">
              <Shield aria-hidden="true" className="h-3 w-3" />
              {roleLabel}
            </span>
          ) : null}
        </div>
      </div>

      <button
        data-profile-autofocus="true"
        type="button"
        onClick={onClose}
        aria-label="Đóng hồ sơ"
        title="Đóng (Escape)"
        className="absolute right-2 top-2 flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)] motion-reduce:transition-none"
      >
        <X aria-hidden="true" className="h-5 w-5" />
      </button>

      <div className="border-b border-[var(--color-border)] py-4">
        <ThemeSwitcher />
      </div>

      <IntegrationsSection />

      {user.role !== "reader" ? (
        <div className="border-b border-[var(--color-border)] py-2">
          <Link
            href="/author"
            onClick={onClose}
            className="flex min-h-[44px] items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-muted)] motion-reduce:transition-none"
          >
            <BookOpen aria-hidden="true" className="h-4 w-4 text-[var(--color-accent)]" />
            <span className="flex-1">Truyện của tôi</span>
            <ChevronRight aria-hidden="true" className="h-4 w-4 text-[var(--color-muted-foreground)]" />
          </Link>
          {user.role === "admin" ? (
            <Link
              href="/admin"
              onClick={onClose}
              className="flex min-h-[44px] items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-muted)] motion-reduce:transition-none"
            >
              <Shield aria-hidden="true" className="h-4 w-4 text-[var(--color-accent)]" />
              <span className="flex-1">Trang quản trị</span>
              <ChevronRight aria-hidden="true" className="h-4 w-4 text-[var(--color-muted-foreground)]" />
            </Link>
          ) : null}
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => void signOut({ redirectTo: "/" })}
        className="mt-2 flex min-h-[44px] w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold text-[var(--color-destructive)] transition-colors hover:bg-[var(--color-destructive)]/10 motion-reduce:transition-none"
      >
        <LogOut aria-hidden="true" className="h-4 w-4" />
        Đăng xuất
      </button>
    </div>
  );

  return createPortal(modal, document.body);
}
