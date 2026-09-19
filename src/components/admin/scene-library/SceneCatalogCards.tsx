"use client";

import {
  Archive,
  ChevronUp,
  LoaderCircle,
  MoreHorizontal,
  Pencil,
  Trash2,
} from "lucide-react";
import {
  useEffect,
  useId,
  useRef,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import type { BackgroundType, CatalogStatus } from "@/types/scene";
import type {
  ManagedBackgroundAsset,
  ManagedColorPalette,
} from "@/types/scene-catalog-admin";
import SceneCatalogPreview from "./SceneCatalogPreview";

const STATUS_LABELS: Record<CatalogStatus, string> = {
  draft: "Nháp",
  active: "Đang dùng",
  archived: "Đã lưu trữ",
};

const TYPE_LABELS: Record<BackgroundType, string> = {
  image: "Ảnh",
  video: "Video",
  gradient: "Linear gradient",
  radial_gradient: "Radial gradient",
  particle_composition: "Particle",
};

export function CatalogStatusBadge({ status }: { status: CatalogStatus }) {
  const classes = status === "active"
    ? "border-[var(--color-success)]/35 bg-[var(--color-success)]/10 text-[var(--color-success)]"
    : status === "draft"
      ? "border-[var(--color-warning)]/40 bg-[var(--color-warning)]/10 text-[var(--color-warning)]"
      : "border-[var(--color-border)] bg-[var(--color-muted)] text-[var(--color-muted-foreground)]";
  const dot = status === "active"
    ? "bg-[var(--color-success)]"
    : status === "draft"
      ? "bg-[var(--color-warning)]"
      : "bg-[var(--color-muted-foreground)]";
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-bold shadow-sm backdrop-blur-sm ${classes}`}>
      <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {STATUS_LABELS[status]}
    </span>
  );
}

function MoodTags({ tags }: { tags: string[] }) {
  if (!tags.length) {
    return <p className="text-xs text-[var(--color-muted-foreground)]">Chưa có mood tag</p>;
  }
  const shown = tags.slice(0, 3);
  return (
    <div className="flex flex-wrap gap-1.5" aria-label={`Mood tags: ${tags.join(", ")}`}>
      {shown.map((tag) => (
        <span key={tag} className="max-w-28 truncate rounded-full bg-[var(--color-muted)] px-2 py-1 text-[10px] font-semibold text-[var(--color-muted-foreground)]" title={tag}>
          {tag}
        </span>
      ))}
      {tags.length > shown.length ? (
        <span className="rounded-full border border-[var(--color-border)] px-2 py-1 text-[10px] font-semibold text-[var(--color-muted-foreground)]">
          +{tags.length - shown.length}
        </span>
      ) : null}
    </div>
  );
}

interface MenuAction {
  id: string;
  label: string;
  icon: ReactNode;
  destructive?: boolean;
  onSelect: () => void;
}

function CatalogCardMenu({
  label,
  open,
  pending,
  actions,
  onOpenChange,
}: {
  label: string;
  open: boolean;
  pending: boolean;
  actions: MenuAction[];
  onOpenChange: (open: boolean) => void;
}) {
  const menuId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => {
      menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();
    });
    const pointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!menuRef.current?.contains(target) && !triggerRef.current?.contains(target)) {
        onOpenChange(false);
      }
    };
    const keyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onOpenChange(false);
      requestAnimationFrame(() => triggerRef.current?.focus());
    };
    document.addEventListener("pointerdown", pointerDown, true);
    window.addEventListener("keydown", keyDown);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("pointerdown", pointerDown, true);
      window.removeEventListener("keydown", keyDown);
    };
  }, [onOpenChange, open]);

  const moveFocus = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? []);
    if (!items.length) return;
    event.preventDefault();
    const current = items.indexOf(document.activeElement as HTMLButtonElement);
    const next = event.key === "Home"
      ? 0
      : event.key === "End"
        ? items.length - 1
        : event.key === "ArrowDown"
          ? (current + 1 + items.length) % items.length
          : (current - 1 + items.length) % items.length;
    items[next]?.focus();
  };

  return (
    <div className="relative shrink-0">
      <button
        ref={triggerRef}
        type="button"
        aria-label={`Thao tác với ${label}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => onOpenChange(!open)}
        disabled={pending}
        className="flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-[var(--color-border)] text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-ring)] disabled:opacity-50"
      >
        {pending
          ? <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin motion-reduce:animate-none" />
          : <MoreHorizontal aria-hidden="true" className="h-4 w-4" />}
      </button>
      {open ? (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label={`Thao tác với ${label}`}
          onKeyDown={moveFocus}
          className="absolute bottom-[calc(100%+.5rem)] right-0 z-30 min-w-48 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-1.5 shadow-xl"
        >
          {actions.map((action) => (
            <button
              key={action.id}
              role="menuitem"
              type="button"
              onClick={() => { onOpenChange(false); action.onSelect(); }}
              className={`flex min-h-10 w-full items-center gap-2 rounded-lg px-3 text-left text-sm font-medium transition-colors ${action.destructive
                ? "text-[var(--color-destructive)] hover:bg-[var(--color-destructive)]/10"
                : "hover:bg-[var(--color-muted)]"}`}
            >
              {action.icon}
              {action.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function cardActions(
  kind: "background" | "palette",
  item: ManagedBackgroundAsset | ManagedColorPalette,
  onTransition: (target: "active" | "archived") => void,
  onDelete: () => void,
): MenuAction[] {
  return [
    ...(item.status !== "active" ? [{
      id: `${kind}-activate`,
      label: "Kích hoạt",
      icon: <ChevronUp aria-hidden="true" className="h-4 w-4" />,
      onSelect: () => onTransition("active"),
    }] : []),
    ...(item.status !== "archived" ? [{
      id: `${kind}-archive`,
      label: "Lưu trữ",
      icon: <Archive aria-hidden="true" className="h-4 w-4" />,
      onSelect: () => onTransition("archived"),
    }] : []),
    ...(item.can_hard_delete ? [{
      id: `${kind}-delete`,
      label: "Xóa vĩnh viễn",
      icon: <Trash2 aria-hidden="true" className="h-4 w-4" />,
      destructive: true,
      onSelect: onDelete,
    }] : []),
  ];
}

export function BackgroundCatalogCard({
  item,
  menuOpen,
  pending,
  onMenuOpenChange,
  onEdit,
  onTransition,
  onDelete,
}: {
  item: ManagedBackgroundAsset;
  menuOpen: boolean;
  pending: boolean;
  onMenuOpenChange: (open: boolean) => void;
  onEdit: () => void;
  onTransition: (target: "active" | "archived") => void;
  onDelete: () => void;
}) {
  const kind = item.render.render_data.kind;
  const motionLabel = kind === "image" && item.render.motion === "looping"
    ? "Chuyển động legacy"
    : item.render.motion === "looping"
      ? "Lặp"
      : "Tĩnh";
  return (
    <article className="relative flex min-w-0 flex-col rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-sm transition-colors hover:border-[var(--color-primary)]/30">
      <div className="relative overflow-hidden rounded-t-[calc(1rem-1px)] border-b border-[var(--color-border)]">
        <SceneCatalogPreview background={item.render} label={`Thumbnail tĩnh của ${item.label}`} compact />
        <div className="absolute right-2.5 top-2.5 z-10 rounded-full bg-[var(--color-card)]/95 shadow-sm">
          <CatalogStatusBadge status={item.status} />
        </div>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <div>
          <h2 className="line-clamp-2 font-display text-lg font-bold leading-snug" title={item.label}>{item.label}</h2>
          <p className="mt-1 truncate font-mono text-[11px] text-[var(--color-muted-foreground)]" title={item.id}>{item.id}</p>
          <p className="mt-3 text-xs font-semibold text-[var(--color-muted-foreground)]">
            {TYPE_LABELS[kind]} <span aria-hidden="true">·</span> {motionLabel}
          </p>
          <div className="mt-3"><MoodTags tags={item.mood_tags} /></div>
        </div>
        <div className="mt-auto flex items-center gap-2 pt-5">
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-[var(--color-border)] px-3 text-sm font-semibold text-[var(--color-primary)] transition-colors hover:bg-[var(--color-muted)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-ring)]"
          >
            <Pencil aria-hidden="true" className="h-4 w-4" /> Chỉnh sửa
          </button>
          <CatalogCardMenu
            label={item.label}
            open={menuOpen}
            pending={pending}
            actions={cardActions("background", item, onTransition, onDelete)}
            onOpenChange={onMenuOpenChange}
          />
        </div>
      </div>
    </article>
  );
}

export function PaletteCatalogCard({
  item,
  menuOpen,
  pending,
  onMenuOpenChange,
  onEdit,
  onTransition,
  onDelete,
}: {
  item: ManagedColorPalette;
  menuOpen: boolean;
  pending: boolean;
  onMenuOpenChange: (open: boolean) => void;
  onEdit: () => void;
  onTransition: (target: "active" | "archived") => void;
  onDelete: () => void;
}) {
  const tintPercent = Math.round(item.colors.background_tint.opacity * 100);
  return (
    <article className="relative flex min-w-0 flex-col rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-sm transition-colors hover:border-[var(--color-primary)]/30">
      <div
        role="img"
        className="relative aspect-video overflow-hidden rounded-t-[calc(1rem-1px)] border-b border-[var(--color-border)]"
        aria-label={`Bảng màu ${item.label}: primary ${item.colors.primary}, secondary ${item.colors.secondary}, accent ${item.colors.accent}, tint ${item.colors.background_tint.color} độ phủ ${tintPercent}%`}
      >
        <div aria-hidden="true" className="absolute inset-0 grid grid-cols-4">
          <div style={{ backgroundColor: item.colors.primary }} />
          <div style={{ backgroundColor: item.colors.secondary }} />
          <div style={{ backgroundColor: item.colors.accent }} />
          <div className="relative bg-slate-950">
            <div className="absolute inset-0" style={{ backgroundColor: item.colors.background_tint.color, opacity: item.colors.background_tint.opacity }} />
          </div>
        </div>
        <div aria-hidden="true" className="absolute inset-x-0 bottom-0 grid grid-cols-4 bg-black/45 py-1.5 text-center text-[9px] font-bold uppercase tracking-wide text-white backdrop-blur-sm">
          <span>Primary</span><span>Secondary</span><span>Accent</span><span>Tint</span>
        </div>
        <div className="absolute right-2.5 top-2.5 z-10 rounded-full bg-[var(--color-card)]/95 shadow-sm">
          <CatalogStatusBadge status={item.status} />
        </div>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <div>
          <h2 className="line-clamp-2 font-display text-lg font-bold leading-snug" title={item.label}>{item.label}</h2>
          <p className="mt-1 truncate font-mono text-[11px] text-[var(--color-muted-foreground)]" title={item.id}>{item.id}</p>
          <p className="mt-3 text-xs font-semibold text-[var(--color-muted-foreground)]">Độ phủ nền {tintPercent}%</p>
          <div className="mt-3"><MoodTags tags={item.mood_tags} /></div>
        </div>
        <div className="mt-auto flex items-center gap-2 pt-5">
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-[var(--color-border)] px-3 text-sm font-semibold text-[var(--color-primary)] transition-colors hover:bg-[var(--color-muted)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-ring)]"
          >
            <Pencil aria-hidden="true" className="h-4 w-4" /> Chỉnh sửa
          </button>
          <CatalogCardMenu
            label={item.label}
            open={menuOpen}
            pending={pending}
            actions={cardActions("palette", item, onTransition, onDelete)}
            onOpenChange={onMenuOpenChange}
          />
        </div>
      </div>
    </article>
  );
}
