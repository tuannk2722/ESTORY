"use client";

import {
  ChevronRight,
  FilterX,
  Inbox,
  Pencil,
  RefreshCw,
  SearchX,
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
import SearchInput from "@/components/ui/SearchInput";
import {
  effectAdminErrorMessage,
  getEffectCatalog,
  type EffectAdminList,
  type EffectAdminListItem,
  type EffectAdminListQuery,
} from "./effectAdminTransport";
import EffectAdminDrawer from "./EffectAdminDrawer";

const CATEGORY_OPTIONS = [
  { id: "all", label: "Tất cả danh mục" },
  { id: "visual", label: "Hình ảnh" },
  { id: "motion", label: "Chuyển động" },
  { id: "transition", label: "Chuyển cảnh" },
] as const;

const STATUS_OPTIONS = [
  { id: "all", label: "Tất cả trạng thái" },
  { id: "active", label: "Đang hoạt động" },
  { id: "inactive", label: "Đã tắt" },
] as const;

const CATEGORY_LABELS = Object.fromEntries(CATEGORY_OPTIONS.map((item) => [item.id, item.label]));

function buildListUrl(pathname: string, query: EffectAdminListQuery) {
  const params = new URLSearchParams();
  const q = query.q.trim().replace(/\s+/g, " ");
  if (q) params.set("q", q);
  params.set("category", query.category);
  params.set("status", query.status);
  if (query.cursor) params.set("cursor", query.cursor);
  return `${pathname}?${params.toString()}`;
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold ${active
      ? "border-[var(--color-success)]/35 bg-[var(--color-success)]/10 text-[var(--color-success)]"
      : "border-[var(--color-border)] bg-[var(--color-muted)] text-[var(--color-muted-foreground)]"
      }`}>
      <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${active ? "bg-[var(--color-success)]" : "bg-[var(--color-muted-foreground)]"}`} />
      {active ? "Hoạt động" : "Đã tắt"}
    </span>
  );
}

function LoadingState() {
  return (
    <div aria-label="Đang tải thư viện hiệu ứng" className="space-y-2">
      {Array.from({ length: 6 }, (_, index) => (
        <div key={index} className="h-16 animate-pulse rounded-xl bg-[var(--color-muted)] motion-reduce:animate-none" />
      ))}
    </div>
  );
}

function EmptyState({ filtered, onReset }: { filtered: boolean; onReset: () => void }) {
  const Icon = filtered ? SearchX : Inbox;
  return (
    <div className="rounded-2xl border border-dashed border-[var(--color-border)] px-5 py-12 text-center">
      <Icon aria-hidden="true" className="mx-auto h-10 w-10 text-[var(--color-muted-foreground)]" />
      <h2 className="mt-4 font-display text-xl font-bold">{filtered ? "Không tìm thấy hiệu ứng" : "Thư viện hiệu ứng đang trống"}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--color-muted-foreground)]">
        {filtered ? "Hãy thử từ khóa hoặc bộ lọc khác." : "Technical manifest chưa được đồng bộ. Trang này không hỗ trợ tạo EffectType mới."}
      </p>
      {filtered ? (
        <button type="button" onClick={onReset} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--color-border)] px-4 text-sm font-semibold hover:bg-[var(--color-muted)]"><FilterX aria-hidden="true" className="h-4 w-4" /> Xóa bộ lọc</button>
      ) : null}
    </div>
  );
}

