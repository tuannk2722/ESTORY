import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Story } from "@/types/story";
import {
  buildStorySearchText,
  matchesSearch,
  normalizeSearchText,
} from "@/lib/search/text-search";
import { parsePublicStorySearchParams } from "@/lib/validation/story-search-schema";
import { JsonStoryRepository } from "@/lib/repositories/json-story-repository";

function story(
  id: string,
  title: string,
  author: string,
  genre: string[],
  status: Story["status"] = "published",
): Story {
  return {
    id,
    title,
    author,
    description: `Description ${id}`,
    genre,
    status,
    view_count: 0,
    chapters: [],
  };
}

export async function runP311SearchTests() {
  assert.equal(normalizeSearchText("  Đêm—GIÔNG!  中文  "), "dem giong 中文");
  assert.equal(
    buildStorySearchText("Đêm Giông", "Nguyễn Du"),
    "dem giong nguyen du demgiongnguyendu",
  );
  assert.equal(matchesSearch("demgiong", "Đêm Giông", "Nguyễn Du"), true);
  assert.equal(matchesSearch("giong nguyen", "Đêm Giông", "Nguyễn Du"), true);
  assert.equal(matchesSearch("dem gioong", "Đêm Giông", "Nguyễn Du"), false);

  const parsed = parsePublicStorySearchParams({
    q: [`  ${"ạ".repeat(105)}  `, "ignored"],
    genre: "  Kỳ   ảo ",
    limit: "999",
    cursor: "not+a+cursor",
  });
  assert.equal(Array.from(parsed.q).length, 100);
  assert.equal(parsed.genre, "Kỳ ảo");
  assert.equal(parsed.limit, 24);
  assert.equal(parsed.cursor, null);

  const root = await mkdtemp(path.join(tmpdir(), "p3-11-search-"));
  try {
    const repository = new JsonStoryRepository(root);
    await Promise.all([
      repository.save(story("a", "Đêm Giông", "Nguyễn Du", ["Kỳ ảo", "Tâm lý", " Kỳ ảo "])),
      repository.save(story("b", "Trăng sáng", "Hồ Xuân Hương", ["Kỳ ảo", "Cổ tích"])),
      repository.save(story("c", "Dòng sông", "Nguyễn Du", ["Tâm lý"])),
      repository.save(story("private", "Đêm riêng", "Nguyễn Du", ["Kỳ ảo"], "draft")),
    ]);

    assert.deepEqual(await repository.listPublicGenreFacets(6), [
      { genre: "Kỳ ảo", storyCount: 2 },
      { genre: "Tâm lý", storyCount: 2 },
      { genre: "Cổ tích", storyCount: 1 },
    ]);

    const byAuthor = await repository.listPublicStories({ q: "nguyen du", genre: null, cursor: null, limit: 9 });
    assert.deepEqual(byAuthor.items.map((item) => item.id), ["a", "c"]);
    assert.equal(byAuthor.total, 2);
    assert.equal("chapters" in byAuthor.items[0], false);
    assert.equal("status" in byAuthor.items[0], false);

    const first = await repository.listPublicStories({ q: "", genre: "Kỳ ảo", cursor: null, limit: 1 });
    assert.deepEqual(first.items.map((item) => item.id), ["a"]);
    assert.ok(first.nextCursor);
    const second = await repository.listPublicStories({ q: "", genre: "Kỳ ảo", cursor: first.nextCursor, limit: 1 });
    assert.deepEqual(second.items.map((item) => item.id), ["b"]);
    assert.equal(second.nextCursor, null);

    const wrongQueryCursor = await repository.listPublicStories({ q: "trang", genre: "Kỳ ảo", cursor: first.nextCursor, limit: 1 });
    assert.deepEqual(wrongQueryCursor.items.map((item) => item.id), ["b"]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }

  console.log("p3-11-search.test.ts: normalization, params, facets, projection and cursor passed");
}
