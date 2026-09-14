import type {
  PublicGenreFacet,
  PublicStoryListQuery,
} from "./story-repository";
import {
  compareSearchLabels,
  normalizeSearchText,
} from "@/lib/search/text-search";

interface PublicCursorPayload {
  v: 1;
  q: string;
  genre: string | null;
  after: string;
}

function queryIdentity(input: Pick<PublicStoryListQuery, "q" | "genre">) {
  return {
    q: normalizeSearchText(input.q),
    genre: input.genre,
  };
}

export function encodePublicStoryCursor(
  input: Pick<PublicStoryListQuery, "q" | "genre">,
  after: string,
): string {
  const identity = queryIdentity(input);
  const payload: PublicCursorPayload = { v: 1, ...identity, after };
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

export function decodePublicStoryCursor(
  cursor: string | null,
  input: Pick<PublicStoryListQuery, "q" | "genre">,
): string | null {
  if (!cursor) return null;
  try {
    const parsed = JSON.parse(
      Buffer.from(cursor, "base64url").toString("utf8"),
    ) as Partial<PublicCursorPayload>;
    const identity = queryIdentity(input);
    return parsed.v === 1
      && parsed.q === identity.q
      && parsed.genre === identity.genre
      && typeof parsed.after === "string"
      && Boolean(parsed.after)
      ? parsed.after
      : null;
  } catch {
    return null;
  }
}

export function sortPublicGenreFacets(
  facets: Iterable<PublicGenreFacet>,
  limit: number,
): PublicGenreFacet[] {
  const safeLimit = Math.max(0, Math.trunc(limit));
  return [...facets]
    .filter((facet) => facet.genre.trim() && Number.isInteger(facet.storyCount) && facet.storyCount > 0)
    .sort((left, right) => right.storyCount - left.storyCount
      || compareSearchLabels(left.genre, right.genre))
    .slice(0, safeLimit);
}
