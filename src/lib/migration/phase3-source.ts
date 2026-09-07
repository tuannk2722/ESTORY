import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { effectConfigSchema } from "@/lib/effects/effect-config-schema";
import { EFFECT_MANIFEST, EFFECT_TYPES } from "@/lib/effects/effect-manifest";
import { EFFECT_PRESENTATION_SEED } from "@/lib/effects/effect-seed";
import { buildEffectKeywordSeed } from "@/lib/effects/effect-keywords";
import { resolveBackgroundAsset, resolveLegacyScene, resolvePalette, legacyPresetToRenderConfig } from "@/lib/scenes/scene-mappers";
import { sceneMediaUrls } from "@/lib/scenes/scene-media";
import { buildBlockIndexMap, validateSceneRange } from "@/lib/scenes/sceneRange";
import type { BackgroundAsset, ColorPalette, Scene, ScenePreset } from "@/types/scene";
import type { LegacyBackgroundAsset, LegacyColorPalette, LegacyScene, LegacyScenePreset } from "@/types/scene-legacy";
import type { Story } from "@/types/story";

const nonEmpty = z.string().trim().min(1);
const storyBlockSchema = z.strictObject({
  id: nonEmpty,
  type: z.enum(["paragraph", "dialogue", "heading"]),
  text: z.string(),
  mood_tag: z.string().optional(),
  effects: z.array(effectConfigSchema),
});
const chapterSchema = z.strictObject({
  id: nonEmpty,
  title: z.string(),
  order: z.number().int(),
  status: z.enum(["draft", "published"]),
  view_count: z.number().int().min(0).optional(),
  blocks: z.array(storyBlockSchema),
});
const storySchema = z.strictObject({
  id: nonEmpty,
  title: z.string(),
  author: nonEmpty,
  description: z.string(),
  cover_image: z.string().optional(),
  genre: z.array(z.string()),
  status: z.enum(["draft", "pending_review", "published", "rejected", "archived"]),
  view_count: z.number().int().min(0),
  chapters: z.array(chapterSchema),
});

const legacyBackgroundSchema = z.strictObject({
  id: nonEmpty,
  type: z.enum(["image", "video", "gradient", "particle_composition"]),
  label: z.string(),
  value: nonEmpty,
  motion: z.enum(["static", "looping"]),
  poster_frame: nonEmpty.optional(),
  mood_tags: z.array(z.string()),
  scope: z.enum(["global", "personal"]).optional(),
  source: z.enum(["admin_upload", "author_upload", "ai_generated"]).optional(),
  owner_id: nonEmpty.optional(),
  generation_prompt: z.string().optional(),
}).superRefine((asset, context) => {
  const scope = asset.scope ?? "global";
  if (scope === "personal" && !asset.owner_id) {
    context.addIssue({ code: "custom", path: ["owner_id"], message: "Personal background requires an owner" });
  }
  if (scope === "global" && asset.owner_id) {
    context.addIssue({ code: "custom", path: ["owner_id"], message: "Global background cannot have an owner" });
  }
});
const legacyPaletteSchema = z.strictObject({
  id: nonEmpty,
  label: z.string(),
  colors: z.strictObject({
    primary: nonEmpty,
    secondary: nonEmpty,
    accent: nonEmpty,
    background_tint: nonEmpty,
  }),
  mood_tags: z.array(z.string()),
});
const legacyPresetSchema = z.strictObject({
  id: nonEmpty,
  label: z.string(),
  background_id: nonEmpty,
  palette_id: nonEmpty,
  mood_tags: z.array(z.string()),
  effects: z.array(effectConfigSchema).optional(),
});
const legacySceneSchema = z.strictObject({
  id: nonEmpty,
  chapter_id: nonEmpty,
  start_block_id: nonEmpty,
  end_block_id: nonEmpty,
  based_on_preset_id: nonEmpty.optional(),
  background_id: nonEmpty,
  palette_id: nonEmpty,
  effects: z.array(effectConfigSchema).optional(),
});

export interface SourceFileAudit {
  path: string;
  sha256: string;
}

export interface MediaAuditEntry {
  url: string;
  status: "ok" | "missing" | "unsupported_remote";
  bytes?: number;
  sha256?: string;
}

export interface Phase3SourceCounts {
  stories: number;
  chapters: number;
  blocks: number;
  blockEffects: number;
  scenes: number;
  backgrounds: number;
  palettes: number;
  scenePresets: number;
  effectDefinitions: number;
  effectKeywords: number;
}

export interface Phase3MigrationSource {
  stories: Story[];
  scenes: Scene[];
  backgrounds: BackgroundAsset[];
  palettes: ColorPalette[];
  presets: Array<ScenePreset & { source_version: number; source_checksum: string }>;
  effectDefinitions: Array<{ effectId: string; label: string; description: string; isActive: true }>;
  effectKeywords: ReturnType<typeof buildEffectKeywordSeed>["entries"];
  duplicateKeywordCount: number;
  counts: Phase3SourceCounts;
  sourceFiles: SourceFileAudit[];
  media: MediaAuditEntry[];
}

