import type { PublicGenreFacet } from "@/lib/repositories/story-repository";
import StorySearchForm from "@/components/story/StorySearchForm";
import HomeGenreFilters from "./HomeGenreFilters";
import HomeHeroArtwork from "./HomeHeroArtwork";

export default function HomeHero({
  q,
  genre,
  facets,
}: {
  q: string;
  genre: string | null;
  facets: PublicGenreFacet[];
}) {
  return (
    <section className="relative isolate flex min-h-[clamp(26rem,34vw,32rem)] w-full items-center overflow-hidden px-4 py-12 sm:px-6 sm:py-14 lg:py-16">
      <HomeHeroArtwork />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[var(--home-hero-scrim)]" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[var(--home-hero-bottom-fade)]" />

      <div className="relative z-10 mx-auto w-full max-w-5xl space-y-6 text-center">

        <div className="mx-auto max-w-3xl space-y-3">
          <h1 className="font-display text-4xl font-extrabold leading-tight tracking-tight text-[var(--color-foreground)] sm:text-5xl md:text-6xl">
            Nơi Câu Chữ <br className="hidden sm:inline" />
            <span className="bg-gradient-to-r from-[var(--color-primary)] via-[var(--color-ring)] to-[var(--color-accent)] bg-clip-text text-transparent">
              Chạm Tới Cảm Xúc
            </span>
          </h1>
          <p className="font-story text-lg leading-relaxed text-[var(--color-muted-foreground)] md:text-xl">
            Đọc và sáng tác những câu chuyện sống động với bối cảnh, âm thanh và hiệu ứng tương tác kích hoạt theo từng dòng văn.
          </p>
        </div>

        <StorySearchForm q={q} genre={genre} />
        <HomeGenreFilters facets={facets} q={q} activeGenre={genre} />
      </div>
    </section>
  );
}
