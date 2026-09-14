export default function AdminStoriesLoading() {
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8" aria-label="Đang tải trang kiểm duyệt">
      <div className="h-8 w-64 animate-pulse rounded-lg bg-[var(--color-muted)] motion-reduce:animate-none" />
      <div className="mt-3 h-5 w-full max-w-xl animate-pulse rounded bg-[var(--color-muted)] motion-reduce:animate-none" />
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((item) => (
          <div key={item} className="h-28 animate-pulse rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] motion-reduce:animate-none" />
        ))}
      </div>
      <div className="mt-6 h-20 animate-pulse rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] motion-reduce:animate-none" />
      <div className="mt-4 space-y-3">
        {[0, 1, 2].map((item) => (
          <div key={item} className="h-28 animate-pulse rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] motion-reduce:animate-none" />
        ))}
      </div>
    </main>
  );
}
