"use client";

import { CircleAlert, RefreshCw } from "lucide-react";

export default function AdminStoriesError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto flex w-full max-w-3xl px-4 py-12 sm:px-6">
      <section role="alert" className="w-full rounded-2xl border border-[var(--color-destructive)]/35 bg-[var(--color-card)] p-6 shadow-sm">
        <CircleAlert aria-hidden="true" className="h-9 w-9 text-[var(--color-destructive)]" />
        <h1 className="mt-4 font-display text-2xl font-bold">Không tải được hàng đợi kiểm duyệt</h1>
        <p className="mt-2 text-sm leading-6 text-[var(--color-muted-foreground)]">
          Bộ lọc hiện tại vẫn được giữ nguyên. Hãy thử tải lại dữ liệu.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--color-primary)] px-4 text-sm font-semibold text-[var(--color-primary-foreground)] hover:bg-[var(--color-primary-hover)]"
        >
          <RefreshCw aria-hidden="true" className="h-4 w-4" />
          Thử lại
        </button>
      </section>
    </main>
  );
}
