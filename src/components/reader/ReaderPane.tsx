"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Chapter } from "@/types/story";
import { LegacyScene as Scene, LegacySceneLibraryData as SceneLibraryData } from "@/types/scene-legacy";
import { buildBlockIndexMap } from "@/lib/scenes/sceneRange";
import { buildSceneByBlockId } from "@/lib/scenes/sceneSelectors";
import { scrollToEditorBlock } from "@/lib/editor/scrollToBlock";
import StoryBlock from "./StoryBlock";
import ChapterNav from "./ChapterNav";
import SceneLayer from "../scenes/SceneLayer";
import { useResumeCommit } from "@/hooks/useResumeCommit";
import { useActiveReaderBlock } from "@/hooks/useActiveReaderBlock";
import { useReaderSettings } from "@/components/ui/ThemeProvider";
import { STORY_FONT_OPTIONS } from "@/types/settings";
import { resolveLegacyScene } from "@/lib/scenes/scene-mappers";

const EMPTY_LIBRARY: SceneLibraryData = {
  backgrounds: [],
  palettes: [],
  scenePresets: [],
};

export interface ReaderPaneProps {
  storyId: string;
  chapter: Chapter;
  prevChapterId?: string | null;
  nextChapterId?: string | null;
  isLastChapter?: boolean;
  scenes?: Scene[];
  sceneLibrary?: SceneLibraryData;
  isPreview: boolean;
}

