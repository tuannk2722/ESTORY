// lib/repositories/json-story-repository.ts
import fs from "fs/promises";
import path from "path";
import { Story } from "@/types/story";
import type { PublicChapterReaderData, StoryRepository } from "./story-repository";
import type { SceneRepository } from "./scene-repository";
import { JsonSceneLibraryRepository, JsonSceneRepository } from "./json-scene-repository";

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
  constructor(private readonly rootDirectory = process.cwd(), private readonly sceneReader?: SceneRepository) {}

  private getStoriesDirectory(): string {
    return path.join(this.rootDirectory, "content", "stories");
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
    // A route slug must never become a filesystem path outside the story directory.
    if (!id || id === "." || id === ".." || /[\\/\u0000]/.test(id)) return null;
    try {
      const filePath = path.join(this.getStoriesDirectory(), `${id}.json`);
      const fileContent = await fs.readFile(filePath, "utf-8");
      const story = JSON.parse(fileContent) as Story;
      return story.id === id ? story : null;
    } catch {
      return null;
    }
  }

  async getPublicById(id: string): Promise<Story | null> {
    const story = await this.getById(id);
    return story ? projectPublicStory(story) : null;
  }

  async getPublicChapter(storyId: string, chapterId: string): Promise<PublicChapterReaderData | null> {
    const story = await this.getPublicById(storyId);
    if (!story) return null;
    const chapters = [...story.chapters].sort((a, b) => a.order - b.order);
    const index = chapters.findIndex(chapter => chapter.id === chapterId);
    if (index === -1) return null;
    // Check public Story + Chapter before touching scene/catalog storage.
    const reader = this.sceneReader ?? new JsonSceneRepository(this, new JsonSceneLibraryRepository(this.rootDirectory), this.rootDirectory);
    return {
      story: { id: story.id, title: story.title }, chapter: chapters[index],
      scenes: await reader.getByChapter(storyId, chapterId),
      previousChapterId: chapters[index - 1]?.id ?? null,
      nextChapterId: chapters[index + 1]?.id ?? null,
      isLastChapter: index === chapters.length - 1,
    };
  }

  async getAllForAuthor(_authorId: string): Promise<Story[]> {
    // Legacy author display names cannot establish ownership of an authenticated user.
    void _authorId;
    throw new Error("Author queries require migrated stable ownership");
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
