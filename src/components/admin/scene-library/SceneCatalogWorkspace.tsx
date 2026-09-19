"use client";

import {
  ChevronRight,
  FilterX,
  ImagePlus,
  Plus,
  RefreshCw,
  RotateCcw,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
  type CompositionEvent,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { toast } from "sonner";
import SearchInput from "@/components/ui/SearchInput";
import { useConfirm } from "@/components/ui/ConfirmModal";
import type {
  BackgroundAdminList,
  BackgroundMotionFilter,
  BackgroundTypeFilter,
  ManagedBackgroundAsset,
  SceneCatalogStatusFilter,
} from "@/types/scene-catalog-admin";
import BackgroundEditor from "./BackgroundEditor";
import { BackgroundCatalogCard } from "./SceneCatalogCards";
import {
  deleteBackground,
  getBackgroundCatalog,
  sceneCatalogErrorMessage,
  transitionBackground,
} from "./sceneCatalogTransport";

export type SceneCatalogTab = "backgrounds";

export interface SceneCatalogWorkspaceQuery {
  tab: SceneCatalogTab;
  q: string;
  type: BackgroundTypeFilter;
  motion: BackgroundMotionFilter;
  status: SceneCatalogStatusFilter;
  cursor: string | null;
}

type CatalogData = { tab: "backgrounds"; value: BackgroundAdminList };

function sameQuery(left: SceneCatalogWorkspaceQuery, right: SceneCatalogWorkspaceQuery): boolean {
  return left.tab === right.tab
    && left.q === right.q
    && left.type === right.type
    && left.motion === right.motion
    && left.status === right.status
    && left.cursor === right.cursor;
}

function buildListUrl(pathname: string, query: SceneCatalogWorkspaceQuery): string {
  const params = new URLSearchParams();
  params.set("tab", query.tab);
  const q = query.q.normalize("NFKC").trim().replace(/\s+/gu, " ");
  if (q) params.set("q", q);
  if (query.type !== "all") params.set("type", query.type);
  if (query.motion !== "all") params.set("motion", query.motion);
  if (query.status !== "all") params.set("status", query.status);
  if (query.cursor) params.set("cursor", query.cursor);
  return `${pathname}?${params.toString()}`;
}

async function requestCatalog(
  query: SceneCatalogWorkspaceQuery,
  signal?: AbortSignal,
): Promise<CatalogData> {
  const result = await getBackgroundCatalog({
    q: query.q,
    type: query.type,
    motion: query.motion,
    status: query.status,
    cursor: query.cursor,
  }, signal);
  return { tab: "backgrounds", value: result.data };
}

function CatalogSkeleton() {
  return (
    <div aria-label="Đang tải catalog" className="grid animate-pulse grid-cols-1 gap-4 motion-reduce:animate-none sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 12 }, (_, index) => (
        <div key={index} className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]">
          <div className="aspect-video bg-[var(--color-muted)]" />
          <div className="space-y-3 p-4">
            <div className="h-5 w-3/4 rounded bg-[var(--color-muted)]" />
            <div className="h-3 w-1/2 rounded bg-[var(--color-muted)]" />
            <div className="h-11 rounded-xl bg-[var(--color-muted)]" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({
  filtered,
  onReset,
}: {
  filtered: boolean;
  onReset: () => void;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-card)]/45 px-5 py-14 text-center">
      <ImagePlus aria-hidden="true" className="mx-auto h-10 w-10 text-[var(--color-muted-foreground)]" />
      <h2 className="mt-4 font-display text-xl font-bold">
        {filtered ? "Không có kết quả phù hợp" : "Chưa có bối cảnh global"}
      </h2>
      <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-[var(--color-muted-foreground)]">
        {filtered ? "Hãy thử từ khóa hoặc bộ lọc khác." : "Tạo mục nháp đầu tiên, kiểm tra Preview trong biểu mẫu rồi kích hoạt khi sẵn sàng."}
      </p>
      {filtered ? (
        <button type="button" onClick={onReset} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--color-border)] px-4 text-sm font-semibold hover:bg-[var(--color-muted)]">
          <FilterX aria-hidden="true" className="h-4 w-4" /> Xóa bộ lọc
        </button>
      ) : null}
    </div>
  );
}

