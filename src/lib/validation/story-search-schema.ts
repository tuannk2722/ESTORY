import { z } from "zod";
import type { PublicStoryListQuery } from "@/types/story-search";

export const PUBLIC_STORY_PAGE_SIZE = 9;
export const PUBLIC_STORY_MAX_PAGE_SIZE = 24;
export const STORY_QUERY_MAX_CODE_POINTS = 100;

type SearchParam = string | string[] | undefined;
export type PublicStorySearchParams = Record<string, SearchParam>;

function first(value: SearchParam): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function collapse(value: string): string {
  return value.trim().replace(/\s+/gu, " ");
}

function capCodePoints(value: string, maximum: number): string {
  return Array.from(value).slice(0, maximum).join("");
}

const cursorSchema = z.string().trim().min(1).max(1_000)
  .regex(/^[A-Za-z0-9_-]+$/);

export function canonicalizeStoryQuery(value: SearchParam): string {
  const raw = first(value);
  return raw ? capCodePoints(collapse(raw), STORY_QUERY_MAX_CODE_POINTS) : "";
}

export function canonicalizeStoryGenre(value: SearchParam): string | null {
  const raw = first(value);
  if (!raw) return null;
  const genre = capCodePoints(collapse(raw), STORY_QUERY_MAX_CODE_POINTS);
  return genre || null;
}

export function parsePublicStorySearchParams(
  params: PublicStorySearchParams,
): PublicStoryListQuery {
  const rawLimit = Number.parseInt(first(params.limit) ?? "", 10);
  const limit = Number.isFinite(rawLimit)
    ? Math.min(Math.max(rawLimit, 1), PUBLIC_STORY_MAX_PAGE_SIZE)
    : PUBLIC_STORY_PAGE_SIZE;
  const cursor = cursorSchema.safeParse(first(params.cursor));
  return {
    q: canonicalizeStoryQuery(params.q),
    genre: canonicalizeStoryGenre(params.genre),
    cursor: cursor.success ? cursor.data : null,
    limit,
  };
}
