import Link from "next/link";
import { Check } from "lucide-react";
import type { PublicGenreFacet } from "@/lib/repositories/story-repository";

function homeUrl(q: string, genre: string | null): string {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (genre) params.set("genre", genre);
  const query = params.toString();
  return query ? `/?${query}` : "/";
}

export default function HomeGenreFilters({
  facets,
  q,
  activeGenre,
}: {
  facets: PublicGenreFacet[];
  q: string;
  activeGenre: string | null;
}) {
  if (facets.length === 0) return null;
  const baseClass = "inline-flex min-h-11 max-w-full items-center justify-center gap-1.5 rounded-full border px-4 py-2 text-center font-ui text-sm font-medium leading-snug transition-colors motion-reduce:transition-none";
  return (
    <nav aria-label="Lọc theo thể loại" className="mx-auto flex max-w-4xl flex-wrap justify-center gap-2">
      <Link
        href={homeUrl(q, null)}
        scroll={false}
        aria-current={activeGenre === null ? "page" : undefined}
        className={`${baseClass} ${activeGenre === null
          ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-[var(--color-primary-foreground)]"
          : "border-[var(--color-border)] bg-[var(--home-hero-control-surface)] text-[var(--color-foreground)] hover:border-[var(--color-primary)]"}`}
      >
        {activeGenre === null ? <Check aria-hidden="true" className="h-4 w-4" /> : null}
        Tất cả
      </Link>
      {facets.map((facet) => {
        const active = facet.genre === activeGenre;
        return (
          <Link
            key={facet.genre}
            href={homeUrl(q, facet.genre)}
            scroll={false}
            aria-current={active ? "page" : undefined}
            aria-label={`${facet.genre}, ${facet.storyCount} truyện`}
            className={`${baseClass} ${active
              ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-[var(--color-primary-foreground)]"
              : "border-[var(--color-border)] bg-[var(--home-hero-control-surface)] text-[var(--color-foreground)] hover:border-[var(--color-primary)]"}`}
          >
            {active ? <Check aria-hidden="true" className="h-4 w-4 shrink-0" /> : null}
            <span className="min-w-0 break-words">{facet.genre}</span>
          </Link>
        );
      })}
    </nav>
  );
}