export default function SceneCatalogWorkspace({ query }: { query: SceneCatalogWorkspaceQuery }) {
  const router = useRouter();
  const pathname = usePathname();
  const confirm = useConfirm();
  const createTriggerRef = useRef<HTMLButtonElement>(null);
  const editorReturnFocusRef = useRef<HTMLElement | null>(null);
  const composingRef = useRef(false);
  const compositionTimerRef = useRef<number | null>(null);
  const [draft, setDraft] = useState(query.q);
  const [submittedSearch, setSubmittedSearch] = useState<string | null>(null);
  const [querySnapshot, setQuerySnapshot] = useState(query);
  const [data, setData] = useState<CatalogData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editor, setEditor] = useState<{ item?: ManagedBackgroundAsset } | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isNavigating, startTransition] = useTransition();

  if (!sameQuery(query, querySnapshot)) {
    const previous = querySnapshot;
    setQuerySnapshot(query);
    if (query.q !== previous.q) {
      const canonicalDraft = draft.normalize("NFKC").trim().replace(/\s+/gu, " ");
      if (submittedSearch === null || canonicalDraft === submittedSearch) setDraft(query.q);
      setSubmittedSearch(null);
    }
    setMenuId(null);
    setLoading(true);
    setLoadError(null);
  }

  const navigate = useCallback((
    next: SceneCatalogWorkspaceQuery,
    history: "push" | "replace" = "replace",
  ) => {
    startTransition(() => {
      const url = buildListUrl(pathname, next);
      if (history === "push") router.push(url, { scroll: false });
      else router.replace(url, { scroll: false });
    });
  }, [pathname, router]);

  const reload = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setLoadError(null);
    try {
      setData(await requestCatalog(query, signal));
    } catch (error) {
      if (signal?.aborted || (error instanceof DOMException && error.name === "AbortError")) return;
      setLoadError(sceneCatalogErrorMessage(error));
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    const controller = new AbortController();
    void requestCatalog(query, controller.signal)
      .then((next) => {
        if (controller.signal.aborted) return;
        setData(next);
        setLoadError(null);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted || (error instanceof DOMException && error.name === "AbortError")) return;
        setLoadError(sceneCatalogErrorMessage(error));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [query]);

  useEffect(() => () => {
    if (compositionTimerRef.current !== null) window.clearTimeout(compositionTimerRef.current);
  }, []);

  const commitSearch = useCallback((value: string) => {
    if (composingRef.current) return;
    const q = value.normalize("NFKC").trim().replace(/\s+/gu, " ");
    setSubmittedSearch(q);
    navigate({ ...query, q, cursor: null });
  }, [navigate, query]);

  useEffect(() => {
    const canonicalDraft = draft.normalize("NFKC").trim().replace(/\s+/gu, " ");
    if (canonicalDraft === query.q || composingRef.current) return;
    const timer = window.setTimeout(() => commitSearch(draft), 300);
    return () => window.clearTimeout(timer);
  }, [commitSearch, draft, query.q]);

  const handleCompositionEnd = (event: CompositionEvent<HTMLInputElement>) => {
    composingRef.current = false;
    if (compositionTimerRef.current !== null) window.clearTimeout(compositionTimerRef.current);
    const value = event.currentTarget.value;
    compositionTimerRef.current = window.setTimeout(() => commitSearch(value), 300);
  };

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    commitSearch(draft);
  };

  const searchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" && !event.nativeEvent.isComposing) {
      event.preventDefault();
      commitSearch(draft);
    }
  };

  const openEditor = (next: NonNullable<typeof editor>) => {
    editorReturnFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : createTriggerRef.current;
    setMenuId(null);
    setEditor(next);
  };

  const closeEditor = () => {
    setEditor(null);
    requestAnimationFrame(() => {
      const target = editorReturnFocusRef.current?.isConnected
        ? editorReturnFocusRef.current
        : createTriggerRef.current;
      target?.focus();
    });
  };

  const transition = async (item: ManagedBackgroundAsset, target: "active" | "archived") => {
    if (target === "archived" && !await confirm({
      title: `Lưu trữ “${item.label}”?`,
      description: "Mục này sẽ biến mất khỏi lựa chọn mới của Author. Các Scene đã lưu tiếp tục render từ snapshot và tệp storage không bị xóa.",
      confirmText: "Lưu trữ",
      cancelText: "Giữ lại",
      variant: "warning",
    })) return;
    setPendingId(item.id);
    setMenuId(null);
    try {
      await transitionBackground(item.id, target, item.updated_at);
      toast.success(target === "active" ? "Đã kích hoạt mục catalog." : "Đã lưu trữ mục catalog.");
      await reload();
    } catch (error) {
      toast.error(sceneCatalogErrorMessage(error));
    } finally {
      setPendingId(null);
    }
  };

  const hardDelete = async (item: ManagedBackgroundAsset) => {
    if (!await confirm({
      title: `Xóa vĩnh viễn “${item.label}”?`,
      description: "Chỉ mục chưa từng kích hoạt mới có thể xóa. Thao tác này xóa metadata catalog; media storage được dọn riêng.",
      confirmText: "Xóa vĩnh viễn",
      cancelText: "Hủy",
      variant: "danger",
    })) return;
    setPendingId(item.id);
    setMenuId(null);
    try {
      await deleteBackground(item.id, item.updated_at);
      toast.success("Đã xóa mục nháp.");
      await reload();
    } catch (error) {
      toast.error(sceneCatalogErrorMessage(error));
    } finally {
      setPendingId(null);
    }
  };

  const reset = () => {
    setDraft("");
    navigate({ ...query, q: "", type: "all", motion: "all", status: "all", cursor: null });
  };

  const currentData = data?.tab === query.tab ? data.value : null;
  const items = currentData?.items ?? [];
  const filtered = Boolean(query.q || query.status !== "all"
    || query.type !== "all" || query.motion !== "all");
  const busy = loading || isNavigating;
  const panelId = `scene-catalog-${query.tab}-panel`;

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-6 lg:px-8 lg:py-8">
      <nav aria-label="Đường dẫn" className="hidden text-sm text-[var(--color-muted-foreground)] sm:block">
        Quản trị <span aria-hidden="true">/</span> <span className="text-[var(--color-foreground)]">Thư viện bối cảnh</span>
      </nav>

      <header className="mt-1 flex flex-col gap-4 sm:mt-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">Thư viện bối cảnh</h1>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--color-muted-foreground)] sm:text-base">Quản lý bối cảnh global dùng cho Scene mới của Author.</p>
        </div>
        <button
          ref={createTriggerRef}
          type="button"
          onClick={() => openEditor({})}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[var(--color-primary)] px-4 text-sm font-semibold text-[var(--color-primary-foreground)] hover:bg-[var(--color-primary-hover)]"
        >
          <Plus aria-hidden="true" className="h-4 w-4" />
          Tạo Background
        </button>
      </header>

      <section aria-label="Bộ lọc catalog" className="mt-7 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-3 sm:p-4">
        <form
          role="search"
          onSubmit={submitSearch}
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(16rem,1fr)_12rem_12rem_12rem]"
        >
          <SearchInput
            id="scene-catalog-search"
            value={draft}
            onChange={setDraft}
            onClear={() => commitSearch("")}
            onKeyDown={searchKeyDown}
            onCompositionStart={() => {
              composingRef.current = true;
              if (compositionTimerRef.current !== null) window.clearTimeout(compositionTimerRef.current);
            }}
            onCompositionEnd={handleCompositionEnd}
            label="Tìm catalog"
            maxLength={100}
            autoComplete="off"
            aria-controls={panelId}
            placeholder="Tìm tên, ID hoặc mood tag…"
          />
          <div>
            <label htmlFor="background-type-filter" className="sr-only">Lọc loại Background</label>
            <select id="background-type-filter" value={query.type} onChange={(event) => navigate({ ...query, type: event.target.value as BackgroundTypeFilter, cursor: null })} disabled={isNavigating} className="min-h-11 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] px-3 text-sm font-semibold disabled:opacity-60">
              <option value="all">Mọi loại</option><option value="image">Ảnh</option><option value="video">Video</option><option value="gradient">Linear gradient</option><option value="radial_gradient">Radial gradient</option><option value="particle_composition">Particle</option>
            </select>
          </div>
          <div>
            <label htmlFor="background-motion-filter" className="sr-only">Lọc chuyển động</label>
            <select id="background-motion-filter" value={query.motion} onChange={(event) => navigate({ ...query, motion: event.target.value as BackgroundMotionFilter, cursor: null })} disabled={isNavigating} className="min-h-11 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] px-3 text-sm font-semibold disabled:opacity-60">
              <option value="all">Mọi chuyển động</option><option value="static">Tĩnh</option><option value="looping">Lặp</option>
            </select>
          </div>
          <div>
            <label htmlFor="catalog-status-filter" className="sr-only">Lọc trạng thái</label>
            <select id="catalog-status-filter" value={query.status} onChange={(event) => navigate({ ...query, status: event.target.value as SceneCatalogStatusFilter, cursor: null })} disabled={isNavigating} className="min-h-11 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] px-3 text-sm font-semibold disabled:opacity-60">
              <option value="all">Mọi trạng thái</option><option value="draft">Nháp</option><option value="active">Đang dùng</option><option value="archived">Đã lưu trữ</option>
            </select>
          </div>
        </form>
      </section>

      <section aria-labelledby="scene-catalog-list-heading" className="mt-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="scene-catalog-list-heading" className="font-display text-xl font-bold">Backgrounds global</h2>
            <p role="status" aria-live="polite" aria-atomic="true" className="mt-1 text-sm text-[var(--color-muted-foreground)]">
              {busy
                ? "Đang cập nhật kết quả…"
                : currentData && currentData.total > 0
                  ? `Hiển thị ${items.length} trong ${currentData.total} mục`
                  : "Không có kết quả"}
            </p>
          </div>
          <button type="button" onClick={() => void reload()} disabled={busy} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--color-border)] px-3 text-sm font-semibold hover:bg-[var(--color-muted)] disabled:cursor-wait disabled:opacity-60">
            <RefreshCw aria-hidden="true" className={`h-4 w-4 ${busy ? "animate-spin motion-reduce:animate-none" : ""}`} /> Tải lại
          </button>
        </div>

        <div
          id={panelId}
          role="region"
          aria-labelledby="scene-catalog-list-heading"
          aria-busy={busy}
          data-scene-catalog-panel="backgrounds"
          className={`mt-4 transition-opacity motion-reduce:transition-none ${isNavigating && currentData ? "opacity-60" : ""}`}
        >
          {loading && !currentData ? <CatalogSkeleton /> : loadError ? (
            <div role="alert" className="rounded-2xl border border-[var(--color-destructive)]/45 bg-[var(--color-destructive)]/10 p-6">
              <h2 className="font-display text-xl font-bold">Không thể tải catalog</h2>
              <p className="mt-2 text-sm text-[var(--color-muted-foreground)]">{loadError}</p>
              <button type="button" onClick={() => void reload()} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--color-border)] px-4 text-sm font-semibold hover:bg-[var(--color-muted)]">
                <RotateCcw aria-hidden="true" className="h-4 w-4" /> Thử lại
              </button>
            </div>
          ) : !currentData || items.length === 0 ? (
            <EmptyState filtered={filtered} onReset={reset} />
          ) : data?.tab === "backgrounds" ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {data.value.items.map((item) => {
                const id = `background:${item.id}`;
                return (
                  <BackgroundCatalogCard
                    key={item.id}
                    item={item}
                    menuOpen={menuId === id}
                    pending={pendingId === item.id}
                    onMenuOpenChange={(open) => setMenuId(open ? id : null)}
                    onEdit={() => openEditor({ item })}
                    onTransition={(target) => void transition(item, target)}
                    onDelete={() => void hardDelete(item)}
                  />
                );
              })}
            </div>
          ) : null}
        </div>

        {currentData && items.length > 0 && (currentData.nextCursor || query.cursor) ? (
          <nav aria-label="Phân trang bối cảnh" className="mt-5 flex flex-wrap items-center justify-end gap-2">
            {query.cursor ? (
              <button type="button" onClick={() => navigate({ ...query, cursor: null }, "push")} disabled={busy} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[var(--color-border)] px-4 text-sm font-semibold hover:bg-[var(--color-muted)] disabled:opacity-60">
                Về trang đầu
              </button>
            ) : null}
            {currentData.nextCursor ? (
              <button type="button" onClick={() => navigate({ ...query, cursor: currentData.nextCursor }, "push")} disabled={busy} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--color-primary)] px-4 text-sm font-semibold text-[var(--color-primary-foreground)] hover:bg-[var(--color-primary-hover)] disabled:opacity-60">
                Trang tiếp <ChevronRight aria-hidden="true" className="h-4 w-4" />
              </button>
            ) : null}
          </nav>
        ) : null}
      </section>

      {editor ? <BackgroundEditor item={editor.item} onClose={closeEditor} onSaved={() => reload()} /> : null}
    </main>
  );
}
