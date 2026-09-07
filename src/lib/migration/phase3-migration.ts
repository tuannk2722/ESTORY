import { isDeepStrictEqual } from "node:util";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { databaseJson } from "@/lib/db/json-fields";
import { assertEffectManifestDatabaseIds, syncEffectManifest } from "@/lib/effects/effect-manifest-sync";
import { EFFECT_TYPES } from "@/lib/effects/effect-manifest";
import { assertPhase3SourceClean, type Phase3MigrationSource } from "./phase3-source";

export type Phase3MigrationMode = "dry-run" | "apply" | "verify";
type DatabaseClient = PrismaClient | Prisma.TransactionClient;

const storyStatus = {
  draft: "DRAFT",
  pending_review: "PENDING_REVIEW",
  published: "PUBLISHED",
  rejected: "REJECTED",
  archived: "ARCHIVED",
} as const;
const chapterStatus = { draft: "DRAFT", published: "PUBLISHED" } as const;

function assertOwnerId(ownerId: string | undefined): asserts ownerId is string {
  if (!ownerId?.trim()) throw new Error("LEGACY_OWNER_USER_ID is required");
}

async function assertDatabasePreconditions(
  db: DatabaseClient,
  source: Phase3MigrationSource,
  ownerId: string,
): Promise<void> {
  const owner = await db.user.findUnique({ where: { id: ownerId }, select: { id: true } });
  if (!owner) throw new Error("LEGACY_OWNER_USER_ID does not match an existing user");

  await assertEffectManifestDatabaseIds(db);

  const expectedStoryIds = new Set(source.stories.map((story) => story.id));
  const expectedSlugs = new Set(source.stories.map((story) => story.id));
  const storyCollisions = await db.story.findMany({
    where: { OR: [{ id: { in: [...expectedStoryIds] } }, { slug: { in: [...expectedSlugs] } }] },
    select: { id: true, slug: true },
  });
  for (const row of storyCollisions) {
    if (!expectedStoryIds.has(row.id) || row.slug !== row.id) {
      throw new Error(`Story ID/slug collision: ${row.id}`);
    }
  }

  const expectedChapterOwner = new Map(source.stories.flatMap((story) => story.chapters.map((chapter) => [chapter.id, story.id] as const)));
  const expectedBlockOwner = new Map(source.stories.flatMap((story) => story.chapters.flatMap((chapter) => chapter.blocks.map((block) => [block.id, chapter.id] as const))));
  const expectedEffectOwner = new Map(source.stories.flatMap((story) => story.chapters.flatMap((chapter) => chapter.blocks.flatMap((block) => block.effects.map((effect) => [effect.id, block.id] as const)))));
  const expectedSceneOwner = new Map(source.scenes.map((scene) => [scene.id, scene.chapter_id] as const));

  const [chapters, blocks, effects, scenes, backgrounds] = await Promise.all([
    db.chapter.findMany({ where: { id: { in: [...expectedChapterOwner.keys()] } }, select: { id: true, storyId: true } }),
    db.storyBlock.findMany({ where: { id: { in: [...expectedBlockOwner.keys()] } }, select: { id: true, chapterId: true } }),
    db.effect.findMany({ where: { id: { in: [...expectedEffectOwner.keys()] } }, select: { id: true, blockId: true } }),
    db.scene.findMany({ where: { id: { in: [...expectedSceneOwner.keys()] } }, select: { id: true, chapterId: true } }),
    db.backgroundAsset.findMany({ where: { id: { in: source.backgrounds.map((item) => item.id) } }, select: { id: true, scope: true, ownerId: true } }),
  ]);
  for (const row of chapters) if (expectedChapterOwner.get(row.id) !== row.storyId) throw new Error(`Chapter ID collision: ${row.id}`);
  for (const row of blocks) if (expectedBlockOwner.get(row.id) !== row.chapterId) throw new Error(`Block ID collision: ${row.id}`);
  for (const row of effects) if (expectedEffectOwner.get(row.id) !== row.blockId) throw new Error(`Effect ID collision: ${row.id}`);
  for (const row of scenes) if (expectedSceneOwner.get(row.id) !== row.chapterId) throw new Error(`Scene ID collision: ${row.id}`);
  const expectedBackgrounds = new Map(source.backgrounds.map((item) => [item.id, item] as const));
  for (const row of backgrounds) {
    const expected = expectedBackgrounds.get(row.id)!;
    const expectedOwner = expected.scope === "personal" ? expected.owner_id : undefined;
    if (row.scope !== expected.scope || (row.ownerId ?? undefined) !== expectedOwner) {
      throw new Error(`Background scope/owner collision: ${row.id}`);
    }
  }

  const personalOwnerIds = [...new Set(source.backgrounds
    .filter((item) => item.scope === "personal")
    .map((item) => item.owner_id!))];
  if (personalOwnerIds.length) {
    const ownerCount = await db.user.count({ where: { id: { in: personalOwnerIds } } });
    if (ownerCount !== personalOwnerIds.length) throw new Error("A personal background owner does not exist");
  }
}