export default function EffectAdminWorkspace({ query }: { query: EffectAdminListQuery }) {
  const router = useRouter();
  const pathname = usePathname();
  const [draft, setDraft] = useState(query.q);
  const [submittedSearch, setSubmittedSearch] = useState<string | null>(null);
  const [data, setData] = useState<EffectAdminList | null>(null);
  const [selected, setSelected] = useState<EffectAdminListItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isNavigating, startTransition] = useTransition();
  const [querySnapshot, setQuerySnapshot] = useState(query);
  const composingRef = useRef(false);
  const compositionTimerRef = useRef<number | null>(null);
  const drawerCloseRef = useRef<(() => void) | null>(null);
  const drawerOpen = selected !== null;

  // Reconcile URL navigation without remounting the focused search input.
  if (query.q !== querySnapshot.q || query.category !== querySnapshot.category
    || query.status !== querySnapshot.status || query.cursor !== querySnapshot.cursor) {
    setQuerySnapshot(query);
    if (query.q !== querySnapshot.q) {
      // A slow URL response must not discard text typed after its submission.
      if (submittedSearch === null || draft.trim().replace(/\s+/g, " ") === submittedSearch) setDraft(query.q);
      setSubmittedSearch(null);
    }
    setLoading(true);
    setError(null);
  }

  useEffect(() => {
    if (!drawerOpen) return;
    // Keep Back inside the drawer until its dirty/pending guard accepts closing.
    // Preserve Next's history state so the list URL and router tree stay aligned.
    const drawerUrl = window.location.href;
    const drawerState = { ...window.history.state, effectAdminDrawer: true };
    window.history.pushState(drawerState, "", drawerUrl);
    const onBack = () => {
      window.history.pushState(drawerState, "", drawerUrl);
      drawerCloseRef.current?.();
    };
    window.addEventListener("popstate", onBack);
    return () => {
      window.removeEventListener("popstate", onBack);
      if (window.history.state?.effectAdminDrawer) window.history.back();
    };
  }, [drawerOpen]);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const result = await getEffectCatalog(query, signal);
      setData(result.data);
    } catch (loadError) {
      if (loadError instanceof DOMException && loadError.name === "AbortError") return;
      setError(effectAdminErrorMessage(loadError));
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    const controller = new AbortController();
    void getEffectCatalog(query, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        setData(result.data);
        setError(null);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === "AbortError") return;
        setError(effectAdminErrorMessage(loadError));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [query]);

  useEffect(() => () => {
    if (compositionTimerRef.current !== null) window.clearTimeout(compositionTimerRef.current);
  }, []);

  const navigate = useCallback((next: EffectAdminListQuery, history: "push" | "replace" = "replace") => {
    startTransition(() => {
      const url = buildListUrl(pathname, next);
      if (history === "push") router.push(url, { scroll: false });
      else router.replace(url, { scroll: false });
    });
  }, [pathname, router]);

  const commitSearch = useCallback((value: string) => {
    if (composingRef.current) return;
    const q = value.trim().replace(/\s+/g, " ");
    setSubmittedSearch(q);
    navigate({ ...query, q, cursor: null });
  }, [navigate, query]);

  useEffect(() => {
    if (draft.trim().replace(/\s+/g, " ") === query.q || composingRef.current) return;
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

  const reset = () => {
    setDraft("");
    navigate({ q: "", category: "all", status: "all", cursor: null });
  };

  const closeDrawer = useCallback(() => {
    setSelected(null);
    void load();
  }, [load]);

  const reloadSelected = useCallback(async () => {
    if (!selected) return;
    const result = await getEffectCatalog({ q: selected.id, category: "all", status: "all", cursor: null });
    const current = result.data.items.find((item) => item.id === selected.id);
    if (!current) throw new Error("missing effect");
    setSelected(current);
    void load();
  }, [load, selected]);

  const filtered = Boolean(query.q) || query.category !== "all" || query.status !== "all" || Boolean(query.cursor);
  const busy = loading || isNavigating;

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-6 lg:px-8 lg:py-8">
      <nav aria-label="Đường dẫn" className="hidden text-sm text-[var(--color-muted-foreground)] sm:block">Quản trị <span aria-hidden="true">/</span> <span className="text-[var(--color-foreground)]">Hiệu ứng</span></nav>

      <header className="mt-1 sm:mt-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start flex-col">
            <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">Thư viện hiệu ứng</h1>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--color-muted-foreground)] sm:text-base">Quản lý tên, mô tả, trạng thái và từ khóa tìm kiếm, gợi ý của hiệu ứng.</p>
          </div>
        </div>
      </header>

      <section aria-labelledby="effect-list-heading" className="mt-6">
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-3 sm:p-4">
          <form onSubmit={submitSearch} role="search" className="grid gap-3 lg:grid-cols-[minmax(16rem,1fr)_13rem_13rem]">
            <SearchInput
              id="admin-effect-search"
              label="Tìm theo tên, mô tả, technical ID hoặc từ khóa"
              value={draft}
              onChange={setDraft}
              onClear={() => { setDraft(""); commitSearch(""); }}
              onKeyDown={searchKeyDown}
              onCompositionStart={() => { composingRef.current = true; if (compositionTimerRef.current !== null) window.clearTimeout(compositionTimerRef.current); }}
              onCompositionEnd={handleCompositionEnd}
              maxLength={100}
              autoComplete="off"
              placeholder="Tìm hiệu ứng…"
              aria-controls="effect-catalog-list"
            />
            <div>
              <label htmlFor="effect-category-filter" className="sr-only">Lọc theo danh mục</label>
              <select id="effect-category-filter" value={query.category} onChange={(event) => navigate({ ...query, category: event.target.value as EffectAdminListQuery["category"], cursor: null })} disabled={isNavigating} className="min-h-11 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] px-3 text-sm font-semibold disabled:opacity-60">
                {CATEGORY_OPTIONS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="effect-status-filter" className="sr-only">Lọc theo trạng thái</label>
              <select id="effect-status-filter" value={query.status} onChange={(event) => navigate({ ...query, status: event.target.value as EffectAdminListQuery["status"], cursor: null })} disabled={isNavigating} className="min-h-11 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] px-3 text-sm font-semibold disabled:opacity-60">
                {STATUS_OPTIONS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
              </select>
            </div>
          </form>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <div id="effect-list-heading">
            <h2 className="font-display text-xl font-bold">Technical effects</h2>
            <p role="status" aria-live="polite" aria-atomic="true" className="mt-1 text-sm text-[var(--color-muted-foreground)]">{busy ? "Đang cập nhật kết quả…" : data && data.total > 0 ? `Hiển thị ${data.items.length} trong ${data.total} hiệu ứng` : "Không có kết quả"}</p>
          </div>
          <button type="button" onClick={() => void load()} disabled={busy} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--color-border)] px-3 text-sm font-semibold hover:bg-[var(--color-muted)] disabled:cursor-wait disabled:opacity-60"><RefreshCw aria-hidden="true" className={`h-4 w-4 ${busy ? "animate-spin motion-reduce:animate-none" : ""}`} /> Tải lại</button>
        </div>

        <div id="effect-catalog-list" aria-busy={busy} className={`mt-4 transition-opacity motion-reduce:transition-none ${isNavigating ? "opacity-60" : ""}`}>
          {loading && !data ? <LoadingState /> : error ? (
            <div role="alert" className="rounded-2xl border border-[var(--color-destructive)]/45 bg-[var(--color-destructive)]/10 p-5">
              <p className="font-semibold">{error}</p>
              <button type="button" onClick={() => void load()} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--color-border)] px-3 text-sm font-semibold hover:bg-[var(--color-muted)]"><RefreshCw aria-hidden="true" className="h-4 w-4" /> Thử lại</button>
            </div>
          ) : !data || data.items.length === 0 ? <EmptyState filtered={filtered} onReset={reset} /> : (
            <>
              <div className="space-y-3 md:hidden">
                {data.items.map((effect) => (
                  <article key={effect.id} className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="font-display text-lg font-bold">{effect.label}</h3><p className="mt-1 break-all font-mono text-xs text-[var(--color-muted-foreground)]">{effect.id}</p></div><StatusBadge active={effect.is_active} /></div>
                    {effect.description ? <p className="mt-3 line-clamp-2 text-sm leading-6 text-[var(--color-muted-foreground)]">{effect.description}</p> : null}
                    <div className="mt-4 flex items-center justify-between gap-3"><span className="text-xs font-semibold text-[var(--color-muted-foreground)]">{CATEGORY_LABELS[effect.category]}</span><button type="button" onClick={(event) => { event.currentTarget.focus(); setSelected(effect); }} aria-label={`Chỉnh sửa hiệu ứng ${effect.label}`} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--color-border)] px-3 text-sm font-semibold text-[var(--color-primary)] hover:bg-[var(--color-muted)]"><Pencil aria-hidden="true" className="h-4 w-4" /> Chỉnh sửa</button></div>
                  </article>
                ))}
              </div>

              <div className="hidden overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] md:block">
                <table className="w-full table-fixed border-collapse text-left">
                  <thead className="bg-[var(--color-muted)]/65 text-xs font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]"><tr><th scope="col" className="w-[32%] px-4 py-3">Hiệu ứng</th><th scope="col" className="w-[27%] px-3 py-3">Technical ID</th><th scope="col" className="w-[16%] px-3 py-3">Danh mục</th><th scope="col" className="w-[15%] px-3 py-3">Trạng thái</th><th scope="col" className="w-[10%] px-3 py-3 text-right">Thao tác</th></tr></thead>
                  <tbody className="divide-y divide-[var(--color-border)]">
                    {data.items.map((effect) => (
                      <tr key={effect.id} className="hover:bg-[var(--color-muted)]/30">
                        <td className="px-4 py-3"><p className="truncate font-semibold">{effect.label}</p>{effect.description ? <p className="mt-1 truncate text-xs text-[var(--color-muted-foreground)]">{effect.description}</p> : null}</td>
                        <td className="px-3 py-3"><code className="text-xs text-[var(--color-muted-foreground)]">{effect.id}</code></td>
                        <td className="px-3 py-3 text-sm text-[var(--color-muted-foreground)]">{CATEGORY_LABELS[effect.category]}</td>
                        <td className="px-3 py-3"><StatusBadge active={effect.is_active} /></td>
                        <td className="px-3 py-3 text-right"><button type="button" onClick={(event) => { event.currentTarget.focus(); setSelected(effect); }} aria-label={`Chỉnh sửa hiệu ứng ${effect.label}`} className="inline-flex min-h-10 items-center justify-center rounded-xl border border-[var(--color-border)] px-3 text-sm font-semibold text-[var(--color-primary)] hover:bg-[var(--color-muted)]">Sửa</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {data && data.items.length > 0 && (data.nextCursor || query.cursor) ? (
          <nav aria-label="Phân trang hiệu ứng" className="mt-5 flex flex-wrap items-center justify-end gap-2">
            {query.cursor ? <button type="button" onClick={() => navigate({ ...query, cursor: null }, "push")} disabled={busy} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[var(--color-border)] px-4 text-sm font-semibold hover:bg-[var(--color-muted)] disabled:opacity-60">Về trang đầu</button> : null}
            {data.nextCursor ? <button type="button" onClick={() => navigate({ ...query, cursor: data.nextCursor }, "push")} disabled={busy} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--color-primary)] px-4 text-sm font-semibold text-[var(--color-primary-foreground)] hover:bg-[var(--color-primary-hover)] disabled:opacity-60">Trang tiếp <ChevronRight aria-hidden="true" className="h-4 w-4" /></button> : null}
          </nav>
        ) : null}
      </section>

      {selected && data ? (
        <EffectAdminDrawer
          key={`${selected.id}:${selected.updated_at}`}
          effect={selected}
          capabilities={data.capabilities}
          onClose={closeDrawer}
          onReload={reloadSelected}
          closeRequestRef={drawerCloseRef}
        />
      ) : null}
    </main>
  );
}
