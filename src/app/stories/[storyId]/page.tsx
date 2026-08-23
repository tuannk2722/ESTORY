import Link from "next/link";
import { notFound } from "next/navigation";
import { storyRepository } from "@/lib/repositories";
import AppHeader from "@/components/ui/AppHeader";
import StoryDetailActions from "@/components/story/StoryDetailActions";
import ChapterList from "@/components/story/ChapterList";
import { User } from "lucide-react";

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
        <ChapterList storyId={story.id} chapters={sortedChapters} />
      </main>
    </div>
  );
}