export async function applyPhase3MigrationTransaction(
  db: Prisma.TransactionClient,
  source: Phase3MigrationSource,
  ownerId: string,
): Promise<void> {
  assertPhase3SourceClean(source);
  await assertDatabasePreconditions(db, source, ownerId);
  const activatedAt = new Date();

  await syncEffectManifest(db, source.effectDefinitions, source.effectKeywords);

  const existingBackgrounds = new Map((await db.backgroundAsset.findMany({
    where: { id: { in: source.backgrounds.map((item) => item.id) } },
    select: { id: true, activatedAt: true },
  })).map((row) => [row.id, row] as const));
  for (const background of source.backgrounds) {
    const data = {
      label: background.label,
      render: databaseJson.backgroundRender.write(background.render),
      moodTags: background.mood_tags,
      status: "ACTIVE" as const,
      activatedAt: existingBackgrounds.get(background.id)?.activatedAt ?? activatedAt,
      scope: background.scope,
      source: background.source,
      generationPrompt: background.generation_prompt ?? null,
      ownerId: background.owner_id ?? null,
    };
    await db.backgroundAsset.upsert({ where: { id: background.id }, create: { id: background.id, ...data }, update: data });
  }

  const existingPalettes = new Map((await db.colorPalette.findMany({
    where: { id: { in: source.palettes.map((item) => item.id) } },
    select: { id: true, activatedAt: true },
  })).map((row) => [row.id, row] as const));
  for (const palette of source.palettes) {
    const data = {
      label: palette.label,
      primary: palette.colors.primary,
      secondary: palette.colors.secondary,
      accent: palette.colors.accent,
      backgroundTintColor: palette.colors.background_tint.color,
      backgroundTintOpacity: palette.colors.background_tint.opacity,
      moodTags: palette.mood_tags,
      status: "ACTIVE" as const,
      activatedAt: existingPalettes.get(palette.id)?.activatedAt ?? activatedAt,
    };
    await db.colorPalette.upsert({ where: { id: palette.id }, create: { id: palette.id, ...data }, update: data });
  }

  const existingPresets = new Set((await db.scenePreset.findMany({
    where: { id: { in: source.presets.map((item) => item.id) } },
    select: { id: true },
  })).map((row) => row.id));
  for (const preset of source.presets) {
    const sourceData = {
      renderConfig: databaseJson.presetRenderConfig.write(preset.render_config),
      sourceVersion: preset.source_version,
      sourceChecksum: preset.source_checksum,
    };
    if (existingPresets.has(preset.id)) {
      // Preserve metadata/lifecycle that P3-13 Admin may own on later syncs.
      await db.scenePreset.update({ where: { id: preset.id }, data: sourceData });
    } else {
      await db.scenePreset.create({ data: {
        id: preset.id,
        label: preset.label,
        description: preset.description ?? null,
        thumbnailUrl: preset.thumbnail_url ?? null,
        moodTags: preset.mood_tags,
        status: "ACTIVE",
        activatedAt,
        ...sourceData,
      } });
    }
  }

  for (const story of source.stories) {
    const data = {
      slug: story.id,
      title: story.title,
      authorDisplayName: story.author,
      description: story.description,
      coverUrl: story.cover_image ?? null,
      genre: story.genre,
      viewCount: story.view_count,
      status: storyStatus[story.status],
      authorId: ownerId,
    };
    await db.story.upsert({ where: { id: story.id }, create: { id: story.id, ...data }, update: data });
    for (const chapter of story.chapters) {
      const chapterData = {
        storyId: story.id,
        title: chapter.title,
        order: chapter.order,
        status: chapterStatus[chapter.status],
        viewCount: chapter.view_count ?? 0,
      };
      await db.chapter.upsert({ where: { id: chapter.id }, create: { id: chapter.id, ...chapterData }, update: chapterData });
      for (let blockOrder = 0; blockOrder < chapter.blocks.length; blockOrder += 1) {
        const block = chapter.blocks[blockOrder];
        const blockData = {
          chapterId: chapter.id,
          type: block.type,
          text: block.text,
          moodTag: block.mood_tag ?? null,
          order: blockOrder + 1,
        };
        await db.storyBlock.upsert({ where: { id: block.id }, create: { id: block.id, ...blockData }, update: blockData });
        for (const effect of block.effects) {
          const effectData = {
            blockId: block.id,
            type: effect.type,
            category: effect.category,
            intensity: effect.intensity,
            durationMs: effect.duration_ms,
            delayMs: effect.delay_ms ?? null,
            audioSrc: effect.audio_src ?? null,
            audioAssetId: effect.audio_asset_id ?? null,
            loop: effect.loop ?? false,
          };
          await db.effect.upsert({ where: { id: effect.id }, create: { id: effect.id, ...effectData }, update: effectData });
        }
      }
    }
  }

  for (const scene of source.scenes) {
    const data = {
      chapterId: scene.chapter_id,
      startBlockId: scene.start_block_id,
      endBlockId: scene.end_block_id,
      basedOnPresetId: scene.based_on_preset_id ?? null,
      renderConfig: databaseJson.sceneRenderConfig.write(scene.render_config),
    };
    await db.scene.upsert({ where: { id: scene.id }, create: { id: scene.id, ...data }, update: data });
  }
}

