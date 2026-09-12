import Link from "next/link";
import { notFound } from "next/navigation";
import { storyRepository } from "@/lib/repositories";
import AppHeader from "@/components/ui/AppHeader";
import StoryDetailActions from "@/components/story/StoryDetailActions";
import ChapterList from "@/components/story/ChapterList";
import { BookOpen, User } from "lucide-react";
import { coverObjectPosition } from "@/lib/story-cover";
import StoryCoverImage from "@/components/story/StoryCoverImage";

interface StoryDetailPageProps {
  params: Promise<{ storyId: string }>;
}

export default async function StoryDetailPage({ params }: StoryDetailPageProps) {
  const { storyId } = await params;
  const story = await storyRepository.getPublicById(storyId);

  if (!story) {
    notFound();
  }

  const sortedChapters = [...story.chapters].sort((a, b) => a.order - b.order);
  const firstChapter = sortedChapters[0];

  return (
    <div className="min-h-screen bg-[var(--color-background)] transition-colors duration-300">
      <AppHeader />

      <main className="mx-auto max-w-6xl space-y-10 px-4 py-8 md:space-y-12 md:py-12">
        {/* Breadcrumb */}
        <nav className="text-sm font-ui text-[var(--color-muted-foreground)]">
          <Link href="/" className="hover:text-[var(--color-foreground)] transition-colors">
            Khám phá
          </Link>
          <span className="mx-2">/</span>
          <span className="text-[var(--color-foreground)] line-clamp-1 inline">{story.title}</span>
        </nav>

        {/* Story Info Banner */}
        <article className="relative overflow-hidden rounded-3xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-[var(--shadow-story-hero)] md:aspect-video">
          <div className="relative aspect-video w-full overflow-hidden md:absolute md:inset-0 md:aspect-auto">
            {story.cover_image ? (
              <StoryCoverImage
                priority
                src={story.cover_image}
                alt={`Ảnh bìa ${story.title}`}
                className="object-cover"
                objectPosition={coverObjectPosition(story.cover_position)}
                sizes="(max-width: 1024px) calc(100vw - 2rem), 72rem"
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-[var(--color-primary)] via-slate-900 to-slate-950">
                <BookOpen
                  aria-hidden="true"
                  className="absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 text-white/20"
                />
              </div>
            )}
            <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/15 to-black/10" />
            <div aria-hidden="true" className="absolute inset-0 hidden bg-gradient-to-r from-black/80 via-black/35 to-transparent md:block" />
          </div>

          <div className="relative z-10 bg-slate-950 px-5 pb-6 pt-5 text-white md:absolute md:inset-0 md:flex md:items-end md:bg-transparent md:px-10 md:py-9 lg:px-12 lg:py-11">
            <div className="w-full max-w-3xl space-y-4 md:space-y-5">
              <div className="flex flex-wrap gap-2">
                {story.genre.map((genre) => (
                  <span
                    key={genre}
                    className="rounded-full border border-white/20 bg-black/35 px-3 py-1 font-ui text-xs font-medium text-white/90 backdrop-blur-md"
                  >
                    {genre}
                  </span>
                ))}
              </div>

              <h1 className="max-w-3xl font-display text-3xl font-bold leading-tight tracking-tight text-white text-shadow-lg md:text-5xl lg:text-6xl">
                {story.title}
              </h1>

              <p className="line-clamp-4 max-w-2xl font-story text-base leading-relaxed text-white/88 md:line-clamp-3 md:text-lg lg:text-xl">
                {story.description}
              </p>

              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 font-ui text-sm text-white/80">
                <span className="flex items-center gap-2">
                  <User aria-hidden="true" className="h-4 w-4 text-[var(--color-accent)]" />
                  <strong className="font-medium text-white">{story.author}</strong>
                </span>
                <span className="flex items-center gap-2">
                  <BookOpen aria-hidden="true" className="h-4 w-4 text-[var(--color-accent)]" />
                  {sortedChapters.length} chương
                </span>
              </div>

              <StoryDetailActions story={story} firstChapter={firstChapter} variant="media" />
            </div>
          </div>
        </article>

        {/* Chapters Table of Contents */}
        <div className="mx-auto w-full max-w-4xl">
          <ChapterList storyId={story.id} chapters={sortedChapters} />
        </div>
      </main>
    </div>
  );
}
