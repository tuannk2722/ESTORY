import { storyRepository } from "@/lib/repositories";
import AppHeader from "@/components/ui/AppHeader";
import StoryCard from "@/components/story/StoryCard";
import { Sparkles, BookOpen } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const stories = await storyRepository.getAllPublic();

  return (
    <div className="min-h-screen bg-[var(--color-background)] transition-colors duration-300">
      <AppHeader />

      <main className="max-w-6xl mx-auto px-4 py-8 md:py-16">
        {/* Hero Section */}
        <section className="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[var(--color-border)] bg-[var(--color-card)] text-xs font-ui font-medium text-[var(--color-accent)] mb-2 shadow-xs">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Trải nghiệm Đọc Truyện Đa Giác Quan</span>
          </div>

          <h1 className="font-display text-4xl md:text-6xl font-extrabold tracking-tight text-[var(--color-foreground)] leading-tight">
            Nơi Câu Chữ <br className="hidden sm:inline" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[var(--color-primary)] via-[var(--color-ring)] to-[var(--color-accent)]">
              Chạm Tới Cảm Xúc
            </span>
          </h1>

          <p className="font-story text-lg md:text-xl text-[var(--color-muted-foreground)] leading-relaxed pt-2">
            Đọc truyện sống động với hiệu ứng hình ảnh và âm thanh tự động kích hoạt theo từng dòng văn bạn đang theo dõi.
          </p>
        </section>

        {/* Stories Section */}
        <section className="space-y-6">
          <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-4">
            <h2 className="font-display text-2xl font-bold text-[var(--color-foreground)] flex items-center gap-2">
              <BookOpen className="w-6 h-6 text-[var(--color-accent)]" />
              <span>Truyện Nổi Bật</span>
            </h2>
            <span className="font-ui text-sm text-[var(--color-muted-foreground)]">
              {stories.length} truyện có sẵn
            </span>
          </div>

          {stories.length === 0 ? (
            <div className="glass-card p-12 text-center text-[var(--color-muted-foreground)]">
              <p>Chưa có tác phẩm nào trong thư viện.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {stories.map((story) => (
                <StoryCard key={story.id} story={story} />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
