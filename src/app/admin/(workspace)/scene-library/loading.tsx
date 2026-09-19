export default function AdminSceneLibraryLoading() {
  return (
    <main className="mx-auto w-full max-w-7xl animate-pulse px-4 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] motion-reduce:animate-none sm:px-6 lg:px-8 lg:py-8" aria-label="Đang tải thư viện bối cảnh">
      <div className="h-10 w-72 rounded-xl bg-[var(--color-muted)]" />
      <div className="mt-3 h-5 max-w-2xl rounded-lg bg-[var(--color-muted)]" />
      <div className="mt-7 h-14 max-w-lg rounded-2xl bg-[var(--color-card)]" />
      <div className="mt-5 h-20 rounded-2xl bg-[var(--color-card)]" />
      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 12 }, (_, index) => <div key={index} className="aspect-video rounded-2xl bg-[var(--color-muted)]" />)}
      </div>
    </main>
  );
}
