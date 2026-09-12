import type { CoverPosition, StoryStatus } from "@/types/story";
import type { ManagedChapter } from "@/types/story-management";

export interface StoryFormValue {
  title: string;
  byline: string;
  description: string;
  genre: string[];
  coverFile: File | null;
  coverPreviewUrl: string | null;
  coverPosition: CoverPosition;
  coverError: string | null;
}

export interface WizardChapter {
  clientId: string;
  title: string;
}

export type StoryField = "title" | "byline" | "description" | "genre" | "cover";
export type StoryFieldErrors = Partial<Record<StoryField, string>>;

export type ChapterFieldErrors = Record<string, string>;

export type UploadPhase =
  | "idle"
  | "requesting-url"
  | "uploading"
  | "processing"
  | "complete"
  | "error"
  | "cancelled";

export interface UploadPartProgress {
  role: "primary" | "poster";
  percent: number;
}

export interface CoverUploadState {
  phase: UploadPhase;
  parts: UploadPartProgress[];
  message?: string;
}

export type StoryAction = "submit" | "cancel-review" | "archive" | "restore" | "delete";

export interface StoryCommandResult<T> {
  data: T;
  meta: { updatedAt: string };
}

export interface ChapterManagerActions {
  onCreate(title: string, afterChapterId?: string): Promise<ManagedChapter | null>;
  onRename(chapterId: string, title: string): Promise<boolean>;
  onDelete(chapter: ManagedChapter): Promise<boolean>;
  onReorder(chapterIds: string[]): Promise<boolean>;
  onTogglePublication(chapter: ManagedChapter): Promise<boolean>;
}

export const STORY_STATUS_LABELS: Record<StoryStatus, string> = {
  draft: "Nháp",
  pending_review: "Chờ duyệt",
  published: "Đã xuất bản",
  rejected: "Bị từ chối",
  archived: "Lưu trữ",
};
