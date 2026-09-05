import fs from "node:fs/promises";
import path from "node:path";
import type { SceneRenderConfig } from "@/types/scene";

export function sceneMediaUrls(config: SceneRenderConfig): string[] {
  const background = config.background;
  return [...new Set([
    ...("media_url" in background.render_data ? [background.render_data.media_url] : []),
    ...(background.poster_frame ? [background.poster_frame] : []),
    ...config.ambient_effects.flatMap((effect) => effect.audio_src ? [effect.audio_src] : []),
  ])];
}

/** JSON adapter checks local files; migration must additionally verify remote media. */
export async function assertLocalSceneMedia(config: SceneRenderConfig, publicDirectory: string): Promise<void> {
  const root = path.resolve(publicDirectory);
  for (const url of sceneMediaUrls(config)) {
    if (!url.startsWith("/")) continue;
    const file = path.resolve(root, `.${decodeURIComponent(url.split(/[?#]/)[0])}`);
    const relative = path.relative(root, file);
    if (relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("Media path escapes public directory");
    const stat = await fs.stat(file).catch(() => null);
    if (!stat?.isFile()) throw new Error(`Missing local scene media: ${url}`);
  }
}
