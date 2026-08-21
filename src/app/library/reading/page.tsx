import Link from "next/link";

export default function ReadingLibraryPage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <header className="mb-6">
        <h1 className="text-3xl font-bold">Đang Đọc</h1>
        <p className="text-muted-foreground mt-1">Danh sách các truyện bạn đang đọc dở.</p>
      </header>
      <div className="empty-state p-8 text-center text-muted-foreground border rounded-lg">
        {/* TODO: Phase 1 đọc từ settingsStore.getAllProgress() */}
        <p>Chưa có tiến trình đọc nào được lưu.</p>
        <Link href="/" className="inline-block mt-4 text-primary hover:underline">
          Khám phá thư viện truyện →
        </Link>
      </div>
    </div>
  );
}
