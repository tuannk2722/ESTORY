import { Suspense } from "react";
import AppHeader from "@/components/ui/AppHeader";
import HomeHero from "@/components/home/HomeHero";
import HomeStoryResults, {
  HomeStoryResultsSkeleton,
  type HomeStoryResult,
} from "@/components/home/HomeStoryResults";
import { storyRepository } from "@/lib/repositories";
import {
  parsePublicStorySearchParams,
  type PublicStorySearchParams,
} from "@/lib/validation/story-search-schema";

export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<PublicStorySearchParams>;
}) {
  const query = parsePublicStorySearchParams(await searchParams);
  const result: Promise<HomeStoryResult> = storyRepository
    .listPublicStories(query)
    .then((page) => ({ ok: true as const, page }))
    .catch(() => ({ ok: false as const }));
  const facets = await storyRepository.listPublicGenreFacets(6).catch(() => []);
  const resultKey = `${query.q}\u0000${query.genre ?? ""}\u0000${query.cursor ?? ""}`;

  return (
    <div className="min-h-screen bg-[var(--color-background)] transition-colors duration-300 motion-reduce:transition-none">
      <AppHeader />
      <main>
        <HomeHero q={query.q} genre={query.genre} facets={facets} />
        <Suspense key={resultKey} fallback={<HomeStoryResultsSkeleton />}>
          <HomeStoryResults query={query} result={result} />
        </Suspense>
      </main>
    </div>
  );
}
