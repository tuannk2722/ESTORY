import type { ReaderSettings, ReadingProgress, ResumeReading } from "@/types/settings";
import type { Bookmark } from "@/types/bookmark";
import { bookmarkSchema, progressSchema, readerSettingsSchema, settingsPatchSchema, type GuestImport } from "./schema";
import { DEFAULT_READER_SETTINGS, mergeSettings } from "./settings";

export interface ISettingsStore {
  getSettings(): ReaderSettings;
  getReducedMotionOverride(): boolean | null;
  saveSettings(settings: Partial<ReaderSettings>): ReaderSettings;
  getProgress(storyId: string): ReadingProgress | null;
  getAllProgress(): ReadingProgress[];
  saveProgress(progress: ReadingProgress): void;
  getBookmarks(): Bookmark[];
  isBookmarked(storyId: string): boolean;
  toggleBookmark(storyId: string, userId?: string): boolean;
  getResumeReading(storyId: string): ResumeReading | null;
  saveResumeReading(storyId: string, resume: ResumeReading): void;
}
export const GUEST_KEYS = {
  settings: "story_reader_settings", progress: "story_reading_progress", bookmarks: "story_bookmarks",
  resume: "story_resume_reading", reducedMotion: "story_reduced_motion_override",
};
export function readLocal(key: string): string | null {
  try { return typeof window === "undefined" ? null : window.localStorage.getItem(key); } catch { return null; }
}
export function writeLocal(key: string, value: string): void {
  try { if (typeof window !== "undefined" && readLocal(key) !== value) window.localStorage.setItem(key, value); } catch { /* Storage is an optional cache. */ }
}
function readJson(key: string): unknown {
  try { return JSON.parse(readLocal(key) ?? "null"); } catch { return null; }
}
function values<T>(key: string, parse: (input: unknown) => T | null): T[] {
  const raw = readJson(key);
  return Array.isArray(raw) ? raw.map(parse).filter((item): item is T => item !== null) : [];
}
export class LocalStorageSettingsStore implements ISettingsStore {
  getReducedMotionOverride(): boolean | null {
    const raw = readLocal(GUEST_KEYS.reducedMotion);
    return raw === "true" ? true : raw === "false" ? false : null;
  }
  getSettings(): ReaderSettings {
    const parsed = settingsPatchSchema.safeParse(readJson(GUEST_KEYS.settings));
    const settings = mergeSettings(DEFAULT_READER_SETTINGS, parsed.success ? parsed.data : {});
    const os = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    return { ...settings, reduced_motion: this.getReducedMotionOverride() ?? Boolean(os) };
  }
  saveSettings(patch: Partial<ReaderSettings>): ReaderSettings {
    const settings = readerSettingsSchema.parse(mergeSettings(this.getSettings(), settingsPatchSchema.parse(patch)));
    writeLocal(GUEST_KEYS.settings, JSON.stringify(settings));
    if (patch.reduced_motion !== undefined) writeLocal(GUEST_KEYS.reducedMotion, String(patch.reduced_motion));
    return settings;
  }
  getAllProgress(): ReadingProgress[] {
    return values(GUEST_KEYS.progress, (value) => { const result = progressSchema.safeParse(value); return result.success ? result.data : null; });
  }
  getProgress(storyId: string) { return this.getAllProgress().find((item) => item.story_id === storyId) ?? null; }
  saveProgress(progress: ReadingProgress) {
    const valid = progressSchema.parse(progress);
    writeLocal(GUEST_KEYS.progress, JSON.stringify([...this.getAllProgress().filter((item) => item.story_id !== valid.story_id), valid]));
  }
  getBookmarks(): Bookmark[] {
    return values(GUEST_KEYS.bookmarks, (value) => { const result = bookmarkSchema.safeParse(value); return result.success ? result.data : null; });
  }
  isBookmarked(storyId: string) { return this.getBookmarks().some((item) => item.story_id === storyId); }
  toggleBookmark(storyId: string, userId = "guest_user") {
    const saved = !this.isBookmarked(storyId);
    const bookmarks = this.getBookmarks().filter((item) => item.story_id !== storyId);
    if (saved) bookmarks.push(bookmarkSchema.parse({ user_id: userId, story_id: storyId, created_at: new Date().toISOString() }));
    writeLocal(GUEST_KEYS.bookmarks, JSON.stringify(bookmarks));
    return saved;
  }
  getResumeReading(storyId: string): ResumeReading | null {
    const data = readJson(GUEST_KEYS.resume);
    if (!data || typeof data !== "object") return null;
    const raw = (data as Record<string, unknown>)[storyId];
    if (!raw || typeof raw !== "object") return null;
    const value = raw as ResumeReading;
    if (typeof value.chapter_id !== "string" || typeof value.block_id !== "string" || !Number.isFinite(value.progress) || !Number.isFinite(value.updated_at)) return null;
    return value;
  }
  saveResumeReading(storyId: string, resume: ResumeReading) {
    const raw = readJson(GUEST_KEYS.resume);
    const map = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
    writeLocal(GUEST_KEYS.resume, JSON.stringify({ ...map, [storyId]: resume }));
  }
  captureGuest(): { guest: GuestImport; consume: () => void } {
    const captured = Object.values(GUEST_KEYS).map((key) => [key, readLocal(key)] as const);
    const guest: GuestImport = { settings: this.getSettings(), progress: this.getAllProgress(),
      bookmarks: this.getBookmarks().filter((item) => item.user_id === "guest_user").map(({ story_id, created_at }) => ({ story_id, created_at })) };
    return { guest, consume: () => {
      for (const [key, value] of captured) {
        try { if (readLocal(key) === value && typeof window !== "undefined") window.localStorage.removeItem(key); } catch { /* Optional cache. */ }
      }
    } };
  }
}
