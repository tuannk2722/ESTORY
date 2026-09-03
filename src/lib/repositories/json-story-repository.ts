// lib/repositories/json-story-repository.ts
import fs from "fs/promises";
import path from "path";
import { Story } from "@/types/story";
import { StoryRepository } from "./story-repository";

export function projectPublicStory(story: Story): Story | null {
  // Public boundaries fail closed: malformed legacy content must never become
  // visible merely because a required status field is absent.
  if (story.status !== "published" || !Array.isArray(story.chapters)) return null;
  return {
    ...story,
    chapters: story.chapters.filter(
      (chapter) => chapter.status === "published"
    ),
  };
}

export class JsonStoryRepository implements StoryRepository {
  private getStoriesDirectory(): string {
    return path.join(process.cwd(), "content", "stories");
  }

  async getAll(): Promise<Story[]> {
    try {
      const dirPath = this.getStoriesDirectory();
      await fs.mkdir(dirPath, { recursive: true });
      const files = await fs.readdir(dirPath);
      const jsonFiles = files.filter((file) => file.endsWith(".json"));

      const stories: Story[] = [];
      for (const file of jsonFiles) {
        const filePath = path.join(dirPath, file);
        const fileContent = await fs.readFile(filePath, "utf-8");
        try {
          const story = JSON.parse(fileContent) as Story;
          stories.push(story);
        } catch {
          // Bỏ qua file JSON bị lỗi cú pháp
        }
      }

      return stories;
    } catch {
      return [];
    }
  }

  async getAllPublic(): Promise<Story[]> {
    const all = await this.getAll();
    // Phase 1-2 data is explicitly seeded as published; missing status is
    // treated as invalid instead of silently exposed.
    return all
      .map(projectPublicStory)
      .filter((story): story is Story => story !== null);
  }

  async getById(id: string): Promise<Story | null> {
    try {
      const filePath = path.join(this.getStoriesDirectory(), `${id}.json`);
      const fileContent = await fs.readFile(filePath, "utf-8");
      return JSON.parse(fileContent) as Story;
    } catch {
      return null;
    }
  }

  async getPublicById(id: string): Promise<Story | null> {
    const story = await this.getById(id);
    return story ? projectPublicStory(story) : null;
  }

  async save(story: Story): Promise<void> {
    const dirPath = this.getStoriesDirectory();
    await fs.mkdir(dirPath, { recursive: true });
    const filePath = path.join(dirPath, `${story.id}.json`);
    const temporaryPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
    try {
      await fs.writeFile(temporaryPath, JSON.stringify(story, null, 2), "utf-8");
      await fs.rename(temporaryPath, filePath);
    } catch (error) {
      await fs.rm(temporaryPath, { force: true }).catch(() => undefined);
      throw error;
    }
  }
}
