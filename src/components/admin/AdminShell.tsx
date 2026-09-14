"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookCheck,
  ChevronLeft,
  ChevronRight,
  House,
  Layers3,
  Menu,
  ShieldCheck,
  Sparkles,
  UserRound,
  WandSparkles,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import ThemeSwitcher from "@/components/ui/ThemeSwitcher";

interface AdminIdentity {
  name: string | null;
  email: string;
}

interface AdminShellProps {
  children: ReactNode;
  identity: AdminIdentity;
  pendingCount: number | null;
}

interface NavigationItem {
  label: string;
  href: string;
  icon: LucideIcon;
  enabled: boolean;
  stage?: string;
  pending?: boolean;
}

const administrationItems: NavigationItem[] = [
  {
    label: "Duyệt truyện",
    href: "/admin/stories",
    icon: BookCheck,
    enabled: true,
    pending: true,
  },
  {
    label: "Hiệu ứng",
    href: "/admin/effects",
    icon: WandSparkles,
    enabled: false,
    stage: "P3-12",
  },
  {
    label: "Bối cảnh",
    href: "/admin/scene-library",
    icon: Layers3,
    enabled: false,
    stage: "P3-13",
  },
];

const systemItems: NavigationItem[] = [
  {
    label: "Về trang đọc",
    href: "/",
    icon: House,
    enabled: true,
  },
];

function PendingBadge({ count, collapsed }: { count: number | null; collapsed: boolean }) {
  if (count === null || count === 0) return null;
  if (collapsed) {
    return (
      <span
        role="status"
        className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-[var(--color-warning)] ring-2 ring-[var(--color-card)]"
        aria-label={`${count} truyện đang chờ duyệt`}
      />
    );
  }
  return (
    <span
      className="ml-auto min-w-6 rounded-full bg-[var(--color-warning)]/20 px-2 py-0.5 text-center text-xs font-bold text-[var(--color-warning)]"
      aria-label={`${count} truyện đang chờ duyệt`}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

function NavigationGroup({
  title,
  items,
  collapsed,
  pendingCount,
  onNavigate,
}: {
  title: string;
  items: NavigationItem[];
  collapsed: boolean;
  pendingCount: number | null;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  return (
    <div className="space-y-1">
      <p
        className={`px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--color-muted-foreground)] ${collapsed ? "sr-only" : ""}`}
      >
        {title}
      </p>
      {items.map((item) => {
        const Icon = item.icon;
        const active = item.enabled && (pathname === item.href || pathname.startsWith(`${item.href}/`));
        const sharedClass = `group relative flex min-h-11 w-full items-center rounded-xl border text-sm font-semibold transition-colors motion-reduce:transition-none ${collapsed ? "justify-center px-2" : "gap-3 px-3"}`;
        const content = (
          <>
            <Icon aria-hidden="true" className="h-5 w-5 shrink-0" />
            <span className={collapsed ? "sr-only" : "truncate"}>{item.label}</span>
            {item.pending ? <PendingBadge count={pendingCount} collapsed={collapsed} /> : null}
            {!item.enabled && !collapsed ? (
              <span className="ml-auto shrink-0 rounded-full border border-[var(--color-border)] px-2 py-0.5 text-[10px] font-medium text-[var(--color-muted-foreground)]">
                {item.stage}
              </span>
            ) : null}
            {collapsed ? (
              <span
                role="tooltip"
                className="pointer-events-none absolute left-[calc(100%+0.5rem)] z-50 hidden whitespace-nowrap rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-2.5 py-1.5 text-xs font-semibold text-[var(--color-card-foreground)] shadow-lg group-hover:block group-focus-visible:block"
              >
                {item.label}{item.enabled ? "" : ` · Sắp có (${item.stage})`}
              </span>
            ) : null}
          </>
        );

        if (!item.enabled) {
          return (
            <button
              key={item.href}
              type="button"
              aria-disabled="true"
              aria-label={`${item.label}, sắp có trong ${item.stage}`}
              className={`${sharedClass} cursor-not-allowed border-transparent text-[var(--color-muted-foreground)] opacity-70`}
            >
              {content}
            </button>
          );
        }

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            aria-label={collapsed ? item.label : undefined}
            className={`${sharedClass} ${active
              ? "border-[var(--color-primary)]/35 bg-[var(--color-primary)]/15 text-[var(--color-primary)]"
              : "border-transparent text-[var(--color-foreground)] hover:border-[var(--color-border)] hover:bg-[var(--color-muted)]"
            }`}
          >
            {content}
          </Link>
        );
      })}
    </div>
  );
}

function Identity({ identity, collapsed }: { identity: AdminIdentity; collapsed: boolean }) {
  const label = identity.name?.trim() || "Quản trị viên";
  return (
    <div className={`flex min-w-0 items-center rounded-xl border border-[var(--color-border)] bg-[var(--color-muted)]/55 ${collapsed ? "justify-center p-2" : "gap-3 p-3"}`}>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary)]/15 text-[var(--color-primary)]">
        <UserRound aria-hidden="true" className="h-4 w-4" />
      </span>
      <span className={collapsed ? "sr-only" : "min-w-0"}>
        <span className="block truncate text-sm font-semibold text-[var(--color-foreground)]">{label}</span>
        <span className="block truncate text-xs text-[var(--color-muted-foreground)]">{identity.email}</span>
      </span>
    </div>
  );
}

