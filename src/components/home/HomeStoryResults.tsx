import Link from "next/link";
import { BookOpen, RotateCcw } from "lucide-react";
import StoryCard from "@/components/story/StoryCard";
import type {
  CursorPage,
  PublicStoryListItem,
  PublicStoryListQuery,
} from "@/lib/repositories/story-repository";

export type HomeStoryResult =
  | { ok: true; page: CursorPage<PublicStoryListItem> }
  | { ok: false };

function resultHeading(q: string, genre: string | null): string {
  if (q && genre) return `Kết quả cho “${q}” · Thể loại “${genre}”`;
  if (q) return `Kết quả cho “${q}”`;
  if (genre) return `Thể loại “${genre}”`;
  return "Truyện Nổi Bật";
}

function queryUrl(query: PublicStoryListQuery, cursor?: string): string {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.genre) params.set("genre", query.genre);
  if (cursor) params.set("cursor", cursor);
  const value = params.toString();
  return value ? `/?${value}` : "/";
}

export default async function HomeStoryResults({
  query,
  result,
}: {
  query: PublicStoryListQuery;
  result: Promise<HomeStoryResult>;
}) {
  const resolved = await result;
  if (!resolved.ok) {
    return (
      <section id="home-story-results" className="mx-auto w-full max-w-6xl px-4 pb-16 pt-8">
        <div role="alert" className="glass-card p-8 text-center">
          <h2 className="font-display text-2xl font-bold">Không thể tải thư viện truyện</h2>
          <p className="mt-2 text-sm text-[var(--color-muted-foreground)]">Vui lòng thử lại mà không làm mất bộ lọc hiện tại.</p>
          <a href={queryUrl(query, query.cursor ?? undefined)} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--color-primary)] px-5 py-2 font-semibold text-[var(--color-primary-foreground)]">
            <RotateCcw aria-hidden="true" className="h-4 w-4" />
            Thử lại
          </a>
        </div>
      </section>
    );
  }

  const { page } = resolved;
  const filtered = Boolean(query.q || query.genre);
  return (
    <section id="home-story-results" aria-labelledby="home-story-results-title" className="mx-auto w-full max-w-6xl px-4 pb-16 pt-8 md:pt-10">
      <div className="flex flex-col gap-2 border-b border-[var(--color-border)] pb-4 sm:flex-row sm:items-end sm:justify-between">
        <h2 id="home-story-results-title" className="flex min-w-0 items-start gap-2 font-display text-2xl font-bold text-[var(--color-foreground)]">
          <BookOpen aria-hidden="true" className="mt-1 h-6 w-6 shrink-0 text-[var(--color-accent)]" />
          <span className="break-words">{resultHeading(query.q, query.genre)}</span>
        </h2>
        <p role="status" className="shrink-0 font-ui text-sm text-[var(--color-muted-foreground)]">
          {page.total} truyện có sẵn
        </p>
      </div>

      {page.items.length === 0 ? (
        <div className="glass-card mt-6 p-8 text-center sm:p-12">
          <h3 className="font-display text-xl font-bold">
            {filtered ? "Không tìm thấy truyện phù hợp" : "Chưa có tác phẩm nào trong thư viện"}
          </h3>
          <p className="mt-2 text-sm text-[var(--color-muted-foreground)]">
            {filtered ? "Hãy thử từ khóa khác hoặc xóa các bộ lọc hiện tại." : "Các tác phẩm đã xuất bản sẽ xuất hiện tại đây."}
          </p>
          {filtered ? (
            <Link href="/" scroll={false} className="mt-5 inline-flex min-h-11 items-center rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-5 py-2 font-semibold text-[var(--color-foreground)] hover:border-[var(--color-primary)]">
              Xóa bộ lọc
            </Link>
          ) : null}
        </div>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {page.items.map((story) => <StoryCard key={story.id} story={story} />)}
          </div>
          {page.nextCursor ? (
            <div className="mt-8 flex justify-center">
              <Link href={queryUrl(query, page.nextCursor)} scroll={false} className="inline-flex min-h-11 items-center rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-6 py-2 font-semibold text-[var(--color-foreground)] hover:border-[var(--color-primary)]">
                Trang tiếp theo
              </Link>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}

export function HomeStoryResultsSkeleton() {
  return (
    <section id="home-story-results" aria-busy="true" aria-label="Đang tải danh sách truyện" className="mx-auto w-full max-w-6xl px-4 pb-16 pt-8">
      <div className="h-9 w-64 animate-pulse rounded-lg bg-[var(--color-muted)] motion-reduce:animate-none" />
      <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]">
            <div className="aspect-video animate-pulse bg-[var(--color-muted)] motion-reduce:animate-none" />
            <div className="space-y-3 p-4">
              <div className="h-5 w-3/4 animate-pulse rounded bg-[var(--color-muted)] motion-reduce:animate-none" />
              <div className="h-4 w-1/2 animate-pulse rounded bg-[var(--color-muted)] motion-reduce:animate-none" />
              <div className="h-12 animate-pulse rounded bg-[var(--color-muted)] motion-reduce:animate-none" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
