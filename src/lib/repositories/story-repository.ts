// lib/repositories/story-repository.ts
import { Story } from "@/types/story";

export interface StoryRepository {
  getAll(): Promise<Story[]>;
  getAllPublic(): Promise<Story[]>;
  /** Full author/editor read. Never apply the public chapter projection here. */
  getById(id: string): Promise<Story | null>;
  getPublicById(id: string): Promise<Story | null>;
  save(story: Story): Promise<void>;
}