export default function ReaderPane({
  storyId,
  chapter,
  prevChapterId,
  nextChapterId,
  isLastChapter = false,
  scenes: suppliedScenes,
  sceneLibrary: suppliedLibrary,
  isPreview,
}: ReaderPaneProps) {
  const { settings } = useReaderSettings();
  const reducedMotion = Boolean(settings.reduced_motion);
  const contentRef = useRef<HTMLElement>(null);
  const reducedMotionRef = useRef(reducedMotion);
  const [fetchedScenes, setFetchedScenes] = useState<Scene[]>([]);
  const [fetchedLibrary, setFetchedLibrary] =
    useState<SceneLibraryData>(EMPTY_LIBRARY);

  useEffect(() => {
    reducedMotionRef.current = reducedMotion;
  }, [reducedMotion]);

  useEffect(() => {
    if (suppliedScenes !== undefined && suppliedLibrary !== undefined) return;
    const controller = new AbortController();     // Hủy fetch an toàn nếu user chuyển chương nhanh hoặc thoát trang

    const requests: Promise<void>[] = [];
    if (suppliedLibrary === undefined) {
      requests.push(
        fetch("/api/scene-library", { signal: controller.signal })
          .then((response) => {
            if (!response.ok) throw new Error("Không thể tải thư viện Scene");
            return response.json() as Promise<SceneLibraryData>;
          })
          .then(setFetchedLibrary)
      );
    }
    if (suppliedScenes === undefined) {
      requests.push(
        fetch(
          `/api/scenes?storyId=${encodeURIComponent(storyId)}&chapterId=${encodeURIComponent(chapter.id)}`,
          {
            signal: controller.signal,
          }
        )
          .then((response) => {
            if (!response.ok) throw new Error("Không thể tải Scene của chương");
            return response.json() as Promise<Scene[]>;
          })
          .then(setFetchedScenes)
      );
    }

    Promise.all(requests).catch((error: unknown) => {
      if (error instanceof DOMException && error.name === "AbortError") return;
      console.error("Failed to load scene data in ReaderPane:", error);
    });
    return () => controller.abort();
  }, [chapter.id, storyId, suppliedLibrary, suppliedScenes]);

  const chapterScenes = suppliedScenes ?? fetchedScenes;
  const sceneLibrary = suppliedLibrary ?? fetchedLibrary;
  const blockIndexMap = useMemo(
    () => buildBlockIndexMap(chapter.blocks),
    [chapter.blocks]
  );
  const sceneByBlockId = useMemo(
    () => buildSceneByBlockId(chapter.blocks, chapterScenes, blockIndexMap),
    [blockIndexMap, chapter.blocks, chapterScenes]
  );
  const backgroundMap = useMemo(
    () =>
      new Map(
        sceneLibrary.backgrounds.map((background) => [background.id, background])
      ),
    [sceneLibrary.backgrounds]
  );
  const paletteMap = useMemo(
    () => new Map(sceneLibrary.palettes.map((palette) => [palette.id, palette])),
    [sceneLibrary.palettes]
  );
  const blockIds = useMemo(
    () => chapter.blocks.map((block) => block.id),
    [chapter.blocks]
  );
  const activeBlockId = useActiveReaderBlock(
    contentRef,
    blockIds,
    chapter.blocks[0]?.id ?? null
  );

  const lastBlockId = chapter.blocks[chapter.blocks.length - 1]?.id;
  useResumeCommit({
    storyId,
    chapterId: chapter.id,
    activeBlockId,
    isLastChapter,
    isLastBlock: activeBlockId === lastBlockId,
    isPaused: isPreview,
  });

  useEffect(() => {
    if (!window.location.hash) return;
    const blockId = decodeURIComponent(window.location.hash.slice(1));
    const timer = window.setTimeout(
      () =>
        scrollToEditorBlock(blockId, {
          reducedMotion: reducedMotionRef.current,
        }),
      300
    );
    return () => window.clearTimeout(timer);
  }, [chapter.id]);

  const activeScene = activeBlockId
    ? sceneByBlockId.get(activeBlockId)?.scene || null
    : null;
  const activeRenderConfig = useMemo(
    () => {
      if (!activeScene) return null;
      const background = backgroundMap.get(activeScene.background_id);
      const palette = paletteMap.get(activeScene.palette_id);
      // Client-side legacy fetches complete independently. Wait until both
      // ingredients are present before resolving the runtime snapshot.
      if (!background || !palette) return null;
      return resolveLegacyScene(activeScene, [background], [palette]).render_config;
    },
    [activeScene, backgroundMap, paletteMap]
  );
  const fontSizeClass = `font-size-${settings.font_size || "lg"}`;
  const fontFamilyClass =
    STORY_FONT_OPTIONS.find((font) => font.id === settings.font_family)?.className ||
    "story-font-cormorant";
  const firstParagraphId = chapter.blocks.find(
    (block) => block.type === "paragraph"
  )?.id;

  useEffect(() => {
    if (!activeBlockId) return;
    const activeIndex = blockIndexMap.get(activeBlockId);
    if (activeIndex === undefined) return;
    const nextBlock = chapter.blocks[activeIndex + 1];
    if (!nextBlock) return;
    const nextScene = sceneByBlockId.get(nextBlock.id)?.scene;
    if (!nextScene || nextScene.id === activeScene?.id) return;
    const nextBackground = backgroundMap.get(nextScene.background_id);
    if (!nextBackground) return;

    // Preload đúng một Scene trước boundary để giữ crossfade mượt mà mà không
    // tải toàn bộ media của chapter cùng lúc.
    const imageSource =
      nextBackground.type === "video"
        ? nextBackground.poster_frame
        : nextBackground.type === "image"
          ? nextBackground.value
          : undefined;
    const preloadImage = imageSource ? new Image() : null;
    if (preloadImage && imageSource) preloadImage.src = imageSource;

    const preloadVideo =
      nextBackground.type === "video" ? document.createElement("video") : null;
    if (preloadVideo) {
      preloadVideo.preload = "metadata";
      preloadVideo.muted = true;
      preloadVideo.src = nextBackground.value;
      preloadVideo.load();
    }

    return () => {
      if (preloadVideo) {
        preloadVideo.removeAttribute("src");
        preloadVideo.load();
      }
    };
  }, [
    activeBlockId,
    activeScene?.id,
    backgroundMap,
    blockIndexMap,
    chapter.blocks,
    sceneByBlockId,
  ]);

  return (
    <div className="reader-pane relative w-full min-h-screen">
      <SceneLayer
        renderConfig={activeRenderConfig}
        reducedMotion={reducedMotion}
      >
        <div id="effect-portal-root" className="pointer-events-none" />
        <header className="relative z-20 mb-12 text-center pt-6">
          <span className="font-ui text-xs font-semibold uppercase tracking-widest text-[var(--color-accent)]">
            {chapter.title.split(":")[0] || `Chương ${chapter.order}`}
          </span>
          <h1 className="font-display text-3xl md:text-5xl font-bold tracking-tight text-[#F8FAFC] mt-2">
            {chapter.title.includes(":")
              ? chapter.title.split(":")[1]
              : chapter.title}
          </h1>
        </header>

        <main
          ref={contentRef}
          className={`relative z-20 prose-reader ${fontSizeClass}`}
        >
          {chapter.blocks.map((block) => (
            <StoryBlock
              key={block.id}
              block={block}
              storyFontClass={fontFamilyClass}
              isFirstParagraph={block.id === firstParagraphId}
              isActive={block.id === activeBlockId}
              reducedMotion={reducedMotion}
            />
          ))}
        </main>

        {!isPreview && (
          <div className="max-w-2xl mx-auto px-4 mt-12">
            <ChapterNav
              storyId={storyId}
              prevChapterId={prevChapterId}
              nextChapterId={nextChapterId}
            />
          </div>
        )}
      </SceneLayer>
    </div>
  );
}