function sha256(input: string | Buffer): string {
  return createHash("sha256").update(input).digest("hex");
}

function parseOrThrow<S extends z.ZodType>(schema: S, input: unknown, location: string): z.output<S> {
  const result = schema.safeParse(input);
  if (!result.success) {
    const fields = [...new Set(result.error.issues.map((issue) => issue.path.join(".") || "root"))];
    throw new Error(`${location}: invalid fields ${fields.join(", ")}`);
  }
  return result.data;
}

async function readJson(rootDirectory: string, relativePath: string, sourceFiles: SourceFileAudit[]): Promise<unknown> {
  const contents = await fs.readFile(path.join(rootDirectory, relativePath), "utf8");
  const parsed: unknown = JSON.parse(contents);
  sourceFiles.push({ path: relativePath.replaceAll("\\", "/"), sha256: sha256(JSON.stringify(parsed)) });
  return parsed;
}

function assertUnique(label: string, ids: readonly string[]): void {
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) throw new Error(`Duplicate ${label} ID: ${id}`);
    seen.add(id);
  }
}

function validateSceneRanges(scenes: readonly Scene[], stories: readonly Story[]): void {
  const chapters = new Map(stories.flatMap((story) => story.chapters.map((chapter) => [chapter.id, chapter] as const)));
  const grouped = new Map<string, Scene[]>();
  for (const scene of scenes) {
    const chapter = chapters.get(scene.chapter_id);
    if (!chapter) throw new Error(`Scene ${scene.id}: unknown chapter ${scene.chapter_id}`);
    const range = validateSceneRange(scene, buildBlockIndexMap(chapter.blocks), chapter.blocks.length);
    if (!range.valid) throw new Error(`Scene ${scene.id}: invalid block range ${range.reason}`);
    const rows = grouped.get(scene.chapter_id) ?? [];
    rows.push(scene);
    grouped.set(scene.chapter_id, rows);
  }
  for (const [chapterId, rows] of grouped) {
    const chapter = chapters.get(chapterId)!;
    const indexes = buildBlockIndexMap(chapter.blocks);
    const ranges = rows.map((scene) => ({
      id: scene.id,
      ...validateSceneRange(scene, indexes, chapter.blocks.length),
    })).filter((range): range is { id: string; valid: true; startIndex: number; endIndex: number } => range.valid)
      .sort((a, b) => a.startIndex - b.startIndex || a.id.localeCompare(b.id));
    for (let index = 1; index < ranges.length; index += 1) {
      if (ranges[index].startIndex <= ranges[index - 1].endIndex) {
        throw new Error(`Chapter ${chapterId}: overlapping scenes ${ranges[index - 1].id} and ${ranges[index].id}`);
      }
    }
  }
}

function collectMediaUrls(source: Omit<Phase3MigrationSource, "counts" | "sourceFiles" | "media">): string[] {
  const urls = new Set<string>();
  for (const story of source.stories) {
    if (story.cover_image) urls.add(story.cover_image);
    for (const chapter of story.chapters) {
      for (const block of chapter.blocks) {
        for (const effect of block.effects) if (effect.audio_src) urls.add(effect.audio_src);
      }
    }
  }
  for (const background of source.backgrounds) {
    if ("media_url" in background.render.render_data) urls.add(background.render.render_data.media_url);
    if (background.render.poster_frame) urls.add(background.render.poster_frame);
  }
  for (const preset of source.presets) for (const url of sceneMediaUrls(preset.render_config)) urls.add(url);
  for (const scene of source.scenes) for (const url of sceneMediaUrls(scene.render_config)) urls.add(url);
  return [...urls].sort();
}

