import "server-only";
import type { Scene } from "@/types/scene";
import type { StoryBlock } from "@/types/story";
import { buildBlockIndexMap, validateSceneRange } from "@/lib/scenes/sceneRange";
import { replaceContentSchema, replaceEditorSchema, replaceScenesSchema, editorDataSchema, chapterSchema, validateCommand } from "@/lib/validation/story-command-schema";
import type { ReplaceChapterContentCommand } from "./story-command-service";
import type { EditorCommandService, ReplaceEditorCommand, ReplaceChapterScenesCommand, SceneCommandService } from "./scene-command-service";
import type { AuthorizedStory } from "./story-command-context";
import { StoryCommandTransactions } from "./story-command-context";
import { CommandError } from "./command-error";

export function validateAggregate(chapterId: string, blocks: StoryBlock[], scenes: Scene[]) {
  const unique = (ids: string[]) => new Set(ids).size === ids.length;
  if (!unique(blocks.map((block) => block.id)) || !unique(blocks.flatMap((block) => block.effects.map((effect) => effect.id))) || !unique(scenes.map((scene) => scene.id))) {
    throw new CommandError(400, "DUPLICATE_CONTENT_ID", "Content IDs must be unique within the aggregate.");
  }
  const indexes = buildBlockIndexMap(blocks);
  const ranges = scenes.map((scene) => {
    const range = validateSceneRange(scene, indexes, blocks.length);
    if (scene.chapter_id !== chapterId || !range.valid) {
      throw new CommandError(400, "INVALID_SCENE_RANGE", "Every scene must reference blocks in this chapter in order.");
    }
    return range;
  }).sort((left, right) => left.startIndex - right.startIndex);
  if (ranges.some((range, index) => index > 0 && range.startIndex <= ranges[index - 1].endIndex)) {
    throw new CommandError(400, "SCENE_OVERLAP", "Scene ranges must not overlap.");
  }
}

export class PrismaSceneCommandService implements SceneCommandService, EditorCommandService {
  constructor(private readonly transactions = new StoryCommandTransactions()) {}

  private async replace(context: AuthorizedStory, chapterId: string, blocks?: StoryBlock[], scenes?: Scene[]) {
    const { repository, story, actor } = context;
    const currentChapter = await repository.getChapter(story.slug, chapterId);
    const currentScenes = await repository.getScenes(story.slug, chapterId);
    const nextBlocks = blocks ?? currentChapter.blocks;
    const nextScenes = scenes ?? currentScenes;
    validateAggregate(chapterId, nextBlocks, nextScenes);
    await repository.assertContentIds(chapterId, nextBlocks, nextScenes);
    const effects = (values: StoryBlock[], snapshots: Scene[]) => [
      ...values.flatMap((block) => block.effects), ...snapshots.flatMap((scene) => scene.render_config.ambient_effects),
    ];
    await repository.assertEffectReferences(actor.id, effects(nextBlocks, nextScenes), effects(currentChapter.blocks, currentScenes));
    await repository.assertPresetReferences(nextScenes, currentScenes);
    if (blocks !== undefined) await repository.replaceBlocks(chapterId, nextBlocks);
    if (scenes !== undefined) await repository.replaceScenes(chapterId, nextScenes);
    return editorDataSchema.parse({
      chapter: await repository.getChapter(story.slug, chapterId),
      scenes: await repository.getScenes(story.slug, chapterId),
    });
  }

  async replaceChapterContent(command: ReplaceChapterContentCommand) {
    const input = validateCommand(replaceContentSchema, command);
    return this.transactions.mutate(input, true, async (context) => {
      const aggregate = await this.replace(context, input.chapterId, input.blocks);
      return chapterSchema.parse(aggregate.chapter);
    });
  }
  async replaceChapterScenes(command: ReplaceChapterScenesCommand) {
    const input = validateCommand(replaceScenesSchema, command);
    return this.transactions.mutate(input, true, async (context) => {
      const aggregate = await this.replace(context, input.chapterId, undefined, input.scenes);
      return aggregate.scenes;
    });
  }
  async replaceEditor(command: ReplaceEditorCommand) {
    const input = validateCommand(replaceEditorSchema, command);
    return this.transactions.mutate(input, true, (context) => this.replace(context, input.chapterId, input.blocks, input.scenes));
  }
}
