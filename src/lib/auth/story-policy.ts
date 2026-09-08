import { AuthAccessError, hasMinimumRole } from "./policy";
import { conflict, notFound } from "@/lib/services/command-error";
import type { Role } from "@/types/user";

export interface StoryActor { id: string; role: Role; name: string | null }
export interface StoryAccessRecord {
  id: string; slug: string; authorId: string; status: string; updatedAt: Date;
}

export function requireStoryOwnerOrAdmin(actor: StoryActor, story: StoryAccessRecord | null): asserts story is StoryAccessRecord {
  if (!hasMinimumRole(actor.role, "author")) throw new AuthAccessError(403);
  // Same response for an inaccessible and a missing Story, including public stories.
  if (!story || (story.authorId !== actor.id && actor.role !== "admin")) notFound();
}

export function requireChapterInStory<T extends { storyId: string }>(story: StoryAccessRecord, chapter: T | null): asserts chapter is T {
  if (!chapter || chapter.storyId !== story.id) notFound();
}

export function requireStoryMutable(actor: StoryActor, story: StoryAccessRecord): void {
  if (story.status === "PENDING_REVIEW" && actor.role !== "admin") {
    conflict("STORY_PENDING_REVIEW", "Cancel the review submission before editing.");
  }
  if (!["DRAFT", "REJECTED", "PUBLISHED", "PENDING_REVIEW"].includes(story.status)) {
    conflict("STORY_NOT_MUTABLE", "Restore the story to draft before editing.");
  }
}
