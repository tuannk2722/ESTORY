"use client";

import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import { BookOpen, LogIn, PenLine } from "lucide-react";
import { useSession } from "next-auth/react";
import ProfileModal, { UserAvatar } from "./ProfileModal";
import ThemeSwitcher from "./ThemeSwitcher";
import LoginDialog, { type LoginDialogVariant } from "./LoginDialog";

export default function AuthMenu() {
  const { data: session, status } = useSession();

  // Unified login dialog state
  const [loginVariant, setLoginVariant] = useState<LoginDialogVariant | null>(null);
  const loginTriggerRef = useRef<HTMLButtonElement>(null);
  const creatorTriggerRef = useRef<HTMLButtonElement>(null);
  const closeLogin = useCallback(() => setLoginVariant(null), []);

  // Profile modal
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const profileTriggerRef = useRef<HTMLButtonElement>(null);
  const closeProfile = useCallback(() => setIsProfileOpen(false), []);

  return (
    <div className="relative flex items-center gap-1">
      {status === "loading" ? (
        <span
          className="flex h-11 w-11 animate-pulse items-center justify-center rounded-xl bg-[var(--color-muted)] motion-reduce:animate-none"
          role="status"
        >
          <span className="sr-only">Đang tải phiên đăng nhập</span>
        </span>
      ) : session?.user ? (
        <>
          <Link
            href={session.user.role === "reader" ? "/author/stories/new" : "/author"}
            title={session.user.role === "reader" ? "Viết truyện" : "Truyện của tôi"}
            aria-label={session.user.role === "reader" ? "Viết truyện" : "Truyện của tôi"}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center gap-1.5 rounded-lg px-2 text-sm font-ui text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-muted)] motion-reduce:transition-none sm:px-3"
          >
            {session.user.role === "reader" ? (
              <PenLine aria-hidden="true" className="h-4 w-4 text-[var(--color-accent)]" />
            ) : (
              <BookOpen aria-hidden="true" className="h-4 w-4 text-[var(--color-accent)]" />
            )}
            <span className="hidden lg:inline">
              {session.user.role === "reader" ? "Viết truyện" : "Truyện của tôi"}
            </span>
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
          {isProfileOpen ? (
            <ProfileModal user={session.user} onClose={closeProfile} triggerRef={profileTriggerRef} />
          ) : null}
        </>
      ) : (
        <>
          {/* Guest: "Viết truyện" — opens creator-context login dialog */}
          <button
            ref={creatorTriggerRef}
            type="button"
            onClick={() => setLoginVariant("creator")}
            aria-label="Viết truyện"
            aria-expanded={loginVariant === "creator"}
            aria-haspopup="dialog"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center gap-1.5 rounded-lg px-2 text-sm font-ui text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-muted)] motion-reduce:transition-none sm:px-3"
          // className="flex min-h-[44px] min-w-[44px] items-center justify-center gap-1.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-2 text-sm font-ui text-[var(--color-foreground)] transition-colors hover:border-[var(--color-accent)] hover:bg-[var(--color-muted)] motion-reduce:transition-none sm:px-3"
          >
            <PenLine aria-hidden="true" className="h-4 w-4 text-[var(--color-accent)]" />
            <span className="hidden lg:inline">Viết truyện</span>
          </button>

          <ThemeSwitcher compact={true} />

          {/* Guest: "Đăng nhập" — opens generic login dialog */}
          <button
            ref={loginTriggerRef}
            type="button"
            onClick={() => setLoginVariant("general")}
            aria-label="Đăng nhập"
            aria-expanded={loginVariant === "general"}
            aria-haspopup="dialog"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center gap-2 rounded-xl bg-[var(--color-primary)] px-2 text-xs font-semibold text-[var(--color-primary-foreground)] transition-colors hover:bg-[var(--color-primary-hover)] motion-reduce:transition-none sm:px-3"
          >
            <LogIn aria-hidden="true" className="h-4 w-4" />
            <span className="hidden xl:inline">Đăng nhập</span>
          </button>

          {/* Single unified LoginDialog */}
          <LoginDialog
            isOpen={loginVariant !== null}
            onClose={closeLogin}
            variant={loginVariant ?? "general"}
            triggerRef={loginVariant === "creator" ? creatorTriggerRef : loginTriggerRef}
          />
        </>
      )}
    </div>
  );
}
