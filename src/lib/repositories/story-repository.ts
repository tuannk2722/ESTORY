// lib/repositories/story-repository.ts
import type { Chapter, Story } from "@/types/story";
import type { Scene } from "@/types/scene";

export interface PublicChapterReaderData {
  story: Pick<Story, "id" | "title">;
  chapter: Chapter;
  scenes: Scene[];
  previousChapterId: string | null;
  nextChapterId: string | null;
  isLastChapter: boolean;
}

export interface StoryRepository {
  getAll(): Promise<Story[]>;
  getAllPublic(): Promise<Story[]>;
  /** Full author/editor read. Never apply the public chapter projection here. */
  getById(id: string): Promise<Story | null>;
  getPublicById(id: string): Promise<Story | null>;
  getPublicChapter(storyId: string, chapterId: string): Promise<PublicChapterReaderData | null>;
  getAllForAuthor(authorId: string): Promise<Story[]>;
  /** JSON compatibility only. Phase 3 mutations use command services. */
  save(story: Story): Promise<void>;
}
