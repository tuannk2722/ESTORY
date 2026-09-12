import assert from "node:assert/strict";
import {
  AuthorRequestError,
  commandRequest,
  friendlyRequestMessage,
} from "@/components/author/authorTransport";
import {
  isStoryMutable,
  submitReadiness,
  validateStoryForm,
  validateWizardChapters,
} from "@/components/author/storyRules";
import {
  buildStoryCardPreviewStory,
  STORY_CARD_PREVIEW_PLACEHOLDERS,
} from "@/components/author/storyPreview";
import { moveListItem, resolveListDropIndex } from "@/hooks/useListReorder";
import {
  coverObjectPosition,
  coverPositionForViewportPoint,
  normalizeCoverPosition,
  sameCoverPosition,
} from "@/lib/story-cover";
import type { Story } from "@/types/story";
import type { ManagedStory } from "@/types/story-management";

export async function runP310AuthorClientTests() {
  const completeForm = {
    title: "Chuyện kể P3-10",
    byline: "Người kể",
    description: "Một mô tả đủ thông tin.",
    genre: ["Kỳ ảo"],
    coverFile: new File(["cover"], "cover.png", { type: "image/png" }),
    coverPreviewUrl: "blob:p3-10-cover",
    coverPosition: { x: 50, y: 50 },
    coverError: null,
  };

  assert.deepEqual(validateStoryForm(completeForm, { requireByline: true, hasExistingCover: false }), {});
  assert.deepEqual(Object.keys(validateStoryForm({
    ...completeForm,
    title: " ",
    byline: "",
    description: "",
    genre: [],
    coverFile: null,
  }, { requireByline: true, hasExistingCover: false })).sort(), ["byline", "cover", "description", "genre", "title"]);
  assert.deepEqual(validateStoryForm({ ...completeForm, coverFile: null }, {
    requireByline: false,
    hasExistingCover: true,
  }), {});
  assert.equal(validateStoryForm({ ...completeForm, coverError: "Ảnh quá lớn." }, {
    requireByline: true,
    hasExistingCover: true,
  }).cover, "Ảnh quá lớn.");

  assert.deepEqual(buildStoryCardPreviewStory(completeForm, "https://media.example.test/persisted.webp"), {
    title: completeForm.title,
    author: completeForm.byline,
    description: completeForm.description,
    genre: completeForm.genre,
    cover_image: completeForm.coverPreviewUrl,
    cover_position: completeForm.coverPosition,
  });
  assert.deepEqual(buildStoryCardPreviewStory({
    ...completeForm,
    title: " ",
    byline: " ",
    description: " ",
    genre: [],
    coverPreviewUrl: null,
    coverPosition: { x: -10, y: 120 },
  }, "https://media.example.test/persisted.webp"), {
    title: STORY_CARD_PREVIEW_PLACEHOLDERS.title,
    author: STORY_CARD_PREVIEW_PLACEHOLDERS.author,
    description: STORY_CARD_PREVIEW_PLACEHOLDERS.description,
    genre: [],
    cover_image: "https://media.example.test/persisted.webp",
    cover_position: { x: 0, y: 100 },
  });

  assert.deepEqual(validateWizardChapters([{ clientId: "one", title: "Chương 1" }]), {});
  assert.deepEqual(validateWizardChapters([]), { chapters: "Mỗi truyện cần ít nhất một chương." });
  assert.deepEqual(validateWizardChapters([{ clientId: "one", title: " " }]), {
    one: "Vui lòng nhập tên chương.",
  });

  assert.deepEqual(normalizeCoverPosition(), { x: 50, y: 50 });
  assert.deepEqual(normalizeCoverPosition({ x: -5, y: 125 }), { x: 0, y: 100 });
  assert.equal(coverObjectPosition({ x: 25, y: 80 }), "25% 80%");
  assert.equal(sameCoverPosition(undefined, { x: 50, y: 50 }), true);
  assert.deepEqual(coverPositionForViewportPoint(
    { x: 50, y: 50 },
    { x: 200, y: 50 },
    { width: 200, height: 100 },
    { x: 100, y: 0 },
  ), { x: 100, y: 50 });
  assert.deepEqual(coverPositionForViewportPoint(
    { x: 50, y: 50 },
    { x: 100, y: 0 },
    { width: 200, height: 100 },
    { x: 0, y: 200 },
  ), { x: 50, y: 25 });
  assert.deepEqual(coverPositionForViewportPoint(
    { x: 30, y: 70 },
    { x: 0, y: 0 },
    { width: 200, height: 100 },
    { x: 0, y: 0 },
  ), { x: 30, y: 70 });
  const chapterOrder = ["one", "two", "three"];
  assert.deepEqual(moveListItem(chapterOrder, 2, 1), ["one", "three", "two"]);
  assert.equal(moveListItem(chapterOrder, 1, 1), chapterOrder, "A no-op reorder should preserve identity");
  const dragOrder = ["one", "two", "three", "four", "five"];
  for (let fromIndex = 0; fromIndex < dragOrder.length; fromIndex += 1) {
    for (let destination = 0; destination < dragOrder.length; destination += 1) {
      if (destination === fromIndex) continue;
      const target = destination < fromIndex
        ? { index: destination, position: "before" as const }
        : { index: destination, position: "after" as const };
      assert.equal(
        resolveListDropIndex(fromIndex, target, dragOrder.length),
        destination,
        `Drag ${fromIndex} to ${destination} must resolve identically for first, middle and last items`,
      );
      const reordered = moveListItem(dragOrder, fromIndex, destination);
      assert.equal(reordered[destination], dragOrder[fromIndex]);
      assert.deepEqual([...reordered].sort(), [...dragOrder].sort());
    }
  }
  assert.equal(resolveListDropIndex(1, { index: 0, position: "after" }, dragOrder.length), null);
  assert.equal(resolveListDropIndex(1, { index: 2, position: "before" }, dragOrder.length), null);
  assert.equal(resolveListDropIndex(-1, { index: 0, position: "before" }, dragOrder.length), null);

  const readyStory: Story = {
    id: "p3-10",
    title: completeForm.title,
    author: completeForm.byline,
    description: completeForm.description,
    cover_image: "https://media.example.test/cover.webp",
    genre: completeForm.genre,
    status: "draft",
    view_count: 0,
    chapters: [{
      id: "chapter-1",
      title: "Chương 1",
      order: 0,
      status: "draft",
      blocks: [{ id: "block-1", type: "paragraph", text: "Nội dung", effects: [] }],
    }],
  };
  assert.deepEqual(submitReadiness(readyStory), { ready: true, reasons: [] });
  const readyManagedStory: ManagedStory = {
    id: readyStory.id,
    title: readyStory.title,
    author: readyStory.author,
    description: readyStory.description,
    cover_image: readyStory.cover_image,
    genre: readyStory.genre,
    status: readyStory.status,
    chapters: [{
      id: "chapter-1",
      title: "Chương 1",
      order: 1,
      status: "draft",
      blockCount: 1,
      effectCount: 0,
    }],
  };
  assert.deepEqual(
    submitReadiness(readyManagedStory),
    { ready: true, reasons: [] },
    "Management readiness must use blockCount without receiving editor content",
  );
  const notReady = submitReadiness({ ...readyStory, cover_image: undefined, chapters: [] });
  assert.equal(notReady.ready, false);
  assert.equal(notReady.reasons.length, 3);
  assert.equal(isStoryMutable(readyStory), true);
  assert.equal(isStoryMutable({ ...readyStory, status: "pending_review" }), false);
  assert.equal(isStoryMutable({ ...readyStory, status: "archived" }), false);

  const originalFetch = globalThis.fetch;
  try {
    let calls = 0;
    globalThis.fetch = async () => {
      calls += 1;
      return Response.json({ error: { code: "CONFLICT", message: "Stale" } }, { status: 409 });
    };
    await assert.rejects(
      commandRequest("/api/stories/story", "POST", { expectedUpdatedAt: "old" }),
      (error: unknown) => error instanceof AuthorRequestError && error.status === 409,
    );
    assert.equal(calls, 1, "Author commands must not retry a stale mutation automatically");
    assert.match(friendlyRequestMessage(new AuthorRequestError(409, "CONFLICT", "Stale"), "Fallback"), /tải lại trang/);

    globalThis.fetch = async () => Response.json({ data: readyStory, meta: { updatedAt: "2026-09-10T00:00:00.000Z" } });
    const result = await commandRequest<Story>("/api/stories/story", "PUT", {});
    assert.equal(result.data.id, readyStory.id);
    assert.equal(result.meta.updatedAt, "2026-09-10T00:00:00.000Z");
  } finally {
    globalThis.fetch = originalFetch;
  }

  console.log("P3-10 author client rules passed: form, live card preview mapping, cover position, full list drag matrix, chapters, readiness, mutability and command conflicts.");
}
