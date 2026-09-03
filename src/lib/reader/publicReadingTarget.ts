import type { Chapter } from "@/types/story";

export interface StoredReadingLocation {
  chapterId: string;
  blockId?: string | null;
}

export interface PublicReadingTarget {
  chapterId: string;
  blockId: string | null;
}

/**
 * Resolve the first stored location that is still reachable from the public
 * chapter projection. A deleted block falls back to the top of its chapter;
 * an unpublished/deleted chapter is ignored completely.
 */
export function resolvePublicReadingTarget(
  publicChapters: readonly Chapter[],
  ...locations: Array<StoredReadingLocation | null | undefined>
): PublicReadingTarget | null {
  for (const location of locations) {
    if (!location) continue;

    const chapter = publicChapters.find(
      (candidate) => candidate.id === location.chapterId
    );
    if (!chapter) continue;

    const blockId =
      location.blockId &&
      chapter.blocks.some((block) => block.id === location.blockId)
        ? location.blockId
        : null;

    return { chapterId: chapter.id, blockId };
  }

  return null;
}
