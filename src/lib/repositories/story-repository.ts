// lib/repositories/story-repository.ts
import { Story } from "@/types/story";

export interface StoryRepository {
  getAll(): Promise<Story[]>;
  getById(id: string): Promise<Story | null>;
  save(story: Story): Promise<void>;
}
