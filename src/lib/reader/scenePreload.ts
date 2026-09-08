import type { BackgroundRenderSnapshot } from "@/types/scene";

/** Only the next Scene's media; reduced motion never requests a looping video. */
export function getScenePreloadSources(background: BackgroundRenderSnapshot, reducedMotion: boolean) {
  const data = background.render_data;
  if (reducedMotion && background.motion === "looping") {
    return { imageSource: background.poster_frame, videoSource: undefined };
  }
  return {
    imageSource: data.kind === "image" ? data.media_url : background.poster_frame,
    videoSource: data.kind === "video" ? data.media_url : undefined,
  };
}
