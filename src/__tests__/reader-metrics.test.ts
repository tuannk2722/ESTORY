import assert from "node:assert/strict";
import {
  calculateEffectVolume,
  calculateScrollProgress,
  selectActiveReaderBlock,
} from "@/lib/reader/readerMetrics";
import { projectPublicStory } from "@/lib/repositories/json-story-repository";
import type { Story } from "@/types/story";

const viewport = { top: 0, bottom: 1_000, topInset: 80 };

assert.equal(
  selectActiveReaderBlock(
    [
      { id: "long", top: 120, bottom: 900 },
      { id: "short", top: 920, bottom: 980 },
    ],
    viewport,
    null
  ),
  "long",
  "A long block containing the reading anchor should stay active"
);

assert.equal(
  selectActiveReaderBlock(
    [
      { id: "previous", top: 80, bottom: 445 },
      { id: "next", top: 445, bottom: 620 },
    ],
    viewport,
    "previous"
  ),
  "previous",
  "Hysteresis should keep the current block stable around a boundary"
);

assert.equal(
  selectActiveReaderBlock(
    [
      { id: "previous", top: -400, bottom: 360 },
      { id: "next", top: 360, bottom: 620 },
    ],
    viewport,
    "previous"
  ),
  "next",
  "The next block should activate after the anchor clears hysteresis"
);

assert.equal(calculateScrollProgress(500, 2_000, 1_000), 0.5);
assert.equal(calculateScrollProgress(-100, 2_000, 1_000), 0);
assert.equal(calculateScrollProgress(2_000, 2_000, 1_000), 1);
assert.equal(calculateEffectVolume(0.8, 0), 0);
assert.equal(calculateEffectVolume(0.8, 0.5), 0.4);
assert.equal(calculateEffectVolume(2, 2), 1);

const publicProjection = projectPublicStory({
  id: "story",
  title: "Story",
  author: "Author",
  description: "Description",
  genre: [],
  status: "published",
  view_count: 0,
  chapters: [
    { id: "published", title: "Published", order: 1, status: "published", blocks: [] },
    { id: "draft", title: "Draft", order: 2, status: "draft", blocks: [] },
  ],
} satisfies Story);
assert.deepEqual(
  publicProjection?.chapters.map((chapter) => chapter.id),
  ["published"]
);

console.log("reader-metrics.test.ts: 10 assertions passed");
