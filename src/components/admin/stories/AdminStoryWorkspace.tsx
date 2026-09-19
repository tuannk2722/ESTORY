"use client";

import {
  Ban,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Inbox,
  RotateCcw,
  SearchX,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
  type FormEvent,
  type CompositionEvent,
  type KeyboardEvent,
} from "react";
import SearchInput from "@/components/ui/SearchInput";
import StoryStatusBadge, { STORY_STATUS_FILTERS } from "@/components/ui/StoryStatusBadge";
import StoryCoverImage from "@/components/story/StoryCoverImage";
import { coverObjectPosition } from "@/lib/story-cover";
import type {
  ModerationListQuery,
  ModerationStatusFilter,
  ModerationStoryList,
  ModerationStoryListItem,
} from "@/types/story-moderation";
import StoryReviewDrawer from "./StoryReviewDrawer";

const dateFormatter = new Intl.DateTimeFormat("vi-VN", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Ho_Chi_Minh",
});

function formatSubmittedAt(value: string | null): string {
  if (!value) return "Chưa gửi";
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? dateFormatter.format(parsed) : "Không xác định";
}

function buildListUrl(
  pathname: string,
  q: string,
  status: ModerationStatusFilter,
  cursor?: string | null,
): string {
  const params = new URLSearchParams();
  const normalized = q.trim().replace(/\s+/g, " ");
  if (normalized) params.set("q", normalized);
  params.set("status", status);
  if (cursor) params.set("cursor", cursor);
  return `${pathname}?${params.toString()}`;
}

function ModerationCover({ story, sizes }: { story: ModerationStoryListItem; sizes: string }) {
  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-[var(--color-border)] bg-gradient-to-br from-[var(--color-secondary)] via-[var(--color-card)] to-[var(--color-primary)]/30">
      {story.cover_image ? (
        <StoryCoverImage
          src={story.cover_image}
          alt={`Ảnh bìa ${story.title}`}
          objectPosition={coverObjectPosition(story.cover_position)}
          sizes={sizes}
        />
      ) : (
        <BookOpen aria-hidden="true" className="absolute left-1/2 top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 text-[var(--color-muted-foreground)]" />
      )}
    </div>
  );
}

function SummaryCards({ data }: { data: ModerationStoryList }) {
  const cards = [
    {
      label: "Chờ duyệt",
      value: data.summary.pendingReview,
      icon: Clock3,
      className: "text-[var(--color-warning)] bg-[var(--color-warning)]/12",
    },
    {
      label: "Đã xuất bản",
      value: data.summary.published,
      icon: CheckCircle2,
      className: "text-[var(--color-success)] bg-[var(--color-success)]/12",
    },
    {
      label: "Bị từ chối",
      value: data.summary.rejected,
      icon: Ban,
      className: "text-[var(--color-destructive)] bg-[var(--color-destructive)]/10",
    },
  ];
  return (
    <dl className="grid gap-3 sm:grid-cols-3">
      {cards.map(({ label, value, icon: Icon, className }) => (
        <div key={label} className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <dt className="text-sm font-medium text-[var(--color-muted-foreground)]">{label}</dt>
              <dd className="mt-1 font-display text-3xl font-bold text-[var(--color-card-foreground)]">{value}</dd>
            </div>
            <span className={`flex h-11 w-11 items-center justify-center rounded-2xl ${className}`}>
              <Icon aria-hidden="true" className="h-5 w-5" />
            </span>
          </div>
        </div>
      ))}
    </dl>
  );
}

function Scale({ story }: { story: ModerationStoryListItem }) {
  return (
    <span className="text-sm text-[var(--color-muted-foreground)]">
      {story.chapterCount} chương · {story.blockCount} block · {story.effectCount} hiệu ứng
    </span>
  );
}