function mismatch(issues: string[], condition: boolean, message: string): void {
  if (!condition) issues.push(message);
}

export async function verifyPhase3Migration(
  db: DatabaseClient,
  source: Phase3MigrationSource,
  ownerId: string,
): Promise<void> {
  assertPhase3SourceClean(source);
  await assertDatabasePreconditions(db, source, ownerId);
  const issues: string[] = [];

  const stories = await db.story.findMany({
    where: { id: { in: source.stories.map((story) => story.id) } },
    include: {
      chapters: {
        orderBy: [{ order: "asc" }, { id: "asc" }],
        include: { blocks: { orderBy: [{ order: "asc" }, { id: "asc" }], include: { effects: true } } },
      },
    },
  });
  const storyRows = new Map(stories.map((story) => [story.id, story] as const));
  mismatch(issues, stories.length === source.counts.stories, "Story count mismatch");
  for (const expected of source.stories) {
    const actual = storyRows.get(expected.id);
    if (!actual) { issues.push(`Missing Story ${expected.id}`); continue; }
    mismatch(issues, actual.slug === expected.id, `Story slug mismatch ${expected.id}`);
    mismatch(issues, actual.title === expected.title && actual.description === expected.description, `Story text mismatch ${expected.id}`);
    mismatch(issues, actual.authorId === ownerId, `Story owner mismatch ${expected.id}`);
    mismatch(issues, actual.authorDisplayName === expected.author, `Story author display mismatch ${expected.id}`);
    mismatch(issues, actual.status === storyStatus[expected.status], `Story status mismatch ${expected.id}`);
    mismatch(issues, actual.coverUrl === (expected.cover_image ?? null), `Story cover mismatch ${expected.id}`);
    mismatch(issues, actual.viewCount === expected.view_count && isDeepStrictEqual(actual.genre, expected.genre), `Story fields mismatch ${expected.id}`);
    const chapterRows = new Map(actual.chapters.map((chapter) => [chapter.id, chapter] as const));
    mismatch(issues, actual.chapters.length === expected.chapters.length, `Chapter count mismatch ${expected.id}`);
    for (const expectedChapter of expected.chapters) {
      const chapter = chapterRows.get(expectedChapter.id);
      if (!chapter) { issues.push(`Missing Chapter ${expectedChapter.id}`); continue; }
      mismatch(issues,
        chapter.storyId === expected.id && chapter.title === expectedChapter.title && chapter.order === expectedChapter.order
          && chapter.status === chapterStatus[expectedChapter.status] && chapter.viewCount === (expectedChapter.view_count ?? 0),
        `Chapter mismatch ${expectedChapter.id}`,
      );
      const blocks = new Map(chapter.blocks.map((block) => [block.id, block] as const));
      mismatch(issues, chapter.blocks.length === expectedChapter.blocks.length, `Block count mismatch ${expectedChapter.id}`);
      for (let blockOrder = 0; blockOrder < expectedChapter.blocks.length; blockOrder += 1) {
        const expectedBlock = expectedChapter.blocks[blockOrder];
        const block = blocks.get(expectedBlock.id);
        if (!block) { issues.push(`Missing Block ${expectedBlock.id}`); continue; }
        mismatch(issues,
          block.chapterId === expectedChapter.id && block.type === expectedBlock.type && block.text === expectedBlock.text
            && block.moodTag === (expectedBlock.mood_tag ?? null) && block.order === blockOrder + 1,
          `Block mismatch ${expectedBlock.id}`,
        );
        const effects = new Map(block.effects.map((effect) => [effect.id, effect] as const));
        mismatch(issues, block.effects.length === expectedBlock.effects.length, `Effect count mismatch ${expectedBlock.id}`);
        for (const expectedEffect of expectedBlock.effects) {
          const effect = effects.get(expectedEffect.id);
          mismatch(issues, Boolean(effect) && isDeepStrictEqual({
            blockId: effect!.blockId,
            type: effect!.type,
            category: effect!.category,
            intensity: effect!.intensity,
            durationMs: effect!.durationMs,
            delayMs: effect!.delayMs,
            audioSrc: effect!.audioSrc,
            audioAssetId: effect!.audioAssetId,
            loop: effect!.loop,
          }, {
            blockId: expectedBlock.id,
            type: expectedEffect.type,
            category: expectedEffect.category,
            intensity: expectedEffect.intensity,
            durationMs: expectedEffect.duration_ms,
            delayMs: expectedEffect.delay_ms ?? null,
            audioSrc: expectedEffect.audio_src ?? null,
            audioAssetId: expectedEffect.audio_asset_id ?? null,
            loop: expectedEffect.loop ?? false,
          }), `Effect mismatch ${expectedEffect.id}`);
        }
      }
    }
  }

  const [backgrounds, palettes, presets, scenes, definitions, keywords] = await Promise.all([
    db.backgroundAsset.findMany({ where: { id: { in: source.backgrounds.map((item) => item.id) } } }),
    db.colorPalette.findMany({ where: { id: { in: source.palettes.map((item) => item.id) } } }),
    db.scenePreset.findMany({ where: { id: { in: source.presets.map((item) => item.id) } } }),
    db.scene.findMany({ where: { id: { in: source.scenes.map((item) => item.id) } } }),
    db.effectDefinition.findMany({ select: { effectId: true } }),
    db.effectKeywordSuggestion.findMany({
      where: { OR: source.effectKeywords.map((entry) => ({ effectId: entry.effectId, normalizedKeyword: entry.normalizedKeyword })) },
    }),
  ]);
  mismatch(issues, backgrounds.length === source.counts.backgrounds, "Background count mismatch");
  const backgroundRows = new Map(backgrounds.map((row) => [row.id, row] as const));
  for (const expected of source.backgrounds) {
    const actual = backgroundRows.get(expected.id);
    mismatch(issues, Boolean(actual) && actual!.label === expected.label && actual!.status === "ACTIVE"
      && actual!.scope === expected.scope && (actual!.ownerId ?? undefined) === expected.owner_id
      && actual!.source === expected.source && actual!.generationPrompt === (expected.generation_prompt ?? null)
      && isDeepStrictEqual(actual!.moodTags, expected.mood_tags)
      && isDeepStrictEqual(databaseJson.backgroundRender.read(actual!.render), expected.render), `Background mismatch ${expected.id}`);
  }
  mismatch(issues, palettes.length === source.counts.palettes, "Palette count mismatch");
  const paletteRows = new Map(palettes.map((row) => [row.id, row] as const));
  for (const expected of source.palettes) {
    const actual = paletteRows.get(expected.id);
    mismatch(issues, Boolean(actual) && actual!.label === expected.label && actual!.status === "ACTIVE"
      && actual!.primary === expected.colors.primary && actual!.secondary === expected.colors.secondary
      && actual!.accent === expected.colors.accent && actual!.backgroundTintColor === expected.colors.background_tint.color
      && actual!.backgroundTintOpacity === expected.colors.background_tint.opacity
      && isDeepStrictEqual(actual!.moodTags, expected.mood_tags), `Palette mismatch ${expected.id}`);
  }
  mismatch(issues, presets.length === source.counts.scenePresets, "ScenePreset count mismatch");
  const presetRows = new Map(presets.map((row) => [row.id, row] as const));
  for (const expected of source.presets) {
    const actual = presetRows.get(expected.id);
    mismatch(issues, Boolean(actual) && actual!.sourceVersion === expected.source_version
      && actual!.sourceChecksum === expected.source_checksum
      && isDeepStrictEqual(databaseJson.presetRenderConfig.read(actual!.renderConfig), expected.render_config), `ScenePreset mismatch ${expected.id}`);
  }
  mismatch(issues, scenes.length === source.counts.scenes, "Scene count mismatch");
  const sceneRows = new Map(scenes.map((row) => [row.id, row] as const));
  for (const expected of source.scenes) {
    const actual = sceneRows.get(expected.id);
    mismatch(issues, Boolean(actual) && actual!.chapterId === expected.chapter_id
      && actual!.startBlockId === expected.start_block_id && actual!.endBlockId === expected.end_block_id
      && actual!.basedOnPresetId === (expected.based_on_preset_id ?? null)
      && isDeepStrictEqual(databaseJson.sceneRenderConfig.read(actual!.renderConfig), expected.render_config), `Scene mismatch ${expected.id}`);
  }

  const definitionIds = definitions.map((row) => row.effectId).sort();
  mismatch(issues, isDeepStrictEqual(definitionIds, [...EFFECT_TYPES].sort()), "Effect manifest/overlay ID mismatch");
  const keywordRows = new Map(keywords.map((row) => [`${row.effectId}\0${row.normalizedKeyword}`, row] as const));
  mismatch(issues, keywordRows.size === source.counts.effectKeywords, "Effect keyword count mismatch");
  for (const expected of source.effectKeywords) {
    const actual = keywordRows.get(`${expected.effectId}\0${expected.normalizedKeyword}`);
    mismatch(issues, Boolean(actual) && actual!.keyword === expected.keyword && actual!.weight === expected.weight,
      `Effect keyword mismatch ${expected.effectId}:${expected.normalizedKeyword}`);
  }

  if (issues.length) throw new Error(`Phase 3 migration verification failed (${issues.length}): ${issues.slice(0, 12).join("; ")}`);
}

export async function runPhase3Migration(
  mode: Phase3MigrationMode,
  db: PrismaClient,
  source: Phase3MigrationSource,
  ownerId: string | undefined,
): Promise<void> {
  assertPhase3SourceClean(source);
  assertOwnerId(ownerId);
  if (mode === "dry-run") {
    await assertDatabasePreconditions(db, source, ownerId);
    return;
  }
  if (mode === "verify") {
    await verifyPhase3Migration(db, source, ownerId);
    return;
  }
  await db.$transaction((tx) => applyPhase3MigrationTransaction(tx, source, ownerId), { timeout: 120_000 });
}
