import assert from "node:assert/strict";
import { loadEnvConfig } from "@next/env";
import { ReaderStateService } from "@/lib/services/reader-state-service";
import { DEFAULT_READER_SETTINGS } from "@/lib/reader-state/settings";
import type { GuestImport, ReaderOperation, ReaderState } from "@/lib/reader-state/schema";
import { createReaderSyncFixture } from "./fixtures/reader-sync-fixtures";

loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production");
let stage = "connect";
async function run() {
  const { prisma } = await import("@/lib/db/prisma");
  const service = new ReaderStateService(async () => prisma);
  let fixture: Awaited<ReturnType<typeof createReaderSyncFixture>> | undefined;
  try {
    fixture = await createReaderSyncFixture(prisma);
    const f = fixture, user = f.users[0];
    const guest: GuestImport = {
      settings: { ...DEFAULT_READER_SETTINGS, reduced_motion: true, theme: "sepia" },
      progress: [{ story_id: f.slug(), chapter_id: f.chapter(), block_id: f.block(), status: "reading", updated_at: "2026-09-08T01:00:00.000Z" }],
      bookmarks: [{ story_id: f.slug(), created_at: "2026-09-08T01:00:00.000Z" }],
    };
    const mutate = (snapshot: ReaderState, operation: ReaderOperation) => service.mutate(snapshot.userId, { expectedUserId: snapshot.userId, expectedUpdatedAt: snapshot.updatedAt, operation });
    stage = "first login atomic import / client preference";
    assert.equal(await service.read(user), null);
    let snapshot = await service.bootstrap(user, guest);
    assert.equal(snapshot.settings.reduced_motion, true); assert.equal(snapshot.settings.font_size, "lg");
    assert.equal(snapshot.settings.intensity_multiplier, .8);
    assert.equal(snapshot.bookmarks[0].user_id, user); assert.equal(snapshot.bookmarks[0].story_id, f.slug());
    assert.equal(snapshot.progress[0].story_id, f.slug(), "Never expose internal Story PKs");
    stage = "second device and independent lists";
    snapshot = await mutate(snapshot, { kind: "bookmark", storyId: f.slug(), saved: false });
    assert.equal(snapshot.progress.length, 1); assert.equal(snapshot.bookmarks.length, 0);
    snapshot = await service.bootstrap(user, { ...guest, settings: DEFAULT_READER_SETTINGS });
    assert.equal(snapshot.bookmarks.length, 0); assert.equal(snapshot.settings.reduced_motion, true);
    await prisma.readingProgress.deleteMany({ where: { userId: user } });
    snapshot = await service.bootstrap(user, guest);
    assert.deepEqual(snapshot.progress, [], "An empty DB list remains authoritative after initialization");
    assert.equal((await service.bootstrap(f.users[1], { ...guest, progress: [], bookmarks: [] })).progress.length, 0);
    stage = "multi-tab compare and swap";
    const race = await Promise.allSettled([
      mutate(snapshot, { kind: "settings", patch: { theme: "light" } }),
      mutate(snapshot, { kind: "bookmark", storyId: f.slug(), saved: true }),
    ]);
    assert.equal(race.filter((result) => result.status === "fulfilled").length, 1);
    const rejected = race.find((result) => result.status === "rejected") as PromiseRejectedResult;
    assert.equal(rejected.reason.status, 409);
    snapshot = (await service.read(user))!;
    stage = "membership / invalid mutation rollback";
    await assert.rejects(mutate(snapshot, { kind: "progress", progress: { story_id: f.slug(), chapter_id: f.chapter(1), block_id: f.block(1), status: "completed" } }), { status: 404 });
    assert.equal((await service.read(user))!.updatedAt, snapshot.updatedAt, "Failed mutation rolls revision back");
    snapshot = await mutate(snapshot, { kind: "progress", progress: { story_id: f.slug(), chapter_id: f.chapter(), block_id: f.block(), status: "completed" } });
    assert.equal(snapshot.progress[0].status, "reading", "Only the last block of the last public chapter completes a story");
    snapshot = await mutate(snapshot, { kind: "progress", progress: { story_id: f.slug(), chapter_id: f.chapter(0, 1), block_id: f.block(0, 1, 4), status: "completed" } });
    assert.equal(snapshot.progress[0].status, "completed");
    stage = "stale block repair / chapter clear / bookmark independence";
    await prisma.storyBlock.delete({ where: { id: f.block(0, 1, 4) } });
    snapshot = (await service.read(user))!;
    assert.equal(snapshot.progress[0].block_id, f.block(0, 1, 0)); assert.equal(snapshot.progress[0].status, "reading");
    snapshot = await mutate(snapshot, { kind: "bookmark", storyId: f.slug(), saved: true });
    await prisma.chapter.update({ where: { id: f.chapter(0, 1) }, data: { status: "DRAFT" } });
    snapshot = (await service.read(user))!;
    assert.equal(snapshot.progress.length, 0); assert.equal(snapshot.bookmarks.length, 1);
    await prisma.story.update({ where: { id: f.stories[0] }, data: { status: "DRAFT" } });
    snapshot = (await service.read(user))!;
    assert.equal(snapshot.bookmarks.length, 0);
    assert.equal(await prisma.bookmark.count({ where: { userId: user } }), 1, "Unavailable content does not erase an independent bookmark");
    await assert.rejects(mutate(snapshot, { kind: "bookmark", storyId: f.slug(), saved: true }), { status: 404 });
    snapshot = await mutate(snapshot, { kind: "bookmark", storyId: f.slug(), saved: false });
    assert.equal(await prisma.bookmark.count({ where: { userId: user } }), 0);
    stage = "first login race / one coherent winner";
    const attempts = await Promise.allSettled([
      service.bootstrap(f.users[2], { ...guest, settings: { ...guest.settings, theme: "light" }, bookmarks: [] }),
      service.bootstrap(f.users[2], { ...guest, settings: { ...guest.settings, theme: "dark" }, bookmarks: [{ story_id: f.slug(1), created_at: guest.bookmarks[0].created_at }] }),
    ]);
    assert.ok(attempts.some((attempt) => attempt.status === "fulfilled"));
    const winner = (await service.read(f.users[2]))!;
    assert.equal(winner.bookmarks.length, winner.settings.theme === "light" ? 0 : 1);
    assert.equal(await prisma.userSettings.count({ where: { userId: f.users[2] } }), 1);
    stage = "failed bootstrap rolls back marker and all imported rows";
    await prisma.story.update({ where: { id: f.stories[0] }, data: { status: "PUBLISHED" } });
    // Inject a persistence failure after settings and bookmark writes in the real transaction.
    const faultyClient = new Proxy(prisma, { get(target, property) {
      if (property === "$transaction") return (work: Parameters<Parameters<typeof prisma.$transaction>[0]>[0], options: unknown) =>
        Reflect.apply(target.$transaction, target, [async (tx: import("@/generated/prisma/client").Prisma.TransactionClient) => {
          const faultyTx = new Proxy(tx, { get(inner, key) {
            if (key === "readingProgress") return new Proxy(inner.readingProgress, { get(delegate, method) {
              if (method === "createMany") return () => { throw new Error("INJECTED_SYNC_FAILURE"); };
              return Reflect.get(delegate, method);
            } });
            return Reflect.get(inner, key);
          } });
          return (work as unknown as (client: typeof tx) => Promise<unknown>)(faultyTx);
        }, options]);
      return Reflect.get(target, property);
    } });
    await assert.rejects(new ReaderStateService(async () => faultyClient).bootstrap(f.users[3], guest), /INJECTED_SYNC_FAILURE/);
    assert.equal(await prisma.userSettings.count({ where: { userId: f.users[3] } }), 0);
    assert.equal(await prisma.bookmark.count({ where: { userId: f.users[3] } }), 0);
    assert.equal(await prisma.readingProgress.count({ where: { userId: f.users[3] } }), 0);
    console.log("P3-08 DB: first-login/import, isolation, race, atomicity and stale content passed");
  } finally { await fixture?.cleanup(); await prisma.$disconnect(); }
}
run().catch(() => { console.error(`P3-08 DB failed at: ${stage}`); process.exitCode = 1; });
