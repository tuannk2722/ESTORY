import type {
  ChapterStatus,
  CoverPosition,
  StoryStatus,
} from "./story";

/** Lean owner/admin row used by chapter management; editor content stays server-side. */
export interface ManagedChapter {
  id: string;
  title: string;
  order: number;
  status: ChapterStatus;
  blockCount: number;
  effectCount: number;
}

export type ChapterOrder = Pick<ManagedChapter, "id" | "order">;

/** Interactive management needs metadata and chapter counts, not every block/effect payload. */
export interface ManagedStory {
  id: string;
  title: string;
  author: string;
  description: string;
  cover_image?: string;
  cover_position?: CoverPosition;
  genre: string[];
  status: StoryStatus;
  chapters: ManagedChapter[];
}

/** Owner/admin-only projection. Moderation details never enter the public Story DTO. */
export interface ManagedStoryData {
  story: ManagedStory;
  rejectionReason: string | null;
}

/** Dashboard revisions belong to each aggregate, so there is no synthetic list revision. */
export interface AuthorStoryListItem {
  story: ManagedStory;
  rejectionReason: string | null;
  updatedAt: string;
}
