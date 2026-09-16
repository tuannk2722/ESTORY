export default function AdminEffectsLoading() {
  return (
    <main className="mx-auto w-full max-w-7xl animate-pulse px-4 py-6 motion-reduce:animate-none sm:px-6 lg:px-8 lg:py-8" aria-label="Đang tải thư viện hiệu ứng">
      <div className="h-9 w-64 rounded-xl bg-[var(--color-muted)]" />
      <div className="mt-3 h-5 w-full max-w-xl rounded-lg bg-[var(--color-muted)]" />
      <div className="mt-7 h-20 rounded-2xl bg-[var(--color-card)]" />
      <div className="mt-5 space-y-2 rounded-2xl border border-[var(--color-border)] p-4">
        {Array.from({ length: 6 }, (_, index) => <div key={index} className="h-14 rounded-xl bg-[var(--color-muted)]" />)}
      </div>
    </main>
  );
}
