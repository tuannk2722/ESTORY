import { storyRepository } from "@/lib/repositories";
import AppHeader from "@/components/ui/AppHeader";
import ReadingListClient from "@/components/library/ReadingListClient";
import { Clock } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ReadingLibraryPage() {
  const stories = await storyRepository.getAll();

  return (
    <div className="min-h-screen bg-[var(--color-background)] transition-colors duration-300">
      <AppHeader />

      <main className="max-w-4xl mx-auto px-4 py-8 md:py-12 space-y-8">
        <header className="space-y-2 border-b border-[var(--color-border)] pb-4">
          <h1 className="font-display text-3xl md:text-4xl font-bold text-[var(--color-foreground)] flex items-center gap-3">
            <Clock className="w-8 h-8 text-cyan-400" />
            <span>Truyện Đang Đọc</span>
          </h1>
          {/* <p className="font-story text-base text-[var(--color-muted-foreground)]">
            Tự động lưu lại chính xác vị trí đoạn văn bạn đã dừng chân.
          </p> */}
        </header>

        <ReadingListClient stories={stories} />
      </main>
    </div>
  );
}
