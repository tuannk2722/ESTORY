import type { ReaderSettings, ReadingProgress, ResumeReading } from "@/types/settings";
import { LocalStorageSettingsStore, readLocal, writeLocal, type ISettingsStore } from "./local-store";
import { readerStateSchema, operationSchema, type ReaderOperation, type ReaderState } from "./schema";
import { DEFAULT_READER_SETTINGS, mergeSettings } from "./settings";
import { ReaderSyncError, readerStateTransport, type ReaderStateTransport } from "./transport";

export interface SyncStatus {
  version: number; scope: number; userId: string | null | undefined;
  ready: boolean; canWrite: boolean; syncing: boolean; error: string | null;
}
export const INITIAL_SYNC_STATUS: SyncStatus = { version: 0, scope: 0, userId: undefined, ready: false, canWrite: false, syncing: false, error: null };
export const accountCacheKey = (userId: string) => `story_reader_account_v1:${userId}`;

export class SyncedSettingsStore implements ISettingsStore {
  private status: SyncStatus = INITIAL_SYNC_STATUS;
  private listeners = new Set<() => void>();
  private state: ReaderState | null = null;
  private pending: ReaderOperation[] = [];
  private abort = new AbortController();
  private busy = false;
  private refreshWanted = false;
  private settingsSnapshot = DEFAULT_READER_SETTINGS;
  constructor(private readonly local = new LocalStorageSettingsStore(), private readonly transport: ReaderStateTransport = readerStateTransport) {}
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  getStatus = () => this.status;
  private emit(change: Partial<SyncStatus> = {}) {
    this.status = { ...this.status, ...change, version: this.status.version + 1 };
    for (const listener of this.listeners) listener();
  }
  notifyGuest = () => { if (this.status.userId === null) this.emit(); };
  private accept(state: ReaderState) {
    const parsed = readerStateSchema.parse(state);
    if (parsed.userId !== this.status.userId) throw new ReaderSyncError(409, "ACCOUNT_CHANGED");
    this.state = parsed;
    writeLocal(accountCacheKey(parsed.userId), JSON.stringify(parsed));
  }
  async connect(userId: string | null | undefined): Promise<void> {
    if (this.status.userId === userId && this.status.scope > 0) return;
    this.abort.abort(); this.abort = new AbortController();
    this.state = null; this.pending = []; this.busy = false; this.refreshWanted = false;
    this.emit({ userId, scope: this.status.scope + 1, ready: userId === null, canWrite: userId === null, syncing: false, error: null });
    if (!userId) return;
    try {
      const cached = readerStateSchema.safeParse(JSON.parse(readLocal(accountCacheKey(userId)) ?? "null"));
      if (cached.success && cached.data.userId === userId) this.state = cached.data;
    } catch { /* Ignore invalid caches. */ }
    await this.refresh();
  }
  async refresh(): Promise<void> {
    const userId = this.status.userId;
    if (!userId) { this.notifyGuest(); return; }
    if (this.busy) { this.refreshWanted = true; return; }
    const scope = this.status.scope, signal = this.abort.signal;
    const captured = this.local.captureGuest();
    this.busy = true;
    this.emit({ syncing: true });
    try {
      let data = await this.transport.read(userId, signal);
      if (!data) {
        try { data = await this.transport.bootstrap(userId, captured.guest, signal); }
        catch (error) {
          // Another tab may have initialized this account first. Never replay the import.
          if (!(error instanceof ReaderSyncError) || error.status !== 409 || error.code === "ACCOUNT_CHANGED") throw error;
          data = await this.transport.read(userId, signal);
          if (!data) throw error;
        }
      }
      if (this.status.scope !== scope) return;
      this.accept(data); captured.consume();
      this.emit({ ready: true, canWrite: true, error: null });
    } catch (error) {
      if (this.status.scope !== scope) return;
      this.handleFailure(error);
    } finally {
      if (this.status.scope === scope) { this.busy = false; this.emit({ syncing: false }); this.continueWork(); }
    }
  }
  private handleFailure(error: unknown) {
    if (error instanceof ReaderSyncError && (error.status === 401 || error.code === "ACCOUNT_CHANGED")) {
      this.state = null; this.pending = [];
      this.emit({ ready: false, canWrite: false, error: "Phiên đăng nhập đã thay đổi. Vui lòng tải lại phiên để đồng bộ." });
      if (typeof window !== "undefined") window.dispatchEvent(new Event("reader-session-changed"));
    } else {
      this.emit({ ready: Boolean(this.state), canWrite: false, error: "Chưa đồng bộ được dữ liệu. Kiểm tra kết nối rồi thử lại." });
    }
  }
  private continueWork() {
    if (this.pending.length && this.status.canWrite) void this.drain();
    else if (this.refreshWanted) { this.refreshWanted = false; void this.refresh(); }
  }
  private enqueue(operation: ReaderOperation) {
    if (!this.status.canWrite) return;
    const next = operationSchema.parse(operation);
    const lastIndex = this.pending.length - 1;
    const last = this.pending[lastIndex];
    // Leave the in-flight operation intact; collapse rapid slider/scroll updates
    // still waiting behind it so a drag cannot queue hundreds of DB round-trips.
    if (lastIndex > 0 && last.kind === "settings" && next.kind === "settings") {
      this.pending[lastIndex] = { kind: "settings", patch: { ...last.patch, ...next.patch,
        ...((last.patch.effects_by_category || next.patch.effects_by_category) ? {
          effects_by_category: { ...last.patch.effects_by_category, ...next.patch.effects_by_category },
        } : {}),
      } };
    } else if (lastIndex > 0 && last.kind === "progress" && next.kind === "progress" && last.progress.story_id === next.progress.story_id) {
      this.pending[lastIndex] = next;
    } else this.pending.push(next);
    this.emit();
    if (!this.busy) void this.drain();
  }
  private async drain() {
    if (this.busy || !this.state || !this.status.userId) return;
    const scope = this.status.scope, signal = this.abort.signal, userId = this.status.userId;
    this.busy = true; this.emit({ syncing: true });
    try {
      while (this.pending.length && this.state && scope === this.status.scope) {
        const operation = this.pending[0];
        const data = await this.transport.mutate({ expectedUserId: userId, expectedUpdatedAt: this.state.updatedAt, operation }, signal);
        if (scope !== this.status.scope) return;
        this.pending.shift(); this.accept(data); this.emit({ error: null });
      }
    } catch (error) {
      if (scope !== this.status.scope) return;
      this.pending = [];
      if (error instanceof ReaderSyncError && error.status === 409 && error.code !== "ACCOUNT_CHANGED") {
        try {
          const data = await this.transport.read(userId, signal);
          if (scope !== this.status.scope) return;
          if (!data) throw error;
          this.accept(data);
          this.emit({ error: "Dữ liệu đã thay đổi ở tab hoặc thiết bị khác. Đã tải bản mới; hãy thực hiện lại thay đổi nếu cần." });
        } catch (readError) { if (scope === this.status.scope) this.handleFailure(readError); }
      } else this.handleFailure(error);
    } finally {
      if (scope === this.status.scope) { this.busy = false; this.emit({ syncing: false }); this.continueWork(); }
    }
  }
  private view(): ReaderState | null {
    if (!this.state) return null;
    let result = this.state;
    for (const operation of this.pending) {
      if (operation.kind === "settings") result = { ...result, settings: mergeSettings(result.settings, operation.patch) };
      if (operation.kind === "progress") result = { ...result, progress: [...result.progress.filter((item) => item.story_id !== operation.progress.story_id), { ...operation.progress, updated_at: new Date().toISOString() }] };
      if (operation.kind === "bookmark") result = { ...result, bookmarks: [...result.bookmarks.filter((item) => item.story_id !== operation.storyId), ...(operation.saved ? [{ user_id: result.userId, story_id: operation.storyId, created_at: new Date().toISOString() }] : [])] };
    }
    return result;
  }
  getSettings(): ReaderSettings {
    const next = this.status.userId === null ? this.local.getSettings() : this.view()?.settings ?? DEFAULT_READER_SETTINGS;
    if (JSON.stringify(next) !== JSON.stringify(this.settingsSnapshot)) {
      const sameCategories = (Object.keys(next.effects_by_category) as Array<keyof ReaderSettings["effects_by_category"]>)
        .every((key) => next.effects_by_category[key] === this.settingsSnapshot.effects_by_category[key]);
      this.settingsSnapshot = { ...next, effects_by_category: sameCategories ? this.settingsSnapshot.effects_by_category : next.effects_by_category };
    }
    // Stable references prevent progress/cache notifications from restarting the
    // Reader's memoized effect timers and audio lifecycle.
    return this.settingsSnapshot;
  }
  getReducedMotionOverride() { return this.status.userId === null ? this.local.getReducedMotionOverride() : this.getSettings().reduced_motion; }
  saveSettings(settings: Partial<ReaderSettings>) {
    if (this.status.canWrite) {
      if (this.status.userId === null) { this.local.saveSettings(settings); this.emit(); }
      else this.enqueue({ kind: "settings", patch: settings });
    }
    return this.getSettings();
  }
  getAllProgress() { return this.status.userId === null ? this.local.getAllProgress() : this.view()?.progress ?? []; }
  getProgress(storyId: string) { return this.getAllProgress().find((item) => item.story_id === storyId) ?? null; }
  saveProgress(progress: ReadingProgress) {
    if (!this.status.canWrite) return;
    if (this.status.userId === null) { this.local.saveProgress(progress); this.emit(); }
    else {
      const { story_id, chapter_id, block_id, status } = progress;
      this.enqueue({ kind: "progress", progress: { story_id, chapter_id, block_id, status } });
    }
  }
  getBookmarks() { return this.status.userId === null ? this.local.getBookmarks() : this.view()?.bookmarks ?? []; }
  isBookmarked(storyId: string) { return this.getBookmarks().some((item) => item.story_id === storyId); }
  toggleBookmark(storyId: string) {
    if (!this.status.canWrite) return this.isBookmarked(storyId);
    if (this.status.userId === null) { const saved = this.local.toggleBookmark(storyId); this.emit(); return saved; }
    const saved = !this.isBookmarked(storyId); this.enqueue({ kind: "bookmark", storyId, saved }); return saved;
  }
  getResumeReading(storyId: string): ResumeReading | null {
    if (this.status.userId === null) return this.local.getResumeReading(storyId);
    const progress = this.getProgress(storyId);
    return progress ? { chapter_id: progress.chapter_id, block_id: progress.block_id, progress: 0, updated_at: Date.parse(progress.updated_at) } : null;
  }
  saveResumeReading(storyId: string, resume: ResumeReading) {
    if (this.status.canWrite && this.status.userId === null) { this.local.saveResumeReading(storyId, resume); this.emit(); }
  }
  isResumeDismissed(storyId: string): boolean {
    try { return typeof window !== "undefined" && window.sessionStorage.getItem(`resume_dismissed_v1:${this.status.userId ?? "guest"}:${storyId}`) === "true"; }
    catch { return false; }
  }
  dismissResume(storyId: string): void {
    try { if (typeof window !== "undefined") window.sessionStorage.setItem(`resume_dismissed_v1:${this.status.userId ?? "guest"}:${storyId}`, "true"); }
    catch { /* Optional per-tab preference. */ }
    this.emit();
  }
}
