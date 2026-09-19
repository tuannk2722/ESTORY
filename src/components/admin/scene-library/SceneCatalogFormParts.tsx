"use client";

import { AlertCircle, X } from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { useConfirm } from "@/components/ui/ConfirmModal";
import {
  SceneCatalogRequestError,
  sceneCatalogErrorMessage,
} from "./sceneCatalogTransport";

export interface CatalogFieldError {
  id: string;
  message: string;
}

export function catalogFieldErrors(error: unknown, fallbackId: string = "catalog-general"): CatalogFieldError[] {
  if (!(error instanceof SceneCatalogRequestError) || !error.fieldErrors) {
    return [{ id: fallbackId, message: sceneCatalogErrorMessage(error) }];
  }
  const aliases: Record<string, string> = {
    label: "catalog-label",
    moodTags: "catalog-mood-tags",
    colors: "palette-primary",
    "colors.primary": "palette-primary",
    "colors.secondary": "palette-secondary",
    "colors.accent": "palette-accent",
    "colors.background_tint.color": "palette-tint",
    "colors.background_tint.opacity": "palette-opacity",
    render: "background-kind",
    "render.uploadId": "background-file",
    "render.posterUploadId": "background-poster",
    "render.angleDeg": "background-angle",
    "render.shape": "background-shape",
    "render.center": "background-center",
    "render.center.x": "background-center",
    "render.center.y": "background-center",
    "render.stops": "background-stops",
    "render.compositionKey": "background-composition",
    "render.motion": "background-motion",
    expectedUpdatedAt: fallbackId,
  };
  const fields = Object.entries(error.fieldErrors).flatMap(([key, messages]) => {
    let targetId = aliases[key];
    if (!targetId) {
      if (key.startsWith("render.stops")) targetId = "background-stops";
      else if (key.startsWith("render.center")) targetId = "background-center";
      else if (key.startsWith("colors")) targetId = "palette-primary";
      else targetId = fallbackId;
    }
    return messages.map((message) => ({ id: targetId, message }));
  });
  return fields.length ? fields : [{ id: fallbackId, message: sceneCatalogErrorMessage(error) }];
}

