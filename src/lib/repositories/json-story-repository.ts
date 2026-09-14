// lib/repositories/json-story-repository.ts
import fs from "fs/promises";
import path from "path";
import { Story } from "@/types/story";
import type {
  CursorPage,
  PublicChapterReaderData,
  PublicGenreFacet,
  PublicStoryListItem,
  PublicStoryListQuery,
  StoryRepository,
} from "./story-repository";
import type { SceneRepository } from "./scene-repository";
import { JsonSceneLibraryRepository, JsonSceneRepository } from "./json-scene-repository";
import { buildStorySearchText, tokenizeSearchText } from "@/lib/search/text-search";
import {
  decodePublicStoryCursor,
  encodePublicStoryCursor,
  sortPublicGenreFacets,
} from "./public-story-list";

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
      const jsonFiles = files.filter((file) => file.endsWith(".json")).sort();

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

  async listPublicStories(
    input: PublicStoryListQuery,
  ): Promise<CursorPage<PublicStoryListItem>> {
    const tokens = tokenizeSearchText(input.q);
    const after = decodePublicStoryCursor(input.cursor, input);
    const limit = Math.min(Math.max(Math.trunc(input.limit), 1), 24);
    const matches = (await this.getAllPublic())
      .filter((story) => input.genre === null
        || story.genre.some((genre) => genre.trim() === input.genre))
      .filter((story) => {
        const document = buildStorySearchText(story.title, story.author);
        return tokens.every((token) => document.includes(token));
      })
      .sort((left, right) => left.id < right.id ? -1 : left.id > right.id ? 1 : 0);
    const nextIndex = after === null
      ? 0
      : matches.findIndex((story) => story.id > after);
    const start = nextIndex === -1 ? matches.length : nextIndex;
    const page = matches.slice(start, start + limit);
    const items = page.map((story): PublicStoryListItem => ({
      id: story.id,
      title: story.title,
      author: story.author,
      description: story.description,
      ...(story.cover_image === undefined ? {} : { cover_image: story.cover_image }),
      ...(story.cover_position === undefined ? {} : { cover_position: story.cover_position }),
      genre: [...story.genre],
    }));
    return {
      items,
      total: matches.length,
      nextCursor: start + page.length < matches.length && page.length > 0
        ? encodePublicStoryCursor(input, page[page.length - 1].id)
        : null,
    };
  }

  async listPublicGenreFacets(limit: number): Promise<PublicGenreFacet[]> {
    const counts = new Map<string, number>();
    for (const story of await this.getAllPublic()) {
      const labels = new Set(story.genre.map((genre) => genre.trim()).filter(Boolean));
      for (const genre of labels) counts.set(genre, (counts.get(genre) ?? 0) + 1);
    }
    return sortPublicGenreFacets(
      [...counts].map(([genre, storyCount]) => ({ genre, storyCount })),
      limit,
    );
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