function NavigationPanel({
  identity,
  pendingCount,
  collapsed,
  onNavigate,
}: {
  identity: AdminIdentity;
  pendingCount: number | null;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  return (
    <>
      <nav aria-label="Điều hướng quản trị" className="flex-1 space-y-5 overflow-y-auto px-3 py-3">
        <NavigationGroup
          title="Quản trị"
          items={administrationItems}
          collapsed={collapsed}
          pendingCount={pendingCount}
          onNavigate={onNavigate}
        />
        <NavigationGroup
          title="Hệ thống"
          items={systemItems}
          collapsed={collapsed}
          pendingCount={pendingCount}
          onNavigate={onNavigate}
        />
      </nav>
      <div className="space-y-3 border-t border-[var(--color-border)] p-3">
        <Identity identity={identity} collapsed={collapsed} />
        <ThemeSwitcher compact={collapsed} iconOnly={collapsed} />
      </div>
    </>
  );
}

function AdminSidebar({ identity, pendingCount }: Omit<AdminShellProps, "children">) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <aside
      className={`hidden h-dvh shrink-0 flex-col border-r border-[var(--color-border)] bg-[var(--color-card)] transition-[width] duration-200 motion-reduce:transition-none lg:flex ${collapsed ? "w-[72px]" : "w-64"}`}
    >
      <div className={`flex min-h-20 items-center border-b border-[var(--color-border)] ${collapsed ? "justify-center px-2" : "justify-between gap-2 px-4"}`}>
        <Link
          href="/admin/stories"
          aria-label="StoryVerse Quản trị"
          className="flex min-h-11 min-w-11 items-center justify-center gap-3 rounded-xl"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-primary)] text-[var(--color-primary-foreground)] shadow-sm">
            <Sparkles aria-hidden="true" className="h-5 w-5 text-[var(--color-accent)]" />
          </span>
          {collapsed ? null : (
            <span className="min-w-0">
              <span className="block truncate font-display text-lg font-bold">StoryVerse</span>
              <span className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-muted-foreground)]">Quản trị</span>
            </span>
          )}
        </Link>
        {!collapsed ? (
          <button
            type="button"
            onClick={() => setCollapsed(true)}
            aria-expanded="true"
            aria-label="Thu gọn thanh điều hướng"
            className="flex min-h-11 min-w-11 items-center justify-center rounded-xl text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]"
          >
            <ChevronLeft aria-hidden="true" className="h-5 w-5" />
          </button>
        ) : null}
      </div>
      {collapsed ? (
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          aria-expanded="false"
          aria-label="Mở rộng thanh điều hướng"
          className="mx-auto mt-3 flex min-h-11 min-w-11 items-center justify-center rounded-xl text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]"
        >
          <ChevronRight aria-hidden="true" className="h-5 w-5" />
        </button>
      ) : null}
      <NavigationPanel
        identity={identity}
        pendingCount={pendingCount}
        collapsed={collapsed}
      />
    </aside>
  );
}

