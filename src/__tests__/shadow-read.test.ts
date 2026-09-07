import assert from "node:assert/strict";
import type { Story } from "@/types/story";
import type { StoryRepository } from "@/lib/repositories/story-repository";
import {
  ShadowStoryRepository,
  countShadowDifferences,
  normalizeShadowRead,
} from "@/lib/repositories/shadow-read-repository";
import type {
  RepositoryReadEvent,
  RepositoryReadObserver,
} from "@/lib/repositories/read-observability";

const story: Story = {
  id: "public-story",
  title: "Public story",
  author: "Preserved attribution",
  description: "Content must never be logged by shadow reads.",
  genre: ["test"],
  status: "published",
  view_count: 1,
  chapters: [],
};

function repository(overrides: Partial<StoryRepository> = {}): StoryRepository {
  return {
    async getAll() { return [story]; },
    async getAllPublic() { return [story]; },
    async getById() { return story; },
    async getPublicById() { return story; },
    async getPublicChapter() { return null; },
    async getAllForAuthor() { return [story]; },
    async save() {},
    ...overrides,
  };
}

export async function runShadowReadTests() {
  const events: RepositoryReadEvent[] = [];
  const observer: RepositoryReadObserver = { report(event) { events.push(event); } };
  const equalShadow = new ShadowStoryRepository(repository(), repository(), observer);
  assert.deepEqual(await equalShadow.getAllPublic(), [story]);
  assert.equal(events.length, 0);

  const changed = { ...story, title: "Different private content" };
  const mismatchShadow = new ShadowStoryRepository(
    repository(),
    repository({ async getPublicById() { return changed; } }),
    observer,
  );
  assert.equal(await mismatchShadow.getPublicById(story.id), story);
  assert.equal(events.at(-1)?.code, "P3_SHADOW_STORY_GET_PUBLIC_BY_ID_MISMATCH");
  assert.ok((events.at(-1)?.count ?? 0) > 0);
  assert.ok(!JSON.stringify(events).includes(story.description));
  assert.ok(!JSON.stringify(events).includes(changed.title));

  const errorShadow = new ShadowStoryRepository(
    repository(),
    repository({ async getById() { throw new Error("secret row content"); } }),
    observer,
  );
  assert.equal(await errorShadow.getById(story.id), story);
  assert.deepEqual(events.at(-1), {
    level: "error",
    code: "P3_SHADOW_STORY_GET_BY_ID_MISMATCH_ERROR",
    count: 1,
  });

  let unsafeShadowCalls = 0;
  const safeOnly = new ShadowStoryRepository(
    repository(),
    repository({
      async getAllForAuthor() {
        unsafeShadowCalls += 1;
        return [];
      },
    }),
    observer,
  );
  assert.deepEqual(await safeOnly.getAllForAuthor("owner"), [story]);
  assert.equal(unsafeShadowCalls, 0, "Ownership reads must not run against JSON shadow data");

  const legacyDefaults = {
    id: "effect",
    type: "audio",
    category: "audio",
    intensity: 1,
    duration_ms: 100,
    audio_src: "/audio.mp3",
  };
  assert.equal(countShadowDifferences(
    normalizeShadowRead([{ ...legacyDefaults, loop: false }]),
    normalizeShadowRead([legacyDefaults]),
  ), 0);
  assert.equal(countShadowDifferences(
    normalizeShadowRead([{ ...legacyDefaults, id: "b" }, { ...legacyDefaults, id: "a" }]),
    normalizeShadowRead([{ ...legacyDefaults, id: "a" }, { ...legacyDefaults, id: "b" }]),
  ), 0);

  console.log("shadow-read.test.ts: safe comparison, mismatch/error metadata and normalization passed");
}
