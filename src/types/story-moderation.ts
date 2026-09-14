import type { CoverPosition, StoryStatus } from "./story";

export type ModerationStatusFilter = StoryStatus | "all";

export interface ModerationSummaryCounts {
  pendingReview: number;
  published: number;
  rejected: number;
}

export interface ModerationStoryListItem {
  id: string;
  title: string;
  author: string;
  cover_image?: string;
  cover_position?: CoverPosition;
  genre: string[];
  submittedAt: string | null;
  chapterCount: number;
  blockCount: number;
  effectCount: number;
  status: StoryStatus;
  updatedAt: string;
}

export interface ModerationStoryList {
  summary: ModerationSummaryCounts;
  items: ModerationStoryListItem[];
  total: number;
  nextCursor: string | null;
}

export interface ModerationListQuery {
  q: string;
  status: ModerationStatusFilter;
  cursor: string | null;
  limit: number;
}

export interface ModerationChapterSummary {
  id: string;
  title: string;
  order: number;
  status: "draft" | "published";
  blockCount: number;
  effectCount: number;
}

export interface ModerationStoryDetail {
  id: string;
  title: string;
  author: string;
  authorEmail: string;
  description: string;
  cover_image?: string;
  cover_position?: CoverPosition;
  genre: string[];
  status: StoryStatus;
  createdAt: string;
  submittedAt: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
  chapters: ModerationChapterSummary[];
}

export interface ModerationDecision {
  storyId: string;
  status: "published" | "rejected";
  reviewedAt: string;
}