function AdminMobileNav({ identity, pendingCount }: Omit<AdminShellProps, "children">) {
  const [open, setOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const handleBreakpoint = (event: MediaQueryListEvent) => {
      if (event.matches) setOpen(false);
    };
    media.addEventListener("change", handleBreakpoint);
    return () => media.removeEventListener("change", handleBreakpoint);
  }, []);

  useEffect(() => {
    if (!open) return;
    const menuButton = menuButtonRef.current;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusFrame = requestAnimationFrame(() => {
      sheetRef.current?.querySelector<HTMLElement>("button, [href]")?.focus();
    });
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }
      if (event.key !== "Tab" || !sheetRef.current) return;
      const focusable = sheetRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || !sheetRef.current.contains(document.activeElement))) {
        last.focus();
        event.preventDefault();
      } else if (!event.shiftKey && document.activeElement === last) {
        first.focus();
        event.preventDefault();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      cancelAnimationFrame(focusFrame);
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = originalOverflow;
      requestAnimationFrame(() => menuButton?.focus());
    };
  }, [close, open]);

  const sheet = open ? (
    <div className="fixed inset-0 z-[80] lg:hidden" aria-hidden={false}>
      <button
        type="button"
        aria-label="Đóng menu quản trị"
        onClick={close}
        className="absolute inset-0 h-full w-full cursor-default bg-black/65 backdrop-blur-sm"
      />
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label="Menu quản trị"
        className="absolute inset-y-0 left-0 flex w-[min(20rem,calc(100vw-2rem))] flex-col border-r border-[var(--color-border)] bg-[var(--color-card)] shadow-2xl"
      >
        <div className="flex min-h-16 items-center justify-between gap-3 border-b border-[var(--color-border)] px-4">
          <span className="flex items-center gap-2 font-display text-lg font-bold">
            <ShieldCheck aria-hidden="true" className="h-5 w-5 text-[var(--color-primary)]" />
            StoryVerse · Quản trị
          </span>
          <button
            type="button"
            onClick={close}
            aria-label="Đóng menu"
            className="flex min-h-11 min-w-11 items-center justify-center rounded-xl hover:bg-[var(--color-muted)]"
          >
            <X aria-hidden="true" className="h-5 w-5" />
          </button>
        </div>
        <NavigationPanel
          identity={identity}
          pendingCount={pendingCount}
          collapsed={false}
          onNavigate={close}
        />
      </div>
    </div>
  ) : null;

  return (
    <>
      <header className="sticky top-0 z-40 flex min-h-16 items-center justify-between gap-3 border-b border-[var(--color-border)] bg-[var(--color-card)]/95 px-3 backdrop-blur-md lg:hidden">
        <button
          ref={menuButtonRef}
          type="button"
          onClick={() => setOpen(true)}
          aria-expanded={open}
          aria-controls="admin-mobile-navigation"
          aria-label="Mở menu quản trị"
          className="flex min-h-11 min-w-11 items-center justify-center rounded-xl hover:bg-[var(--color-muted)]"
        >
          <Menu aria-hidden="true" className="h-5 w-5" />
        </button>
        <span className="min-w-0 truncate font-display text-base font-bold sm:text-lg">StoryVerse · Quản trị</span>
        <ThemeSwitcher compact />
      </header>
      {typeof document === "undefined" ? null : createPortal(
        sheet ? <div id="admin-mobile-navigation">{sheet}</div> : null,
        document.body,
      )}
    </>
  );
}

export default function AdminShell({ children, identity, pendingCount }: AdminShellProps) {
  return (
    <div className="min-h-dvh w-full min-w-0 overflow-x-hidden bg-[var(--color-background)] text-[var(--color-foreground)] lg:flex lg:h-dvh lg:overflow-hidden">
      <AdminSidebar identity={identity} pendingCount={pendingCount} />
      <div className="min-w-0 flex-1 lg:h-dvh lg:overflow-y-auto">
        <AdminMobileNav identity={identity} pendingCount={pendingCount} />
        {children}
      </div>
    </div>
  );
}