export function CatalogErrorSummary({
  errors,
  summaryRef,
}: {
  errors: CatalogFieldError[];
  summaryRef: RefObject<HTMLDivElement | null>;
}) {
  if (!errors.length) return null;
  return (
    <div
      ref={summaryRef}
      tabIndex={-1}
      role="alert"
      aria-labelledby="catalog-errors-title"
      className="rounded-2xl border border-[var(--color-destructive)]/55 bg-[var(--color-destructive)]/10 p-4"
    >
      <h3 id="catalog-errors-title" className="flex items-center gap-2 text-sm font-bold">
        <AlertCircle aria-hidden="true" className="h-4 w-4 text-[var(--color-destructive)]" />
        Có thông tin cần kiểm tra
      </h3>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
        {errors.map((error, index) => (
          <li key={`${error.id}-${index}`}>
            {error.id === "catalog-general" ? (
              <span>{error.message}</span>
            ) : (
              <a href={`#${error.id}`} className="underline underline-offset-2">{error.message}</a>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function CatalogInlineError({ id, errors }: { id: string; errors: CatalogFieldError[] }) {
  const error = errors.find((item) => item.id === id);
  return error ? <p id={`${id}-error`} role="alert" className="mt-1 text-xs font-medium text-[var(--color-destructive)]">{error.message}</p> : null;
}

export function SceneCatalogDrawerShell({
  title,
  kicker,
  dirty,
  pending,
  onClose,
  children,
  footer,
}: {
  title: string;
  kicker: string;
  dirty: boolean;
  pending: boolean;
  onClose: () => void;
  children: ReactNode;
  footer: ReactNode;
}) {
  const confirm = useConfirm();
  const panelRef = useRef<HTMLDivElement>(null);
  const confirmRef = useRef(confirm);
  const onCloseRef = useRef(onClose);
  const [confirming, setConfirming] = useState(false);
  const confirmingRef = useRef(false);
  const dirtyRef = useRef(dirty);
  const pendingRef = useRef(pending);
  useEffect(() => { confirmRef.current = confirm; }, [confirm]);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
  useEffect(() => { dirtyRef.current = dirty; }, [dirty]);
  useEffect(() => { pendingRef.current = pending; }, [pending]);

  const requestClose = useCallback(async () => {
    if (pendingRef.current) return;
    if (!dirtyRef.current) {
      onCloseRef.current();
      return;
    }
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    confirmingRef.current = true;
    setConfirming(true);
    const accepted = await confirmRef.current({
      title: "Bỏ thay đổi?",
      description: "Nội dung chưa lưu trong biểu mẫu sẽ bị mất.",
      confirmText: "Bỏ thay đổi",
      cancelText: "Tiếp tục chỉnh sửa",
      variant: "warning",
    });
    confirmingRef.current = false;
    setConfirming(false);
    if (accepted) onCloseRef.current();
    else requestAnimationFrame(() => trigger?.isConnected && trigger.focus());
  }, []);

  useEffect(() => {
    const priorOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.body.style.overflow = "hidden";
    const frame = requestAnimationFrame(() => panelRef.current?.focus());
    const onKeyDown = (event: KeyboardEvent) => {
      if (confirmingRef.current) return;
      if (event.key === "Escape") {
        event.preventDefault();
        void requestClose();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ));
      if (!focusable.length) { event.preventDefault(); panelRef.current.focus(); return; }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === panelRef.current)) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = priorOverflow;
      requestAnimationFrame(() => previousFocus?.isConnected && previousFocus.focus());
    };
  }, [requestClose]);

  const drawer = (
    <div className="fixed inset-0 z-[80]">
      <button
        type="button"
        aria-label="Đóng biểu mẫu"
        onClick={() => void requestClose()}
        disabled={pending}
        className="absolute inset-0 h-full w-full cursor-default bg-black/70 backdrop-blur-sm disabled:cursor-wait"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="scene-catalog-drawer-title"
        tabIndex={-1}
        inert={confirming}
        className="absolute inset-y-0 right-0 flex h-full w-full flex-col border-l border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-card-foreground)] shadow-2xl motion-safe:animate-[slide-in-right_180ms_ease-out] md:max-w-2xl"
      >
        <header className="flex min-h-16 items-start justify-between gap-3 border-b border-[var(--color-border)] px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-muted-foreground)]">{kicker}</p>
            <h2 id="scene-catalog-drawer-title" className="mt-1 truncate font-display text-xl font-bold">{title}</h2>
          </div>
          <button type="button" onClick={() => void requestClose()} disabled={pending} aria-label="Đóng" className="flex min-h-11 min-w-11 items-center justify-center rounded-xl hover:bg-[var(--color-muted)] disabled:opacity-50"><X aria-hidden="true" className="h-5 w-5" /></button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 pb-32 scroll-pb-32 sm:px-5">{children}</div>
        <footer className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--color-border)] bg-[var(--color-card)]/95 px-4 py-3 pb-[max(.75rem,env(safe-area-inset-bottom))] backdrop-blur sm:px-5">
          <p className="text-xs text-[var(--color-muted-foreground)]">{dirty ? "Có thay đổi chưa lưu" : "Chưa có thay đổi"}</p>
          <div className="flex gap-2">
            <button type="button" onClick={() => void requestClose()} disabled={pending} className="min-h-11 rounded-xl border border-[var(--color-border)] px-4 text-sm font-semibold hover:bg-[var(--color-muted)] disabled:opacity-50">Hủy</button>
            {footer}
          </div>
        </footer>
      </div>
    </div>
  );
  return typeof document === "undefined" ? null : createPortal(drawer, document.body);
}
