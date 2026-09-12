import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import AppHeader from "@/components/ui/AppHeader";

export default function AdminPage() {
  return (
    <div className="min-h-dvh bg-[var(--color-background)] text-[var(--color-foreground)]">
      <AppHeader />
      <main className="mx-auto flex w-full max-w-3xl flex-1 px-4 py-12 sm:px-6 sm:py-16">
        <section className="glass-card w-full self-start p-6 shadow-xl sm:p-8" aria-labelledby="admin-title">
          <span className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--color-accent)]/15 text-[var(--color-accent)]">
            <ShieldCheck aria-hidden="true" className="h-6 w-6" />
          </span>
          <h1 id="admin-title" className="font-display text-2xl font-bold sm:text-3xl">Trang quản trị</h1>
          <p className="mt-3 max-w-prose text-sm leading-6 text-[var(--color-muted-foreground)] sm:text-base">
            Khu vực quản trị đã được bảo vệ. Công cụ kiểm duyệt truyện sẽ được triển khai trong P3-11.
          </p>
          <Link
            href="/"
            className="mt-8 inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-[var(--color-border)] px-4 py-2 text-sm font-semibold transition-colors hover:bg-[var(--color-muted)] motion-reduce:transition-none"
          >
            <ArrowLeft aria-hidden="true" className="h-4 w-4" />
            Về trang khám phá
          </Link>
        </section>
      </main>
    </div>
  );
}
