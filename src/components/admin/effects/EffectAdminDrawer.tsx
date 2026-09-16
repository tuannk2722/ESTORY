"use client";

import {
  RefreshCw,
  Save,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { useConfirm } from "@/components/ui/ConfirmModal";
import {
  EffectAdminRequestError,
  updateEffectMetadata,
  type EffectAdminCapabilities,
  type EffectAdminListItem,
} from "../effectAdminTransport";
import KeywordEditor from "./EffectKeywordEditor";
import { ErrorSummary, InlineError, toFieldErrors, type FieldError } from "./EffectAdminErrors";
import EffectPreview from "./EffectPreview";

const CATEGORY_LABELS = {
  visual: "Hình ảnh",
  audio: "Âm thanh",
  motion: "Chuyển động",
  transition: "Chuyển cảnh",
} as const;

export default function EffectAdminDrawer({
  effect,
  capabilities,
  onClose,
  onReload,
  closeRequestRef,
}: {
  effect: EffectAdminListItem;
  capabilities: EffectAdminCapabilities;
  onClose: () => void;
  onReload: () => Promise<void>;
  closeRequestRef: React.RefObject<(() => void) | null>;
}) {
  const confirm = useConfirm();
  const panelRef = useRef<HTMLDivElement>(null);
  const summaryRef = useRef<HTMLDivElement>(null);
  const [label, setLabel] = useState(effect.label);
  const [description, setDescription] = useState(effect.description ?? "");
  const [isActive, setIsActive] = useState(effect.is_active);
  const [keywords, setKeywords] = useState(effect.keywords);
  const [revision, setRevision] = useState(effect.updated_at);
  const [keywordDirty, setKeywordDirty] = useState(false);
  const [keywordPending, setKeywordPending] = useState(false);
  const [pending, setPending] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [stale, setStale] = useState(false);
  const [errors, setErrors] = useState<FieldError[]>([]);

  const metadataDirty = label !== effect.label
    || description !== (effect.description ?? "")
    || isActive !== effect.is_active;
  const dirty = metadataDirty || keywordDirty;
  const dirtyRef = useRef(dirty);
  const pendingRef = useRef(pending);
  const confirmingRef = useRef(confirming);
  const keywordPendingRef = useRef(keywordPending);
  useEffect(() => { dirtyRef.current = dirty; }, [dirty]);
  useEffect(() => { pendingRef.current = pending; }, [pending]);
  useEffect(() => { keywordPendingRef.current = keywordPending; }, [keywordPending]);

  const focusErrors = useCallback((nextErrors: FieldError[]) => {
    setErrors(nextErrors);
    if (nextErrors.length) requestAnimationFrame(() => summaryRef.current?.focus());
  }, []);

  const confirmInDrawer = useCallback<ReturnType<typeof useConfirm>>(async (options) => {
    if (confirmingRef.current) return false;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    confirmingRef.current = true;
    setConfirming(true);
    try {
      return await confirm(options);
    } finally {
      confirmingRef.current = false;
      setConfirming(false);
      // ConfirmModal's synchronous focus return can run while this panel is inert.
      requestAnimationFrame(() => {
        if (trigger?.isConnected) trigger.focus();
      });
    }
  }, [confirm]);

  const requestClose = useCallback(async () => {
    if (pendingRef.current || keywordPendingRef.current || confirmingRef.current) return;
    if (!dirtyRef.current) {
      onClose();
      return;
    }
    const accepted = await confirmInDrawer({
      title: "Bỏ thay đổi?",
      description: "Các nội dung chưa lưu trong bảng điều khiển hiệu ứng sẽ bị mất.",
      confirmText: "Bỏ thay đổi",
      cancelText: "Tiếp tục chỉnh sửa",
      variant: "warning",
    });
    if (accepted) onClose();
  }, [confirmInDrawer, onClose]);

  useEffect(() => {
    closeRequestRef.current = () => { void requestClose(); };
    return () => { closeRequestRef.current = null; };
  }, [closeRequestRef, requestClose]);

  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirtyRef.current && !pendingRef.current && !keywordPendingRef.current) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
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

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (pending || keywordPending || stale || confirming || !metadataDirty || !capabilities.canEditMetadata) return;
    const validation: FieldError[] = [];
    if (!label.trim()) validation.push({ id: "effect-label", message: "Tên hiển thị không được để trống." });
    focusErrors(validation);
    if (validation.length) return;
    if (keywordDirty) {
      const proceed = await confirmInDrawer({
        title: "Có từ khóa đang soạn",
        description: "Nội dung từ khóa đang nhập hoặc chỉnh sửa sẽ bị mất nếu tiếp tục lưu. Bạn có muốn lưu metadata và bỏ bản nháp từ khóa?",
        confirmText: "Lưu và bỏ nháp",
        cancelText: "Quay lại chỉnh sửa",
        variant: "warning",
      });
      if (!proceed) return;
    }
    setPending(true);
    setStale(false);
    try {
      await updateEffectMetadata({
        effectId: effect.id,
        label: label.trim(),
        description: description.trim(),
        isActive,
        expectedUpdatedAt: revision,
      });
      toast.success(`Đã lưu hiệu ứng “${label.trim()}”.`);
      onClose();
    } catch (error) {
      if (error instanceof EffectAdminRequestError && error.status === 409) setStale(true);
      focusErrors(toFieldErrors(error, "effect-label"));
    } finally {
      setPending(false);
    }
  };

  const reload = async () => {
    if (pending || keywordPending || confirming) return;
    if (dirty && !await confirmInDrawer({
      title: "Bỏ thay đổi?",
      description: "Tải dữ liệu mới sẽ thay thế các nội dung chưa lưu trong bảng chỉnh sửa.",
      confirmText: "Tải và bỏ thay đổi",
      cancelText: "Tiếp tục chỉnh sửa",
      variant: "warning",
    })) return;
    setPending(true);
    try {
      await onReload();
    } catch (error) {
      focusErrors(toFieldErrors(error, "effect-reload"));
    } finally {
      setPending(false);
    }
  };

  const drawer = (
    <div className="fixed inset-0 z-[80]" aria-hidden={false}>
      <button
        type="button"
        aria-label="Đóng bảng chỉnh sửa hiệu ứng"
        onClick={() => void requestClose()}
        disabled={pending || keywordPending}
        className="absolute inset-0 h-full w-full cursor-default bg-black/70 backdrop-blur-sm disabled:cursor-wait"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="effect-drawer-title"
        tabIndex={-1}
        inert={confirming}
        className="absolute inset-y-0 right-0 flex h-full w-full flex-col border-l border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-card-foreground)] shadow-2xl motion-safe:animate-[slide-in-right_180ms_ease-out] md:max-w-xl"
      >
        <header className="sticky top-0 z-10 flex min-h-16 items-start justify-between gap-3 border-b border-[var(--color-border)] bg-[var(--color-card)]/95 px-4 py-3 backdrop-blur sm:px-5">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-muted-foreground)]">Chi tiết hiệu ứng</p>
            <h2 id="effect-drawer-title" className="mt-1 truncate font-display text-xl font-bold">{effect.label}</h2>
          </div>
          <button type="button" onClick={() => void requestClose()} disabled={pending || keywordPending} aria-label="Đóng" className="flex min-h-11 min-w-11 items-center justify-center rounded-xl hover:bg-[var(--color-muted)] disabled:cursor-wait disabled:opacity-50"><X aria-hidden="true" className="h-5 w-5" /></button>
        </header>

        <form onSubmit={save} noValidate className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-4 py-5 pb-32 scroll-pb-32 sm:px-5">
            <ErrorSummary errors={errors} summaryRef={summaryRef} />
            {stale ? (
              <button id="effect-reload" type="button" onClick={() => void reload()} disabled={pending} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--color-warning)] px-3 text-sm font-semibold text-[var(--color-warning)] hover:bg-[var(--color-warning)]/10"><RefreshCw aria-hidden="true" className="h-4 w-4" /> Tải dữ liệu mới</button>
            ) : null}

            <dl className="grid grid-cols-[7rem_minmax(0,1fr)] gap-x-3 gap-y-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-muted)]/35 p-4 text-sm">
              <dt className="text-[var(--color-muted-foreground)]">Technical ID</dt><dd className="truncate font-mono text-xs font-semibold">{effect.id}</dd>
              <dt className="text-[var(--color-muted-foreground)]">Danh mục</dt><dd className="font-semibold">{CATEGORY_LABELS[effect.category]}</dd>
            </dl>

            <div className="space-y-4">
              <div>
                <label htmlFor="effect-label" className="text-sm font-semibold">Tên hiển thị</label>
                <input id="effect-label" value={label} onChange={(event) => setLabel(event.target.value)} maxLength={120} disabled={!capabilities.canEditMetadata || pending || stale} aria-invalid={errors.some((error) => error.id === "effect-label")} aria-describedby={errors.some((error) => error.id === "effect-label") ? "effect-label-error" : undefined} className="mt-1.5 min-h-11 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] px-3 text-sm disabled:opacity-60" />
                <InlineError id="effect-label" errors={errors} />
              </div>
              <div>
                <label htmlFor="effect-description" className="text-sm font-semibold">Mô tả</label>
                <textarea id="effect-description" value={description} onChange={(event) => setDescription(event.target.value)} maxLength={2000} rows={4} disabled={!capabilities.canEditMetadata || pending || stale} aria-invalid={errors.some((error) => error.id === "effect-description")} aria-describedby={errors.some((error) => error.id === "effect-description") ? "effect-description-error" : undefined} className="mt-1.5 w-full resize-y rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2.5 text-sm leading-6 disabled:opacity-60" />
                <InlineError id="effect-description" errors={errors} />
              </div>
              <div className="rounded-2xl border border-[var(--color-border)] p-4">
                <label htmlFor="effect-active" className="flex cursor-pointer items-start gap-3">
                  <input id="effect-active" type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} disabled={!capabilities.canEditMetadata || pending || stale} className="mt-0.5 h-5 w-5 accent-[var(--color-primary)] disabled:opacity-60" />
                  <span><span className="block text-sm font-bold">Đang hoạt động</span><span className="mt-1 block text-xs leading-5 text-[var(--color-muted-foreground)]">Ẩn khỏi lựa chọn/gợi ý mới; nội dung đã lưu vẫn render.</span></span>
                </label>
              </div>
            </div>

            <KeywordEditor
              effect={effect}
              keywords={keywords}
              revision={revision}
              disabled={!capabilities.canManageKeywords || pending || stale}
              errors={errors}
              onKeywordsChange={setKeywords}
              onRevisionChange={setRevision}
              onErrors={focusErrors}
              onDirtyChange={setKeywordDirty}
              onPendingChange={setKeywordPending}
              onStale={() => setStale(true)}
              confirm={confirmInDrawer}
            />

            <EffectPreview effect={{ ...effect, label, description: description || undefined, is_active: isActive, updated_at: revision }} />
          </div>

          <footer className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--color-border)] bg-[var(--color-card)]/95 px-4 py-3 pb-[max(.75rem,env(safe-area-inset-bottom))] backdrop-blur sm:px-5">
            <p className="text-xs text-[var(--color-muted-foreground)]">{dirty ? "Có thay đổi chưa lưu" : "Mọi thay đổi đã được lưu"}</p>
            <div className="flex gap-2">
              <button type="button" onClick={() => void requestClose()} disabled={pending || keywordPending} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[var(--color-border)] px-4 text-sm font-semibold hover:bg-[var(--color-muted)] disabled:opacity-50">Hủy</button>
              <button type="submit" disabled={!metadataDirty || pending || keywordPending || stale || !capabilities.canEditMetadata} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[var(--color-primary)] px-4 text-sm font-semibold text-[var(--color-primary-foreground)] hover:bg-[var(--color-primary-hover)] disabled:cursor-not-allowed disabled:opacity-50"><Save aria-hidden="true" className="h-4 w-4" /> {pending ? "Đang lưu…" : "Lưu"}</button>
            </div>
          </footer>
        </form>
      </div>
    </div>
  );

  return typeof document === "undefined" ? null : createPortal(drawer, document.body);
}
