// lib/repositories/json-story-repository.ts
import fs from "fs/promises";
import path from "path";
import { Story } from "@/types/story";
import { StoryRepository } from "./story-repository";

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

  async getById(id: string): Promise<Story | null> {
    try {
      const filePath = path.join(this.getStoriesDirectory(), `${id}.json`);
      const fileContent = await fs.readFile(filePath, "utf-8");
      return JSON.parse(fileContent) as Story;
    } catch {
      return null;
    }
  }

  async save(story: Story): Promise<void> {
    const dirPath = this.getStoriesDirectory();
    await fs.mkdir(dirPath, { recursive: true });
    const filePath = path.join(dirPath, `${story.id}.json`);
    await fs.writeFile(filePath, JSON.stringify(story, null, 2), "utf-8");
  }
}
