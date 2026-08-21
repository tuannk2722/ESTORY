import Link from "next/link";

export default function BookmarksLibraryPage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <header className="mb-6">
        <h1 className="text-3xl font-bold">Đã Lưu (Bookmarks)</h1>
        <p className="text-muted-foreground mt-1">Danh sách các truyện bạn đã đánh dấu để đọc sau.</p>
      </header>
      <div className="empty-state p-8 text-center text-muted-foreground border rounded-lg">
        {/* TODO: Phase 1 đọc từ settingsStore.getBookmarks() */}
        <p>Chưa có truyện nào trong danh sách đã lưu.</p>
        <Link href="/" className="inline-block mt-4 text-primary hover:underline">
          Khám phá thư viện truyện →
        </Link>
      </div>
    </div>
  );
}
