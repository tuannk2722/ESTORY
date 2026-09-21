import type { Chapter } from "@/types/story";
import type { Scene } from "@/types/scene";
export function chapterAudioAssetIds(chapter: Chapter, scenes: Scene[]): string[] {
  return [...new Set([
    ...chapter.blocks.flatMap((block) => block.effects),
    ...scenes.flatMap((scene) => scene.render_config.ambient_effects),
  ].flatMap((effect) => effect.type === "audio" && effect.audio_asset_id ? [effect.audio_asset_id] : []))];
}
export interface AudioAttribution { id: string; title: string; author_name: string; source_url: string; license_name: string }
