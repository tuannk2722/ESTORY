import "server-only";
import type { Chapter } from "@/types/story";
import type { Scene } from "@/types/scene";
import { chapterAudioAssetIds, type AudioAttribution } from "@/lib/reader/audio-attribution";
import { loadRuntimePrismaClient } from "./prisma-read-client";
/** Only call after the StoryRepository public/authorized chapter boundary succeeds. */
export async function getChapterAudioAttributions(chapter: Chapter, scenes: Scene[]): Promise<AudioAttribution[]> {
  const ids = chapterAudioAssetIds(chapter, scenes);
  if (!ids.length) return [];
  const db = await loadRuntimePrismaClient();
  const rows = await db.audioAsset.findMany({ where: { id: { in: ids }, license: { not: "cc0" } }, select: {
    id: true, title: true, attributionAuthorName: true, attributionSourceUrl: true, attributionLicenseName: true,
  }, orderBy: { id: "asc" } });
  return rows.flatMap((row) => row.attributionAuthorName && row.attributionSourceUrl?.startsWith("https://freesound.org/") && row.attributionLicenseName ? [{
    id: row.id, title: row.title, author_name: row.attributionAuthorName, source_url: row.attributionSourceUrl, license_name: row.attributionLicenseName,
  }] : []);
}
