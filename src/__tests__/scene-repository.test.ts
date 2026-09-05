import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { JsonStoryRepository } from "@/lib/repositories/json-story-repository";
import { JsonSceneLibraryRepository, JsonSceneRepository } from "@/lib/repositories/json-scene-repository";
import { assertLocalSceneMedia } from "@/lib/scenes/scene-media";
import { resolveBackgroundAsset, resolvePalette } from "@/lib/scenes/scene-mappers";
import type { Chapter, Story } from "@/types/story";
import { legacyBackground, legacyPalette, legacyScene, snapshotConfig, snapshotScene } from "./fixtures/scene-fixtures";

export async function runSceneRepositoryTests() {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "story-p3-01-"));
  const write = async (file: string, data: unknown) => {
    const target = path.join(directory, "content", file);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, JSON.stringify(data));
  };
  const chapter: Chapter = { id: "chapter", title: "Chapter", order: 2, status: "published", blocks: [{ id: "block", type: "paragraph", text: "Text", effects: [] }] };
  const story: Story = {
    id: "story", title: "Story", author: "Display name", description: "", genre: [], status: "published", view_count: 0,
    chapters: [
      { ...chapter, id: "next", order: 4 }, chapter,
      { ...chapter, id: "draft", status: "draft", order: 3 },
      { ...chapter, id: "previous", order: 1 },
    ],
  };
  try {
    await write("stories/story.json", story);
    await write("stories/other.json", { ...story, id: "other", chapters: [{ ...chapter, id: "other-chapter" }] });
    await write("scenes/scenes.json", [legacyScene]);
    await write("scene-library/backgrounds.json", [legacyBackground]);
    await write("scene-library/palettes.json", [legacyPalette]);
    await write("scene-library/scene-presets.json", []);
    await fs.mkdir(path.join(directory, "public"));
    await fs.writeFile(path.join(directory, "public/background.svg"), '<svg xmlns="http://www.w3.org/2000/svg"/>');
    const stories = new JsonStoryRepository(directory);
    const library = new JsonSceneLibraryRepository(directory);
    const scenes = new JsonSceneRepository(stories, library, directory);
    const aggregate = await stories.getPublicChapter("story", "chapter");
    assert.equal(aggregate?.scenes[0].render_config.schema_version, 1);
    assert.deepEqual(aggregate?.story, { id: "story", title: "Story" });
    assert.equal(aggregate?.previousChapterId, "previous");
    assert.equal(aggregate?.nextChapterId, "next", "Navigation skips drafts and sorts by order");
    assert.equal((await stories.getPublicChapter("story", "next"))?.isLastChapter, true);
    assert.equal((await stories.getById("story"))?.chapters.length, 4, "Editor retains draft chapters");
    assert.deepEqual(await scenes.getByChapter("other", "chapter"), []);
    assert.deepEqual(await scenes.getLegacyByChapter("other", "chapter"), []);
    assert.equal(await stories.getById("../story"), null);
    await assert.rejects(() => stories.getAllForAuthor("author"));

    let sceneReads = 0;
    const publicReader = new JsonStoryRepository(directory, { async getByChapter() { sceneReads++; throw new Error("Must not read scenes"); } });
    for (const [storyId, chapterId] of [["story", "draft"], ["other", "chapter"], ["missing", "chapter"]]) {
      assert.equal(await publicReader.getPublicChapter(storyId, chapterId), null);
    }
    for (const status of ["draft", "pending_review", "archived", undefined]) {
      await write("stories/story.json", { ...story, status });
      assert.equal(await publicReader.getPublicChapter("story", "chapter"), null);
    }
    await write("stories/story.json", { ...story, chapters: [{ ...chapter, status: undefined }] });
    assert.equal(await publicReader.getPublicChapter("story", "chapter"), null);
    assert.equal(sceneReads, 0, "Public checks happen before scene/catalog access");
    await write("stories/story.json", story);

    // Duplicate chapter IDs across legacy stories cannot be safely disambiguated.
    await write("stories/other.json", { ...story, id: "other", chapters: [chapter] });
    await assert.rejects(() => scenes.getByChapter("story", "chapter"), /Ambiguous/);
    await write("stories/other.json", { ...story, id: "other", chapters: [{ ...chapter, id: "other-chapter" }] });

    // Snapshot reads never resolve catalog IDs, even after all ingredients disappear.
    await write("scenes/scenes.json", [snapshotScene()]);
    await write("scene-library/backgrounds.json", []);
    await write("scene-library/palettes.json", []);
    assert.deepEqual((await scenes.getByChapter("story", "chapter"))[0], snapshotScene());
    await assert.rejects(() => scenes.getLegacyByChapter("story", "chapter"), /Snapshot/);
    await assert.rejects(() => scenes.replaceLegacyChapterScenes("story", "chapter", [legacyScene]), /snapshots/);
    await write("scenes/scenes.json", [{ ...snapshotScene(), start_block_id: "foreign-block" }]);
    await assert.rejects(() => scenes.getByChapter("story", "chapter"), /range/);
    await write("scenes/scenes.json", [snapshotScene(), { ...snapshotScene(), id: "overlap" }]);
    await assert.rejects(() => scenes.getByChapter("story", "chapter"), /Overlapping/);
    await write("scenes/scenes.json", [{ ...snapshotScene(), render_config: { ...snapshotConfig(), schema_version: 9 } }]);
    await assert.rejects(() => scenes.getByChapter("story", "chapter"));
    const missingMedia = snapshotConfig();
    missingMedia.background = { render_data: { kind: "video", media_url: "/missing.mp4" }, motion: "looping", poster_frame: "/background.svg" };
    await assert.rejects(() => assertLocalSceneMedia(missingMedia, path.join(directory, "public")), /missing.mp4/);

    // Repository-level lifecycle and personal/global filtering precedes projection.
    const global = resolveBackgroundAsset(legacyBackground);
    await write("scene-library/backgrounds.json", [global, { ...global, id: "personal", scope: "personal", owner_id: "someone" }, { ...global, id: "archived", status: "archived" }, { ...global, id: "missing-status", status: undefined }]);
    assert.deepEqual((await library.getActiveGlobalBackgrounds()).map(item => item.id), ["background"]);
    const palette = resolvePalette(legacyPalette);
    await write("scene-library/palettes.json", [palette, { ...palette, id: "draft-palette", status: "draft" }]);
    assert.deepEqual((await library.getActivePalettes()).map(item => item.id), ["palette"]);
    const preset = { id: "private-media-preset", label: "Preset", status: "active", mood_tags: [], render_config: snapshotConfig() };
    await write("scene-library/scene-presets.json", [preset, { ...preset, id: "archived-preset", status: "archived" }]);
    await write("scene-library/backgrounds.json", []);
    await write("scene-library/palettes.json", []);
    assert.deepEqual(await library.getActiveScenePresets(), [preset]);

    await write("scenes/scenes.json", [legacyScene]);
    await assert.rejects(() => scenes.replaceLegacyChapterScenes("other", "chapter", [legacyScene]));
    assert.deepEqual(JSON.parse(await fs.readFile(path.join(directory, "content/scenes/scenes.json"), "utf8")), [legacyScene]);
    await fs.writeFile(path.join(directory, "content/scenes/scenes.json"), "invalid JSON");
    await assert.rejects(() => scenes.getByChapter("story", "chapter"), SyntaxError);
    console.log("scene-repository.test.ts: public boundaries, snapshots, media and catalog isolation passed");
  } finally {
    // This directory was exclusively created by mkdtemp for this test run.
    await fs.rm(directory, { recursive: true, force: true });
  }
}
