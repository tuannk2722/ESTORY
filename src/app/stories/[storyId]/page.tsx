import Link from "next/link";
import { notFound } from "next/navigation";
import { storyRepository } from "@/lib/repositories";
import AppHeader from "@/components/ui/AppHeader";
import StoryDetailActions from "@/components/story/StoryDetailActions";
import { User, BookOpen, ChevronRight, Sparkles } from "lucide-react";

interface StoryDetailPageProps {
  params: Promise<{ storyId: string }>;
}

export default async function StoryDetailPage({ params }: StoryDetailPageProps) {
  const { storyId } = await params;
  const story = await storyRepository.getById(storyId);

  if (!story) {
    notFound();
  }

  const sortedChapters = [...story.chapters].sort((a, b) => a.order - b.order);
  const firstChapter = sortedChapters[0];

  return (
    <div className="min-h-screen bg-[var(--color-background)] transition-colors duration-300">
      <AppHeader />

      <main className="max-w-4xl mx-auto px-4 py-8 md:py-12 space-y-12">
        {/* Breadcrumb */}
        <nav className="text-sm font-ui text-[var(--color-muted-foreground)]">
          <Link href="/" className="hover:text-[var(--color-foreground)] transition-colors">
            Khám phá
          </Link>
          <span className="mx-2">/</span>
          <span className="text-[var(--color-foreground)] line-clamp-1 inline">{story.title}</span>
        </nav>

        {/* Story Info Banner */}
        <div className="glass-card p-6 md:p-8 border border-[var(--color-border)] rounded-2xl space-y-6">
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {story.genre.map((g) => (
                <span
                  key={g}
                  className="px-3 py-1 text-xs font-ui rounded-full bg-[var(--color-secondary)] text-[var(--color-secondary-foreground)] border border-[var(--color-border)]"
                >
                  {g}
                </span>
              ))}
            </div>

            <h1 className="font-display text-3xl md:text-5xl font-bold tracking-tight text-[var(--color-foreground)]">
              {story.title}
            </h1>

            <div className="flex items-center gap-2 text-sm font-ui text-[var(--color-muted-foreground)]">
              <User className="w-4 h-4 text-[var(--color-accent)]" />
              <span>Tác giả: <strong className="text-[var(--color-foreground)]">{story.author}</strong></span>
            </div>
          </div>

          <p className="font-story text-base md:text-lg text-[var(--color-foreground)]/90 leading-relaxed border-t border-[var(--color-border)] pt-4">
            {story.description}
          </p>

          {/* Action buttons (Đọc tiếp / Bắt đầu / Bookmark) */}
          <StoryDetailActions story={story} firstChapter={firstChapter} />
        </div>

        {/* Chapters Table of Contents */}
        <section className="space-y-6">
          <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-4">
            <h2 className="font-display text-2xl font-bold text-[var(--color-foreground)] flex items-center gap-2">
              <BookOpen className="w-6 h-6 text-[var(--color-accent)]" />
              <span>Mục Lục Chương</span>
            </h2>
            <span className="font-ui text-sm text-[var(--color-muted-foreground)]">
              {sortedChapters.length} chương
            </span>
          </div>

          <div className="space-y-3">
            {sortedChapters.map((chapter) => {
              const effectCount = chapter.blocks.reduce(
                (acc, b) => acc + (b.effects?.length || 0),
                0
              );

              return (
                <Link
                  key={chapter.id}
                  href={`/stories/${story.id}/${chapter.id}`}
                  className="glass-card group flex items-center justify-between p-4 md:p-5 rounded-xl border border-[var(--color-border)] hover:border-[var(--color-accent)] transition-all duration-200 bg-[var(--color-card)]/70 hover:bg-[var(--color-muted)] hover:translate-x-1"
                >
                  <div className="space-y-1">
                    <span className="font-ui text-xs font-semibold text-[var(--color-accent)] uppercase tracking-wider">
                      Chương {chapter.order}
                    </span>
                    <h3 className="font-story text-lg md:text-xl font-bold text-[var(--color-foreground)] group-hover:text-[var(--color-accent)] transition-colors">
                      {chapter.title}
                    </h3>
                  </div>

                  <div className="flex items-center gap-4 text-xs font-ui text-[var(--color-muted-foreground)]">
                    {effectCount > 0 && (
                      <span className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-full bg-[var(--color-secondary)] border border-[var(--color-border)]">
                        <Sparkles className="w-3 h-3 text-[var(--color-accent)]" />
                        <span>{effectCount} hiệu ứng</span>
                      </span>
                    )}
                    <span className="flex items-center gap-1 text-[var(--color-primary)] font-semibold group-hover:translate-x-1 transition-transform">
                      Đọc <ChevronRight className="w-4 h-4" />
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}
