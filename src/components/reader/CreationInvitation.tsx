"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, PenLine } from "lucide-react";
import { useSession } from "next-auth/react";
import LoginDialog from "../ui/LoginDialog";

export interface CreationInvitationProps {
  storyFontClass?: string;
}

/**
 * Quiet Inline Invitation: A gentle note positioned in rhythm with the reader
 * column after ChapterNav. Matches the exact text color, font, and accent of the story.
 * Appears only for Guest and Reader (hidden for Author/Admin).
 */
export default function CreationInvitation({
  storyFontClass = "story-font-cormorant",
}: CreationInvitationProps) {
  const { data: session, status } = useSession();
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Hidden during auth loading or for users who already have author privileges
  if (status === "loading") return null;
  const role = session?.user?.role;
  if (role === "author" || role === "admin") return null;

  const isGuest = !session?.user;

  return (
    <aside
      aria-label="Lời mời sáng tác"
      className="my-8 rounded-2xl border border-white/10 bg-[#0E1426]/50 p-4 shadow-lg shadow-black/20 backdrop-blur-xs transition-colors motion-reduce:backdrop-blur-none sm:px-6 sm:py-5"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2.5">
            <PenLine aria-hidden="true" className="h-4 w-4 shrink-0 text-[var(--color-accent)]" />
            <p
              className={`font-story ${storyFontClass} text-base font-semibold tracking-wide text-[#F8FAFC] [text-shadow:0_1px_3px_rgba(0,0,0,0.45)] sm:text-lg`}
            >
              Bạn cũng có một câu chuyện muốn kể?
            </p>
          </div>
          <p
            className={`font-story ${storyFontClass} pl-6.5 text-sm leading-relaxed text-[#F8FAFC]/75 [text-shadow:0_1px_2px_rgba(0,0,0,0.35)]`}
          >
            Tạo câu chuyện tương tác của riêng bạn với bối cảnh, âm thanh và hiệu ứng.
          </p>
        </div>

        <div className="shrink-0 pt-0.5 sm:pt-0">
          {isGuest ? (
            <>
              <button
                ref={triggerRef}
                type="button"
                onClick={() => setIsLoginOpen(true)}
                aria-label="Bắt đầu sáng tác"
                aria-haspopup="dialog"
                className={`group inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-4 py-2 font-story ${storyFontClass} text-sm font-medium text-[#F8FAFC] [text-shadow:0_1px_2px_rgba(0,0,0,0.4)] transition-all hover:border-[var(--color-accent)]/60 hover:bg-white/10 hover:text-[var(--color-accent)] motion-reduce:transition-none`}
              >
                <span>Bắt đầu sáng tác</span>
                <ArrowRight
                  aria-hidden="true"
                  className="h-4 w-4 text-[var(--color-accent)] transition-transform group-hover:translate-x-1 motion-reduce:transform-none"
                />
              </button>

              <LoginDialog
                isOpen={isLoginOpen}
                onClose={() => setIsLoginOpen(false)}
                variant="creator"
                triggerRef={triggerRef}
              />
            </>
          ) : (
            <Link
              href="/author/stories/new"
              aria-label="Bắt đầu sáng tác"
              className={`group inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-4 py-2 font-story ${storyFontClass} text-sm font-medium text-[#F8FAFC] [text-shadow:0_1px_2px_rgba(0,0,0,0.4)] transition-all hover:border-[var(--color-accent)]/60 hover:bg-white/10 hover:text-[var(--color-accent)] motion-reduce:transition-none`}
            >
              <span>Bắt đầu sáng tác</span>
              <ArrowRight
                aria-hidden="true"
                className="h-4 w-4 text-[var(--color-accent)] transition-transform group-hover:translate-x-1 motion-reduce:transform-none"
              />
            </Link>
          )}
        </div>
      </div>
    </aside>
  );
}
