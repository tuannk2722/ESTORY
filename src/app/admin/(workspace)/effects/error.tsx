"use client";

import { RefreshCw } from "lucide-react";

export default function AdminEffectsError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div role="alert" className="rounded-2xl border border-[var(--color-destructive)]/45 bg-[var(--color-card)] p-6">
        <h1 className="font-display text-2xl font-bold">Không thể mở thư viện hiệu ứng</h1>
        <p className="mt-2 text-sm text-[var(--color-muted-foreground)]">Dữ liệu quản trị chưa tải được. Bộ lọc trên URL vẫn được giữ nguyên.</p>
        <button type="button" onClick={reset} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--color-primary)] px-4 text-sm font-semibold text-[var(--color-primary-foreground)] hover:bg-[var(--color-primary-hover)]"><RefreshCw aria-hidden="true" className="h-4 w-4" /> Thử lại</button>
      </div>
    </main>
  );
}
