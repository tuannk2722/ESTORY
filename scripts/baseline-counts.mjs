import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";

// Audit only: read seed files directly without importing runtime repositories.
const projectRoot = new URL("../", import.meta.url);
const sourceFiles = [];

async function readSeed(relativePath) {
  const source = await readFile(new URL(relativePath, projectRoot), "utf8");
  const data = JSON.parse(source);
  // Normalize line endings/formatting so Windows and Linux produce the same hash.
  sourceFiles.push({
    path: relativePath,
    sha256: createHash("sha256").update(JSON.stringify(data)).digest("hex"),
  });
  return data;
}

function array(value, location) {
  assert.ok(Array.isArray(value), `${location} must be an array`);
  return value;
}

const storyFiles = (await readdir(new URL("content/stories/", projectRoot)))
  .filter((file) => file.endsWith(".json"))
  .sort();
const stories = [];
for (const file of storyFiles) {
  stories.push(await readSeed(`content/stories/${file}`));
}

const chapters = stories.flatMap((story) => array(story.chapters, `${story.id}.chapters`));
const blocks = chapters.flatMap((chapter) => array(chapter.blocks, `${chapter.id}.blocks`));
const blockEffects = blocks.flatMap((block) => array(block.effects, `${block.id}.effects`));
const scenes = array(await readSeed("content/scenes/scenes.json"), "scenes");
const backgrounds = array(await readSeed("content/scene-library/backgrounds.json"), "backgrounds");
const palettes = array(await readSeed("content/scene-library/palettes.json"), "palettes");
const presets = array(await readSeed("content/scene-library/scene-presets.json"), "presets");

console.log(JSON.stringify({
  counts: {
    stories: stories.length,
    chapters: chapters.length,
    blocks: blocks.length,
    block_effects: blockEffects.length,
    scenes: scenes.length,
    backgrounds: backgrounds.length,
    palettes: palettes.length,
    scene_presets: presets.length,
  },
  source_files: sourceFiles,
}, null, 2));
