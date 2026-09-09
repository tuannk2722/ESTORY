"use client";

import React, { useEffect, useMemo, useRef } from "react";
import { Chapter } from "@/types/story";
import { Scene } from "@/types/scene";
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
import { getScenePreloadSources } from "@/lib/reader/scenePreload";
import { useSettingsSync } from "@/hooks/useSettingsSync";
import { settingsStore } from "@/lib/settingsStore";

export interface ReaderPaneProps {
  storyId: string;
  chapter: Chapter;
  prevChapterId?: string | null;
  nextChapterId?: string | null;
  isLastChapter?: boolean;
  scenes: Scene[];
  isPreview: boolean;
}

export default function ReaderPane({
  storyId,
  chapter,
  prevChapterId,
  nextChapterId,
  isLastChapter = false,
  scenes: chapterScenes,
  isPreview,
}: ReaderPaneProps) {
  const { settings, isMounted } = useReaderSettings();
  const sync = useSettingsSync();
  // SSR cannot know the OS preference. Keep the first frame static until the
  // provider has loaded client preferences, so reduced-motion readers never
  // download/mount looping media during hydration.
  const reducedMotion = !isMounted || Boolean(settings.reduced_motion);
  const contentRef = useRef<HTMLElement>(null);
  const reducedMotionRef = useRef(reducedMotion);
  const restoredScopeRef = useRef<number | undefined>(undefined);
  useEffect(() => {
    reducedMotionRef.current = reducedMotion;
  }, [reducedMotion]);

  const blockIndexMap = useMemo(
    () => buildBlockIndexMap(chapter.blocks),
    [chapter.blocks]
  );
  const sceneByBlockId = useMemo(
    () => buildSceneByBlockId(chapter.blocks, chapterScenes, blockIndexMap),
    [blockIndexMap, chapter.blocks, chapterScenes]
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
    if (!sync.ready || isPreview) return;
    const accountChanged = restoredScopeRef.current !== undefined && restoredScopeRef.current !== sync.scope;
    restoredScopeRef.current = sync.scope;
    let blockId: string | undefined;
    try { blockId = window.location.hash ? decodeURIComponent(window.location.hash.slice(1)) : undefined; } catch { return; }
    if (!blockId) {
      const progress = settingsStore.getProgress(storyId);
      blockId = progress?.chapter_id === chapter.id ? progress.block_id : accountChanged ? chapter.blocks[0]?.id : undefined;
    }
    if (!blockId || !chapter.blocks.some((block) => block.id === blockId)) return;
    const targetBlockId = blockId;
    const timer = window.setTimeout(
      () =>
        scrollToEditorBlock(targetBlockId, {
          reducedMotion: reducedMotionRef.current,
        }),
      300
    );
    return () => window.clearTimeout(timer);
  }, [chapter.id, chapter.blocks, storyId, sync.ready, sync.scope, isPreview]);

  const activeScene = activeBlockId
    ? sceneByBlockId.get(activeBlockId)?.scene || null
    : null;
  const activeRenderConfig = activeScene?.render_config ?? null;
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
    const { imageSource, videoSource } = getScenePreloadSources(nextScene.render_config.background, reducedMotion);
    const preloadImage = imageSource ? new Image() : null;
    if (preloadImage && imageSource) preloadImage.src = imageSource;

    const preloadVideo =
      videoSource ? document.createElement("video") : null;
    if (preloadVideo && videoSource) {
      preloadVideo.preload = "metadata";
      preloadVideo.muted = true;
      preloadVideo.src = videoSource;
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
    reducedMotion,
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