async function auditMedia(rootDirectory: string, urls: readonly string[]): Promise<MediaAuditEntry[]> {
  const publicDirectory = path.resolve(rootDirectory, "public");
  const report: MediaAuditEntry[] = [];
  for (const url of urls) {
    if (!url.startsWith("/")) {
      report.push({ url, status: "unsupported_remote" });
      continue;
    }
    const pathname = decodeURIComponent(url.split(/[?#]/)[0]);
    const target = path.resolve(publicDirectory, `.${pathname}`);
    const relative = path.relative(publicDirectory, target);
    if (relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("Media path escapes public directory");
    const bytes = await fs.readFile(target).catch(() => null);
    report.push(bytes
      ? { url, status: "ok", bytes: bytes.length, sha256: sha256(bytes) }
      : { url, status: "missing" });
  }
  return report;
}

export function assertPhase3SourceClean(source: Phase3MigrationSource): void {
  const invalid = source.media.filter((entry) => entry.status !== "ok");
  if (invalid.length) {
    throw new Error(`Media verification failed: ${invalid.map((entry) => `${entry.status}:${entry.url}`).join(", ")}`);
  }
}

export async function loadPhase3MigrationSource(
  rootDirectory = process.cwd(),
  options: { auditMedia?: boolean } = {},
): Promise<Phase3MigrationSource> {
  const sourceFiles: SourceFileAudit[] = [];
  const storyDirectory = path.join(rootDirectory, "content", "stories");
  const storyFiles = (await fs.readdir(storyDirectory)).filter((file) => file.endsWith(".json")).sort();
  const stories: Story[] = [];
  for (const file of storyFiles) {
    const story = parseOrThrow(storySchema, await readJson(rootDirectory, `content/stories/${file}`, sourceFiles), file) as Story;
    if (`${story.id}.json` !== file) throw new Error(`${file}: filename must match Story.id`);
    stories.push(story);
  }
  const backgroundsLegacy = parseOrThrow(
    z.array(legacyBackgroundSchema),
    await readJson(rootDirectory, "content/scene-library/backgrounds.json", sourceFiles),
    "backgrounds.json",
  ) as LegacyBackgroundAsset[];
  const palettesLegacy = parseOrThrow(
    z.array(legacyPaletteSchema),
    await readJson(rootDirectory, "content/scene-library/palettes.json", sourceFiles),
    "palettes.json",
  ) as LegacyColorPalette[];
  const presetsLegacy = parseOrThrow(
    z.array(legacyPresetSchema),
    await readJson(rootDirectory, "content/scene-library/scene-presets.json", sourceFiles),
    "scene-presets.json",
  ) as LegacyScenePreset[];
  const scenesLegacy = parseOrThrow(
    z.array(legacySceneSchema),
    await readJson(rootDirectory, "content/scenes/scenes.json", sourceFiles),
    "scenes.json",
  ) as LegacyScene[];

  const chapters = stories.flatMap((story) => story.chapters);
  const blocks = chapters.flatMap((chapter) => chapter.blocks);
  const blockEffects = blocks.flatMap((block) => block.effects);
  assertUnique("Story", stories.map((story) => story.id));
  for (const story of stories) {
    assertUnique(`Chapter order in Story ${story.id}`, story.chapters.map((chapter) => String(chapter.order)));
  }
  assertUnique("Chapter", chapters.map((chapter) => chapter.id));
  assertUnique("Block", blocks.map((block) => block.id));
  assertUnique("Effect", blockEffects.map((effect) => effect.id));
  assertUnique("Background", backgroundsLegacy.map((item) => item.id));
  assertUnique("Palette", palettesLegacy.map((item) => item.id));
  assertUnique("ScenePreset", presetsLegacy.map((item) => item.id));
  assertUnique("Scene", scenesLegacy.map((item) => item.id));

  const presetIds = new Set(presetsLegacy.map((preset) => preset.id));
  const backgrounds = backgroundsLegacy.map(resolveBackgroundAsset);
  const palettes = palettesLegacy.map(resolvePalette);
  const presets = presetsLegacy.map((preset) => ({
    id: preset.id,
    label: preset.label,
    mood_tags: [...preset.mood_tags],
    status: "active" as const,
    render_config: legacyPresetToRenderConfig(preset, backgroundsLegacy, palettesLegacy),
    source_version: 1,
    source_checksum: sha256(JSON.stringify(preset)),
  }));
  const scenes = scenesLegacy.map((scene) => {
    if (scene.based_on_preset_id && !presetIds.has(scene.based_on_preset_id)) {
      throw new Error(`Scene ${scene.id}: unknown preset ${scene.based_on_preset_id}`);
    }
    return resolveLegacyScene(scene, backgroundsLegacy, palettesLegacy);
  });
  validateSceneRanges(scenes, stories);

  const keywords = buildEffectKeywordSeed();
  const effectDefinitions = EFFECT_TYPES.map((effectId) => ({
    effectId,
    label: EFFECT_PRESENTATION_SEED[effectId].label,
    description: EFFECT_PRESENTATION_SEED[effectId].description,
    isActive: true as const,
  }));
  if (effectDefinitions.some((definition) => !Object.hasOwn(EFFECT_MANIFEST, definition.effectId))) {
    throw new Error("Effect seed contains an unknown technical ID");
  }

  const partial = {
    stories,
    scenes,
    backgrounds,
    palettes,
    presets,
    effectDefinitions,
    effectKeywords: keywords.entries,
    duplicateKeywordCount: keywords.duplicateCount,
  };
  const media = options.auditMedia === false ? [] : await auditMedia(rootDirectory, collectMediaUrls(partial));
  return {
    ...partial,
    counts: {
      stories: stories.length,
      chapters: chapters.length,
      blocks: blocks.length,
      blockEffects: blockEffects.length,
      scenes: scenes.length,
      backgrounds: backgrounds.length,
      palettes: palettes.length,
      scenePresets: presets.length,
      effectDefinitions: effectDefinitions.length,
      effectKeywords: keywords.entries.length,
    },
    sourceFiles,
    media,
  };
}
