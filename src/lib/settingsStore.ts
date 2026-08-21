// lib/settingsStore.ts
import { ReaderSettings, ReadingProgress } from "@/types/settings";
import { Bookmark } from "@/types/bookmark";

export interface ISettingsStore {
  getSettings(): ReaderSettings;
  saveSettings(settings: Partial<ReaderSettings>): ReaderSettings;
  getProgress(storyId: string): ReadingProgress | null;
  getAllProgress(): ReadingProgress[];
  saveProgress(progress: ReadingProgress): void;
  getBookmarks(): Bookmark[];
  isBookmarked(storyId: string): boolean;
  toggleBookmark(storyId: string, userId?: string): boolean;
}

export const DEFAULT_READER_SETTINGS: ReaderSettings = {
  effects_enabled: true,
  effects_by_category: {
    visual: true,
    audio: true,
    motion: true,
    transition: true,
  },
  intensity_multiplier: 0.8,
  reduced_motion: false,
  font_size: "lg",
  theme: "dark",
};

const STORAGE_KEYS = {
  SETTINGS: "story_reader_settings",
  PROGRESS: "story_reading_progress",
  BOOKMARKS: "story_bookmarks",
} as const;

export class LocalStorageSettingsStore implements ISettingsStore {
  private isClient(): boolean {
    return typeof window !== "undefined";
  }

  getSettings(): ReaderSettings {
    if (!this.isClient()) {
      return DEFAULT_READER_SETTINGS;
    }

    try {
      const raw = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (!raw) return DEFAULT_READER_SETTINGS;
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_READER_SETTINGS, ...parsed };
    } catch {
      return DEFAULT_READER_SETTINGS;
    }
  }

  saveSettings(newSettings: Partial<ReaderSettings>): ReaderSettings {
    const current = this.getSettings();
    const updated: ReaderSettings = {
      ...current,
      ...newSettings,
      effects_by_category: {
        ...current.effects_by_category,
        ...(newSettings.effects_by_category || {}),
      },
    };

    if (this.isClient()) {
      try {
        localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(updated));
      } catch (error) {
        console.error("Failed to save settings to localStorage:", error);
      }
    }

    return updated;
  }

  getProgress(storyId: string): ReadingProgress | null {
    const all = this.getAllProgress();
    return all.find((p) => p.story_id === storyId) || null;
  }

  getAllProgress(): ReadingProgress[] {
    if (!this.isClient()) return [];
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.PROGRESS);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  saveProgress(progress: ReadingProgress): void {
    if (!this.isClient()) return;
    try {
      const all = this.getAllProgress();
      const existingIndex = all.findIndex((p) => p.story_id === progress.story_id);
      if (existingIndex >= 0) {
        all[existingIndex] = progress;
      } else {
        all.push(progress);
      }
      localStorage.setItem(STORAGE_KEYS.PROGRESS, JSON.stringify(all));
    } catch (error) {
      console.error("Failed to save progress to localStorage:", error);
    }
  }

  getBookmarks(): Bookmark[] {
    if (!this.isClient()) return [];
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.BOOKMARKS);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  isBookmarked(storyId: string): boolean {
    const bookmarks = this.getBookmarks();
    return bookmarks.some((b) => b.story_id === storyId);
  }

  toggleBookmark(storyId: string, userId: string = "guest_user"): boolean {
    if (!this.isClient()) return false;
    try {
      const bookmarks = this.getBookmarks();
      const index = bookmarks.findIndex((b) => b.story_id === storyId);
      let isBookmarkedNow = false;

      if (index >= 0) {
        bookmarks.splice(index, 1);
        isBookmarkedNow = false;
      } else {
        bookmarks.push({
          user_id: userId,
          story_id: storyId,
          created_at: new Date().toISOString(),
        });
        isBookmarkedNow = true;
      }

      localStorage.setItem(STORAGE_KEYS.BOOKMARKS, JSON.stringify(bookmarks));
      return isBookmarkedNow;
    } catch (error) {
      console.error("Failed to toggle bookmark in localStorage:", error);
      return false;
    }
  }
}

export const settingsStore = new LocalStorageSettingsStore();
