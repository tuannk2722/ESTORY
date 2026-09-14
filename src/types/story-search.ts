import type { Story } from "./story";

export type PublicStoryListItem = Pick<
  Story,
  "id" | "title" | "author" | "description" | "cover_image" | "cover_position" | "genre"
>;

export interface PublicStoryListQuery {
  q: string;
  genre: string | null;
  cursor: string | null;
  limit: number;
}

export interface PublicGenreFacet {
  genre: string;
  storyCount: number;
}

export interface CursorPage<T> {
  items: T[];
  total: number;
  nextCursor: string | null;
}
