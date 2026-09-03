import { storyRepository } from "@/lib/repositories";
import AppHeader from "@/components/ui/AppHeader";
import BookmarksListClient from "@/components/library/BookmarksListClient";
import { Bookmark } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function BookmarksLibraryPage() {
  const stories = await storyRepository.getAllPublic();

  return (
    <div className="min-h-screen bg-[var(--color-background)] transition-colors duration-300">
      <AppHeader />

      <main className="max-w-4xl mx-auto px-4 py-8 md:py-12 space-y-8">
        <header className="space-y-2 border-b border-[var(--color-border)] pb-4">
          <h1 className="font-display text-3xl md:text-4xl font-bold text-[var(--color-foreground)] flex items-center gap-3">
            <Bookmark className="w-8 h-8 text-amber-400" />
            <span>Truyện Đã Lưu</span>
          </h1>
          {/* <p className="font-story text-base text-[var(--color-muted-foreground)]">
            Danh sách các tác phẩm bạn đã chủ động đánh dấu để theo dõi.
          </p> */}
        </header>

        <BookmarksListClient stories={stories} />
      </main>
    </div>
  );
}
