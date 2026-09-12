"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { BookOpen, LogIn, PenLine, User } from "lucide-react";
import { signIn, useSession } from "next-auth/react";
import ProfileModal, { UserAvatar } from "./ProfileModal";
import ThemeSwitcher from "./ThemeSwitcher";

const guestFocusableSelector = 'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';

export default function AuthMenu() {
  const { data: session, status } = useSession();
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const loginTriggerRef = useRef<HTMLButtonElement>(null);
  const profileTriggerRef = useRef<HTMLButtonElement>(null);
  const loginPanelRef = useRef<HTMLDivElement>(null);
  const loginTitleId = useId();
  const [loginPosition, setLoginPosition] = useState({ top: 80, right: 12 });
  const closeLogin = useCallback(() => setIsLoginOpen(false), []);
  const closeProfile = useCallback(() => setIsProfileOpen(false), []);

  useLayoutEffect(() => {
    if (!isLoginOpen) return;
    const updatePosition = () => {
      const rect = loginTriggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      setLoginPosition({ top: rect.bottom + 8, right: Math.max(12, window.innerWidth - rect.right) });
    };
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [isLoginOpen]);

  useEffect(() => {
    if (!isLoginOpen) return;
    const panel = loginPanelRef.current;
    const trigger = loginTriggerRef.current;
    const focusFrame = requestAnimationFrame(() => panel?.querySelector<HTMLElement>(guestFocusableSelector)?.focus());

    const handlePointerDown = (event: PointerEvent) => {
      if (panel && !panel.contains(event.target as Node) && !trigger?.contains(event.target as Node)) closeLogin();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeLogin();
        return;
      }
      if (event.key !== "Tab" || !panel) return;
      const focusable = Array.from(panel.querySelectorAll<HTMLElement>(guestFocusableSelector));
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === panel)) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
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
  }, [closeLogin, isLoginOpen]);

  const currentPath = () => `${window.location.pathname}${window.location.search}`;

  return (
    <div className="relative flex items-center gap-1">

      {status === "loading" ? (
        <span className="flex h-11 w-11 animate-pulse items-center justify-center rounded-xl bg-[var(--color-muted)] motion-reduce:animate-none" role="status">
          <span className="sr-only">Đang tải phiên đăng nhập</span>
        </span>
      ) : session?.user ? (
        <>
          <Link
            href={session.user.role === "reader" ? "/author/stories/new" : "/author"}
            title={session.user.role === "reader" ? "Viết truyện" : "Truyện của tôi"}
            aria-label={session.user.role === "reader" ? "Viết truyện" : "Truyện của tôi"}
            className="flex items-center justify-center gap-1.5 px-2 sm:px-3 py-2 rounded-lg text-sm font-ui text-[var(--color-foreground)] hover:bg-[var(--color-muted)] motion-reduce:transition-none transition-colors min-h-[44px] min-w-[44px]"
          >
            {session.user.role === "reader" ? <PenLine aria-hidden="true" className="h-4 w-4 text-[var(--color-accent)]" /> : <BookOpen aria-hidden="true" className="h-4 w-4 text-[var(--color-accent)]" />}
            <span className="hidden lg:inline">{session.user.role === "reader" ? "Viết truyện" : "Truyện của tôi"}</span>
          </Link>

          <ThemeSwitcher compact={true} />

          <button
            ref={profileTriggerRef}
            type="button"
            onClick={() => setIsProfileOpen((open) => !open)}
            title="Hồ sơ cá nhân"
            aria-label="Mở hồ sơ cá nhân"
            aria-expanded={isProfileOpen}
            aria-haspopup="dialog"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-card)] p-0.5 transition-colors hover:border-[var(--color-accent)] motion-reduce:transition-none"
          >
            <UserAvatar user={session.user} />
          </button>
          {isProfileOpen ? <ProfileModal user={session.user} onClose={closeProfile} triggerRef={profileTriggerRef} /> : null}
        </>
      ) : (
        <>
          <ThemeSwitcher compact={true} />

          <button
            ref={loginTriggerRef}
            type="button"
            onClick={() => setIsLoginOpen((open) => !open)}
            aria-label="Đăng nhập"
            aria-expanded={isLoginOpen}
            aria-haspopup="dialog"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center gap-2 rounded-xl bg-[var(--color-primary)] px-2 text-xs font-semibold text-[var(--color-primary-foreground)] transition-colors hover:bg-[var(--color-primary-hover)] motion-reduce:transition-none sm:px-3"
          >
            <LogIn aria-hidden="true" className="h-4 w-4" />
            <span className="hidden xl:inline">Đăng nhập</span>
          </button>
          {isLoginOpen ? createPortal(
            <div
              ref={loginPanelRef}
              tabIndex={-1}
              role="dialog"
              aria-modal="true"
              aria-labelledby={loginTitleId}
              style={{ top: loginPosition.top, right: loginPosition.right }}
              className="glass-card fixed left-3 z-[80] p-4 shadow-2xl outline-none sm:left-auto sm:w-72"
            >
              <div className="mb-3 flex items-center gap-2">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-secondary)]">
                  <User aria-hidden="true" className="h-5 w-5 text-[var(--color-accent)]" />
                </span>
                <div>
                  <h2 id={loginTitleId} className="text-sm font-bold text-[var(--color-foreground)]">Đăng nhập StoryVerse</h2>
                  <p className="text-xs text-[var(--color-muted-foreground)]">Chọn một tài khoản để tiếp tục</p>
                </div>
              </div>
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => void signIn("google", { redirectTo: currentPath() })}
                  className="flex min-h-[44px] w-full items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm font-semibold text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-muted)] motion-reduce:transition-none"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  <span> Tiếp tục với Google</span>
                </button>
                <button
                  type="button"
                  onClick={() => void signIn("github", { redirectTo: currentPath() })}
                  className="flex min-h-[44px] w-full items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm font-semibold text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-muted)] motion-reduce:transition-none"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" >
                    <path d="M12 .7C5.7.7.6 5.8.6 12.1c0 5 3.3 9.2 7.8 10.7.6.1.8-.3.8-.6v-2.3c-3.2.7-3.9-1.4-3.9-1.4-.5-1.3-1.3-1.7-1.3-1.7-1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.7 1.3 3.4 1 .1-.8.4-1.3.8-1.6-2.6-.3-5.3-1.3-5.3-5.7 0-1.3.5-2.3 1.2-3.1-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.2 1.2a11 11 0 0 1 5.8 0c2.2-1.5 3.2-1.2 3.2-1.2.6 1.6.2 2.8.1 3.1.8.8 1.2 1.8 1.2 3.1 0 4.4-2.7 5.4-5.3 5.7.4.4.8 1.1.8 2.2v3.3c0 .4.2.7.8.6a11.5 11.5 0 0 0 7.8-10.7C23.4 5.8 18.3.7 12 .7Z" />
                  </svg>
                  <span>Tiếp tục với GitHub</span>
                </button>
              </div>
            </div>,
            document.body,
          ) : null}
        </>
      )}
    </div>
  );
}