function EmptyState({
  filtered,
  onReset,
}: {
  filtered: boolean;
  onReset: () => void;
}) {
  const Icon = filtered ? SearchX : Inbox;
  return (
    <div className="rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-card)] px-5 py-12 text-center">
      <Icon aria-hidden="true" className="mx-auto h-10 w-10 text-[var(--color-muted-foreground)]" />
      <h2 className="mt-4 font-display text-xl font-bold">
        {filtered ? "Không tìm thấy kết quả" : "Không có tác phẩm chờ duyệt"}
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-[var(--color-muted-foreground)]">
        {filtered
          ? "Hãy thử từ khóa khác hoặc xóa bộ lọc hiện tại."
          : "Hàng đợi đã được xử lý hết. Tác phẩm mới sẽ xuất hiện tại đây sau khi tác giả gửi duyệt."}
      </p>
      {filtered ? (
        <button
          type="button"
          onClick={onReset}
          className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--color-border)] px-4 text-sm font-semibold hover:bg-[var(--color-muted)]"
        >
          <RotateCcw aria-hidden="true" className="h-4 w-4" />
          Xóa bộ lọc
        </button>
      ) : null}
    </div>
  );
}

export default function AdminStoryWorkspace({
  data,
  query,
}: {
  data: ModerationStoryList;
  query: ModerationListQuery;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [draft, setDraft] = useState(query.q);
  const [selectedStory, setSelectedStory] = useState<ModerationStoryListItem | null>(null);
  const [isPending, startTransition] = useTransition();
  const composingRef = useRef(false);
  const compositionTimerRef = useRef<number | null>(null);

  const navigate = useCallback((url: string, history: "replace" | "push" = "replace") => {
    startTransition(() => {
      if (history === "push") router.push(url, { scroll: false });
      else router.replace(url, { scroll: false });
    });
  }, [router]);

  const commitSearch = useCallback((value: string) => {
    if (composingRef.current) return;
    navigate(buildListUrl(pathname, value, query.status));
  }, [navigate, pathname, query.status]);

  useEffect(() => {
    if (draft.trim().replace(/\s+/g, " ") === query.q || composingRef.current) return;
    const timer = window.setTimeout(() => commitSearch(draft), 300);
    return () => window.clearTimeout(timer);
  }, [commitSearch, draft, query.q]);

  useEffect(() => () => {
    if (compositionTimerRef.current !== null) window.clearTimeout(compositionTimerRef.current);
  }, []);

  const handleCompositionEnd = (event: CompositionEvent<HTMLInputElement>) => {
    composingRef.current = false;
    if (compositionTimerRef.current !== null) window.clearTimeout(compositionTimerRef.current);
    const value = event.currentTarget.value;
    compositionTimerRef.current = window.setTimeout(() => commitSearch(value), 300);
  };

  const handleSearchSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (compositionTimerRef.current !== null) window.clearTimeout(compositionTimerRef.current);
    commitSearch(draft);
  };

  const handleSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" && !event.nativeEvent.isComposing) {
      event.preventDefault();
      commitSearch(draft);
    }
  };

  const selectStatus = (status: ModerationStatusFilter) => {
    navigate(buildListUrl(pathname, draft, status));
  };

  const resetFilters = () => {
    setDraft("");
    navigate(buildListUrl(pathname, "", "pending_review"));
  };

  const closeDrawer = useCallback(() => setSelectedStory(null), []);
  const completeDecision = useCallback(() => {
    setSelectedStory(null);
    startTransition(() => router.refresh());
  }, [router]);

  const filtered = Boolean(query.q) || query.status !== "pending_review" || Boolean(query.cursor);

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-6 lg:px-8 lg:py-8">
      <nav aria-label="Đường dẫn" className="hidden text-sm text-[var(--color-muted-foreground)] sm:block">
        Quản trị <span aria-hidden="true">/</span> <span className="text-[var(--color-foreground)]">Kiểm duyệt truyện</span>
      </nav>

      <header className="mt-1 sm:mt-4">
        <div className="flex items-start flex-col">
          <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">Kiểm duyệt tác phẩm</h1>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--color-muted-foreground)] sm:text-base">
            Đối chiếu nội dung và trải nghiệm đọc trước khi tác phẩm được xuất bản công khai.
          </p>
        </div>
      </header>

      <section aria-label="Tổng quan kiểm duyệt" className="mt-6">
        <SummaryCards data={data} />
      </section>

      <section aria-labelledby="moderation-list-heading" className="mt-6">
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-3 sm:p-4">
          <form onSubmit={handleSearchSubmit} role="search" className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <SearchInput
              id="admin-story-search"
              label="Tìm tác phẩm theo tên hoặc bút danh"
              value={draft}
              onChange={setDraft}
              onClear={() => commitSearch("")}
              onKeyDown={handleSearchKeyDown}
              onCompositionStart={() => {
                composingRef.current = true;
                if (compositionTimerRef.current !== null) window.clearTimeout(compositionTimerRef.current);
              }}
              onCompositionEnd={handleCompositionEnd}
              maxLength={100}
              autoComplete="off"
              placeholder="Tìm theo tên truyện hoặc bút danh…"
              aria-controls="admin-story-list"
              className="w-full lg:max-w-md"
            />
            <div aria-label="Lọc theo trạng thái" className="flex flex-wrap gap-2">
              {STORY_STATUS_FILTERS.map((filter) => (
                <button
                  key={filter.id}
                  type="button"
                  onClick={() => selectStatus(filter.id)}
                  aria-pressed={query.status === filter.id}
                  disabled={isPending}
                  className={`inline-flex min-h-11 items-center justify-center rounded-xl border px-3 text-sm font-semibold transition-colors motion-reduce:transition-none ${query.status === filter.id
                    ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-[var(--color-primary-foreground)]"
                    : "border-[var(--color-border)] bg-[var(--color-background)] text-[var(--color-foreground)] hover:bg-[var(--color-muted)]"
                    } disabled:cursor-wait disabled:opacity-65`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </form>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div id="moderation-list-heading">
            <h2 className="font-display text-xl font-bold">Danh sách tác phẩm</h2>
            <p role="status" aria-live="polite" aria-atomic="true" className="mt-1 text-sm text-[var(--color-muted-foreground)]">
              {data.total === 0 ? "Không có kết quả" : `Hiển thị ${data.items.length} trong ${data.total} tác phẩm`}
            </p>
          </div>
          <button
            type="button"
            onClick={() => startTransition(() => router.refresh())}
            disabled={isPending}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--color-border)] px-3 text-sm font-semibold hover:bg-[var(--color-muted)] disabled:cursor-wait disabled:opacity-60"
          >
            <RotateCcw aria-hidden="true" className={`h-4 w-4 ${isPending ? "animate-spin motion-reduce:animate-none" : ""}`} />
            Tải lại
          </button>
        </div>

        <div id="admin-story-list" aria-busy={isPending} className={`mt-4 transition-opacity motion-reduce:transition-none ${isPending ? "opacity-60" : ""}`}>
          {data.items.length === 0 ? (
            <EmptyState filtered={filtered} onReset={resetFilters} />
          ) : (
            <>
              <div className="space-y-3 md:hidden">
                {data.items.map((story) => (
                  <article key={story.id} className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-sm">
                    <ModerationCover story={story} sizes="100vw" />
                    <div className="p-4">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <h3 className="min-w-0 flex-1 font-display text-lg font-bold">{story.title}</h3>
                        <StoryStatusBadge status={story.status} />
                      </div>
                      {story.genre.length ? (
                        <p className="mt-1 line-clamp-1 text-xs text-[var(--color-muted-foreground)]">{story.genre.join(" · ")}</p>
                      ) : null}
                      <dl className="mt-4 grid gap-2 text-sm">
                        <div><dt className="inline text-[var(--color-muted-foreground)]">Tác giả: </dt><dd className="inline font-medium">{story.author}</dd></div>
                        <div><dt className="inline text-[var(--color-muted-foreground)]">Gửi duyệt: </dt><dd className="inline font-medium">{formatSubmittedAt(story.submittedAt)}</dd></div>
                      </dl>
                      <p className="mt-3"><Scale story={story} /></p>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.currentTarget.focus();
                          setSelectedStory(story);
                        }}
                        className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[var(--color-primary)] px-4 text-sm font-semibold text-[var(--color-primary-foreground)] hover:bg-[var(--color-primary-hover)]"
                      >
                        Xem chi tiết
                        <ChevronRight aria-hidden="true" className="h-4 w-4" />
                      </button>
                    </div>
                  </article>
                ))}
              </div>

              <div className="hidden overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] md:block">
                <table className="w-full table-fixed border-collapse text-left">
                  <thead className="bg-[var(--color-muted)]/65 text-xs font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">
                    <tr>
                      <th scope="col" className="w-[34%] px-4 py-3">Tác phẩm</th>
                      <th scope="col" className="w-[20%] px-3 py-3">Tác giả · Ngày gửi</th>
                      <th scope="col" className="w-[20%] px-3 py-3">Quy mô</th>
                      <th scope="col" className="w-[14%] px-3 py-3">Trạng thái</th>
                      <th scope="col" className="w-[12%] px-3 py-3 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border)]">
                    {data.items.map((story) => (
                      <tr key={story.id} className="align-middle hover:bg-[var(--color-muted)]/30">
                        <td className="px-4 py-3">
                          <div className="flex min-w-0 items-center gap-3">
                            <div className="w-24 shrink-0 lg:w-32">
                              <ModerationCover story={story} sizes="8rem" />
                            </div>
                            <div className="min-w-0">
                              <p className="line-clamp-2 font-display font-bold">{story.title}</p>
                              {story.genre.length ? <p className="mt-1 truncate text-xs text-[var(--color-muted-foreground)]">{story.genre.join(" · ")}</p> : null}
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-sm">
                          <p className="truncate font-medium">{story.author}</p>
                          <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">{formatSubmittedAt(story.submittedAt)}</p>
                        </td>
                        <td className="px-3 py-3"><Scale story={story} /></td>
                        <td className="px-3 py-3"><StoryStatusBadge status={story.status} /></td>
                        <td className="px-3 py-3 text-right">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.currentTarget.focus();
                              setSelectedStory(story);
                            }}
                            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[var(--color-border)] px-3 text-sm font-semibold text-[var(--color-primary)] hover:bg-[var(--color-muted)]"
                          >
                            Chi tiết
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {data.items.length > 0 && (data.nextCursor || query.cursor) ? (
          <nav aria-label="Phân trang tác phẩm" className="mt-5 flex flex-wrap items-center justify-end gap-2">
            {query.cursor ? (
              <button
                type="button"
                onClick={() => navigate(buildListUrl(pathname, query.q, query.status), "push")}
                disabled={isPending}
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[var(--color-border)] px-4 text-sm font-semibold hover:bg-[var(--color-muted)] disabled:cursor-wait disabled:opacity-60"
              >
                Về trang đầu
              </button>
            ) : null}
            {data.nextCursor ? (
              <button
                type="button"
                onClick={() => navigate(buildListUrl(pathname, query.q, query.status, data.nextCursor), "push")}
                disabled={isPending}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--color-primary)] px-4 text-sm font-semibold text-[var(--color-primary-foreground)] hover:bg-[var(--color-primary-hover)] disabled:cursor-wait disabled:opacity-60"
              >
                Trang tiếp
                <ChevronRight aria-hidden="true" className="h-4 w-4" />
              </button>
            ) : null}
          </nav>
        ) : null}
      </section>

      {selectedStory ? (
        <StoryReviewDrawer
          key={selectedStory.id}
          story={selectedStory}
          onClose={closeDrawer}
          onCompleted={completeDecision}
        />
      ) : null}
    </main>
  );
}
