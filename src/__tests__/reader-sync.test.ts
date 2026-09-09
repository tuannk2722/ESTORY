import assert from "node:assert/strict";
import { LocalStorageSettingsStore, GUEST_KEYS } from "@/lib/reader-state/local-store";
import { SyncedSettingsStore, accountCacheKey } from "@/lib/reader-state/sync-store";
import { ReaderSyncError, type ReaderStateTransport } from "@/lib/reader-state/transport";
import { DEFAULT_READER_SETTINGS } from "@/lib/reader-state/settings";
import { bootstrapSchema, mutationSchema, type ReaderState } from "@/lib/reader-state/schema";

const timestamp = "2026-09-09T00:00:00.000Z";
const progress = { story_id: "story", chapter_id: "chapter", block_id: "block", status: "reading" as const, updated_at: timestamp };
function state(userId: string): ReaderState { return { userId, settings: { ...DEFAULT_READER_SETTINGS }, progress: [], bookmarks: [], updatedAt: timestamp }; }
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}
async function settled(store: SyncedSettingsStore) {
  for (let attempt = 0; attempt < 30 && store.getStatus().syncing; attempt++) await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(store.getStatus().syncing, false);
}

export async function runReaderSyncTests() {
  const original = Object.getOwnPropertyDescriptor(globalThis, "window");
  const storage = new Map<string, string>();
  let reduce = true;
  Object.defineProperty(globalThis, "window", { configurable: true, value: {
    localStorage: { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value), removeItem: (key: string) => storage.delete(key) },
    matchMedia: () => ({ matches: reduce }), dispatchEvent: () => {},
  } });
  try {
    const local = new LocalStorageSettingsStore();
    assert.equal(local.getSettings().reduced_motion, true);
    local.saveSettings({ theme: "sepia" });
    assert.equal(local.getSettings().reduced_motion, true, "Unrelated settings preserve the OS preference");
    local.saveSettings({ reduced_motion: false });
    assert.equal(local.getSettings().reduced_motion, false);
    storage.set(GUEST_KEYS.progress, '{"invalid":"shape"}');
    storage.set(GUEST_KEYS.bookmarks, "broken JSON");
    assert.deepEqual(local.getAllProgress(), []);
    assert.deepEqual(local.getBookmarks(), []);
    local.saveProgress(progress); local.toggleBookmark("story");
    const captured = local.captureGuest();
    local.saveSettings({ theme: "light" }); captured.consume();
    assert.equal(local.getSettings().theme, "light", "Consuming an import cannot delete newer guest edits");
    local.saveProgress(progress); local.toggleBookmark("story");

    const accounts = new Map<string, ReaderState>();
    let imports = 0, mutations = 0;
    const transport: ReaderStateTransport = {
      async read(id) { return structuredClone(accounts.get(id) ?? null); },
      async bootstrap(id, guest) {
        imports++;
        const value = { ...state(id), settings: guest.settings, progress: guest.progress, bookmarks: guest.bookmarks.map((item) => ({ ...item, user_id: id })) };
        accounts.set(id, value); return structuredClone(value);
      },
      async mutate(input) {
        mutations++;
        const value = accounts.get(input.expectedUserId)!;
        if (value.updatedAt !== input.expectedUpdatedAt) throw new ReaderSyncError(409, "STALE_UPDATE");
        if (input.operation.kind === "bookmark") {
          value.bookmarks = input.operation.saved ? [{ user_id: value.userId, story_id: input.operation.storyId, created_at: timestamp }] : [];
        }
        value.updatedAt = new Date(Date.parse(value.updatedAt) + 1).toISOString();
        return structuredClone(value);
      },
    };
    const store = new SyncedSettingsStore(local, transport);
    let notifications = 0;
    const unsubscribe = store.subscribe(() => notifications++);
    await store.connect("A");
    assert.equal(imports, 1); assert.equal(store.isBookmarked("story"), true);
    const settingsIdentity = store.getSettings();
    assert.equal(local.getAllProgress().length, 0, "Guest import is consumed, never reused by another account");
    store.toggleBookmark("story"); await settled(store);
    assert.equal(store.getSettings(), settingsIdentity, "Bookmark/progress responses must not restart Reader effect timers through changed settings references");
    assert.equal(store.isBookmarked("story"), false);
    assert.equal(store.getAllProgress().length, 1, "Unbookmark cannot delete progress");
    await store.connect(null);
    assert.deepEqual(store.getBookmarks(), []); assert.deepEqual(store.getAllProgress(), []);
    const guestIdentity = store.getSettings();
    store.saveProgress(progress);
    assert.equal(store.getSettings(), guestIdentity, "Guest progress notifications also preserve settings identity");
    store.saveSettings({ theme: "light" });
    assert.equal(store.getSettings().effects_by_category, guestIdentity.effects_by_category, "Theme changes cannot restart category effect timers");
    local.captureGuest().consume();
    await store.connect("B"); assert.deepEqual(store.getBookmarks(), []); assert.deepEqual(store.getAllProgress(), []);
    await store.connect(null);
    local.toggleBookmark("story"); local.saveProgress(progress);
    accounts.set("A", { ...state("A"), updatedAt: "2026-09-09T00:00:01.000Z" });
    storage.set(accountCacheKey("A"), JSON.stringify({ ...state("A"), bookmarks: [{ user_id: "A", story_id: "old", created_at: timestamp }], progress: [progress] }));
    await store.connect("A");
    assert.equal(imports, 2, "Existing accounts never re-import, even when all DB lists are empty");
    assert.deepEqual(store.getBookmarks(), []); assert.deepEqual(store.getAllProgress(), []);

    // A second tab writes after this tab's bootstrap: reject stale intent, refresh, no replay.
    accounts.get("A")!.updatedAt = "2026-09-09T00:00:02.000Z";
    const before = mutations;
    store.toggleBookmark("story"); await settled(store);
    assert.equal(mutations, before + 1); assert.equal(store.isBookmarked("story"), false);
    assert.match(store.getStatus().error!, /tab hoặc thiết bị/);
    assert.ok(notifications > 4); unsubscribe();

    const delayed = deferred<ReaderState>();
    const racing = new SyncedSettingsStore(local, { ...transport, read: async (id) => id === "A" ? delayed.promise : state(id) });
    const connecting = racing.connect("A");
    await racing.connect("B"); delayed.resolve({ ...state("A"), progress: [progress] }); await connecting;
    assert.equal(racing.getStatus().userId, "B"); assert.deepEqual(racing.getAllProgress(), []);

    const mutation = deferred<ReaderState>();
    const queued = new SyncedSettingsStore(local, { ...transport, read: async (id) => state(id), mutate: () => mutation.promise });
    await queued.connect("A"); queued.toggleBookmark("secret");
    await queued.connect("B"); mutation.resolve({ ...state("A"), bookmarks: [{ user_id: "A", story_id: "secret", created_at: timestamp }] });
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(queued.getStatus().userId, "B"); assert.deepEqual(queued.getBookmarks(), []);

    const unavailable = new SyncedSettingsStore(local, { ...transport, read: async () => { throw new Error("offline"); } });
    await unavailable.connect("A");
    assert.equal(unavailable.getStatus().canWrite, false); assert.ok(unavailable.getStatus().error);
    const concurrent = new SyncedSettingsStore(local, { ...transport,
      read: async () => { return accounts.has("C") ? state("C") : null; },
      bootstrap: async () => { accounts.set("C", state("C")); throw new ReaderSyncError(409, "CONTENT_CONFLICT"); },
    });
    await concurrent.connect("C"); assert.equal(concurrent.getStatus().canWrite, true);
    const firstSave = deferred<ReaderState>();
    const writes: number[] = [];
    const rapid = new SyncedSettingsStore(local, { ...transport, read: async (id) => state(id), mutate: async (input) => {
      if (input.operation.kind !== "settings") throw new Error("Unexpected fixture operation");
      writes.push(input.operation.patch.intensity_multiplier!);
      if (writes.length === 1) return firstSave.promise;
      return { ...state("A"), settings: { ...DEFAULT_READER_SETTINGS, intensity_multiplier: input.operation.patch.intensity_multiplier! }, updatedAt: "2026-09-09T00:00:00.002Z" };
    } });
    await rapid.connect("A");
    for (let index = 1; index <= 100; index++) rapid.saveSettings({ intensity_multiplier: index / 100 });
    assert.equal(rapid.getSettings().intensity_multiplier, 1, "Slider changes apply immediately while the network is slow");
    firstSave.resolve({ ...state("A"), settings: { ...DEFAULT_READER_SETTINGS, intensity_multiplier: .01 }, updatedAt: "2026-09-09T00:00:00.001Z" });
    await settled(rapid);
    assert.deepEqual(writes, [.01, 1], "Rapid queued edits retain the latest intent without a request per slider event");
    reduce = false;
    await store.connect(null); assert.equal(store.getSettings().reduced_motion, false);
    assert.equal(bootstrapSchema.safeParse({ expectedUserId: "A", guest: { ...local.captureGuest().guest, actorId: "B" } }).success, false);
    assert.equal(mutationSchema.safeParse({ expectedUserId: "A", expectedUpdatedAt: timestamp, operation: { kind: "settings", patch: { intensity_multiplier: 2 } } }).success, false);
  } finally {
    if (original) Object.defineProperty(globalThis, "window", original); else Reflect.deleteProperty(globalThis, "window");
  }
  console.log("Reader sync lifecycle, account isolation, stale cache and concurrency tests passed");
}
