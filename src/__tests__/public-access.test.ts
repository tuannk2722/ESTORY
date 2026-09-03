import assert from "node:assert/strict";
import { resolvePublicReadingTarget } from "@/lib/reader/publicReadingTarget";
import { projectPublicStory } from "@/lib/repositories/json-story-repository";
import type { Chapter, Story } from "@/types/story";

const publicChapters: Chapter[] = [
  {
    id: "public-chapter",
    title: "Public",
    order: 1,
    status: "published",
    blocks: [{ id: "block-1", type: "paragraph", text: "Text", effects: [] }],
  },
];

assert.deepEqual(
  resolvePublicReadingTarget(publicChapters, {
    chapterId: "public-chapter",
    blockId: "block-1",
  }),
  { chapterId: "public-chapter", blockId: "block-1" },
  "A public chapter and existing block should remain resumable"
);

assert.deepEqual(
  resolvePublicReadingTarget(
    publicChapters,
    { chapterId: "unpublished-chapter", blockId: "draft-block" },
    { chapterId: "public-chapter", blockId: "block-1" }
  ),
  { chapterId: "public-chapter", blockId: "block-1" },
  "An unpublished resume chapter should fall back to another public progress location"
);

assert.deepEqual(
  resolvePublicReadingTarget(publicChapters, {
    chapterId: "public-chapter",
    blockId: "deleted-block",
  }),
  { chapterId: "public-chapter", blockId: null },
  "A deleted block should resume at the top of its still-public chapter"
);

assert.equal(
  resolvePublicReadingTarget(publicChapters, {
    chapterId: "unpublished-chapter",
    blockId: "draft-block",
  }),
  null,
  "An unpublished chapter must never produce a public resume target"
);

const storyWithoutStatus = {
  id: "missing-story-status",
  title: "Invalid",
  author: "Author",
  description: "Description",
  genre: [],
  view_count: 0,
  chapters: publicChapters,
} as unknown as Story;

assert.equal(
  projectPublicStory(storyWithoutStatus),
  null,
  "A story missing its required status must fail closed"
);

assert.equal(
  projectPublicStory({
    id: "missing-chapters",
    title: "Invalid",
    author: "Author",
    description: "Description",
    genre: [],
    status: "published",
    view_count: 0,
  } as unknown as Story),
  null,
  "A published story with a malformed chapter collection must fail closed"
);

const chapterWithoutStatus = {
  id: "missing-chapter-status",
  title: "Invalid chapter",
  order: 2,
  blocks: [],
} as unknown as Chapter;

const projectionWithMalformedChapter = projectPublicStory({
  id: "public-story",
  title: "Story",
  author: "Author",
  description: "Description",
  genre: [],
  status: "published",
  view_count: 0,
  chapters: [...publicChapters, chapterWithoutStatus],
});

assert.deepEqual(
  projectionWithMalformedChapter?.chapters.map((chapter) => chapter.id),
  ["public-chapter"],
  "A chapter missing its required status must be excluded from public data"
);

const fullEditorStory: Story = {
  id: "editor-story",
  title: "Editor story",
  author: "Author",
  description: "Description",
  genre: [],
  status: "published",
  view_count: 0,
  chapters: [
    ...publicChapters,
    { id: "draft", title: "Draft", order: 2, status: "draft", blocks: [] },
  ],
};
projectPublicStory(fullEditorStory);
assert.deepEqual(
  fullEditorStory.chapters.map((chapter) => chapter.id),
  ["public-chapter", "draft"],
  "Creating a public projection must not mutate the full Story used by editor flows"
);

console.log("public-access.test.ts: 8 assertions passed");
