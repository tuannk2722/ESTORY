"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Chapter } from "@/types/story";
import {
  Scene,
  BackgroundAsset,
  ColorPalette,
} from "@/types/scene";
import StoryBlock from "./StoryBlock";
import ProgressBar from "./ProgressBar";
import ChapterNav from "./ChapterNav";
import SceneLayer from "../scenes/SceneLayer";
import { useResumeCommit } from "@/hooks/useResumeCommit";
import { useReaderSettings } from "@/components/ui/ThemeProvider";
import { STORY_FONT_OPTIONS } from "@/types/settings";

export interface ReaderPaneProps {
  storyId: string;
  chapter: Chapter;
  prevChapterId?: string | null;
  nextChapterId?: string | null;
  isLastChapter?: boolean;
  scenes?: Scene[];
  isPreview: string;
}

export default function ReaderPane({
  storyId,
  chapter,
  prevChapterId,
  nextChapterId,
  isLastChapter = false,
  scenes: initialScenes,
  isPreview
}: ReaderPaneProps) {
  const { settings } = useReaderSettings();
  const [activeBlockId, setActiveBlockId] = useState<string | null>(
    chapter.blocks[0]?.id || null
  );

  // Scene state and library cache
  const [chapterScenes, setChapterScenes] = useState<Scene[]>(initialScenes || []);
  const [backgrounds, setBackgrounds] = useState<BackgroundAsset[]>([]);
  const [palettes, setPalettes] = useState<ColorPalette[]>([]);

  // Sync initialScenes prop if updated from Editor
  useEffect(() => {
    if (initialScenes) {
      setChapterScenes(initialScenes);
    }
  }, [initialScenes]);

  // Fetch scenes and scene library if needed
  useEffect(() => {
    let isMounted = true;

    async function loadSceneData() {
      try {
        // Fetch library definitions (backgrounds, palettes)
        const libRes = await fetch("/api/scene-library");
        if (libRes.ok) {
          const libData = await libRes.json();
          if (isMounted) {
            setBackgrounds(libData.backgrounds || []);
            setPalettes(libData.palettes || []);
          }
        }

        // If scenes not passed directly via props or empty, fetch from API
        if (!initialScenes || initialScenes.length === 0) {
          const scenesRes = await fetch(`/api/scenes?chapterId=${chapter.id}`);
          if (scenesRes.ok) {
            const scenesData = await scenesRes.json();
            if (isMounted) {
              setChapterScenes(scenesData || []);
            }
          }
        }
      } catch (err) {
        console.error("Failed to load scene data in ReaderPane:", err);
      }
    }

    loadSceneData();

    return () => {
      isMounted = false;
    };
  }, [chapter.id, initialScenes]);

  const lastBlockId = chapter.blocks[chapter.blocks.length - 1]?.id;
  const isLastBlock = activeBlockId === lastBlockId;

  // Chỉ commit resume reading khi reader thực sự đọc đủ threshold (10s time hoặc 20% scroll)
  useResumeCommit({
    storyId,
    chapterId: chapter.id,
    activeBlockId,
    isLastChapter,
    isLastBlock,
  });

  // Tự động cuộn tới vị trí lưu trước đó (nếu có hash hoặc stored progress)
  useEffect(() => {
    if (typeof window !== "undefined" && window.location.hash) {
      const el = document.querySelector(window.location.hash);
      if (el) {
        setTimeout(() => {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 300);
      }
    }
  }, []);

  // Xác định Scene đang active theo activeBlockId (US-2.9)
  // Nếu block hiện tại không thuộc bất kỳ Scene nào -> trả về null (không tự động fallback về scene đầu tiên)
  const activeScene = useMemo(() => {
    if (chapterScenes.length === 0 || !activeBlockId) return null;

    const currentBlockIdx = chapter.blocks.findIndex((b) => b.id === activeBlockId);
    if (currentBlockIdx === -1) return null;

    const matched = chapterScenes.find((s) => {
      const sIdx = chapter.blocks.findIndex((b) => b.id === s.start_block_id);
      const eIdx = chapter.blocks.findIndex((b) => b.id === s.end_block_id);
      if (sIdx === -1 || eIdx === -1) return false;
      return (
        currentBlockIdx >= Math.min(sIdx, eIdx) &&
        currentBlockIdx <= Math.max(sIdx, eIdx)
      );
    });

    return matched || null;
  }, [activeBlockId, chapterScenes, chapter.blocks]);

  // Resolve assets cho active scene
  const activeBackground = useMemo(() => {
    if (!activeScene) return undefined;
    return backgrounds.find((b) => b.id === activeScene.background_id);
  }, [activeScene, backgrounds]);

  const activePalette = useMemo(() => {
    if (!activeScene) return undefined;
    return palettes.find((p) => p.id === activeScene.palette_id);
  }, [activeScene, palettes]);

  // Map font-size class theo thiết kế docs/04-ui-ux-design.md
  const fontSizeClass = `font-size-${settings.font_size || "lg"}`;
  const fontFamilyClass =
    STORY_FONT_OPTIONS.find((font) => font.id === settings.font_family)?.className ||
    "story-font-cormorant";

  const firstParagraphId = chapter.blocks.find((block) => block.type === "paragraph")?.id;

  return (
    <div className="reader-pane relative w-full min-h-screen">
      {/* 1. Thanh tiến trình cuộn trang trên đỉnh */}
      <ProgressBar />

      {/* 2. Wrapper SceneLayer (Bối cảnh nền, bảng màu, ambient audio) */}
      <SceneLayer
        scene={activeScene}
        backgroundAsset={activeBackground}
        colorPalette={activePalette}
        reducedMotion={settings.reduced_motion}
      >
        {/* Portal target cho toàn bộ visual effects — đảm bảo effect hiển thị đúng cả ở Reader và Preview Overlay */}
        <div id="effect-portal-root" className="pointer-events-none" />

        {/* Tiêu đề chương */}
        <header className="relative z-20 mb-12 text-center pt-6">
          <span className="font-ui text-xs font-semibold uppercase tracking-widest text-[var(--color-accent)]">
            {chapter.title.split(":")[0] || `Chương ${chapter.order}`}
          </span>
          <h1 className="font-display text-3xl md:text-5xl font-bold tracking-tight text-[#F8FAFC] mt-2">
            {chapter.title.includes(":") ? chapter.title.split(":")[1] : chapter.title}
          </h1>
        </header>

        {/* Khung đọc chính */}
        <main className={`relative z-20 prose-reader ${fontSizeClass}`}>
          {chapter.blocks.map((block) => {
            const isFirstP = block.id === firstParagraphId;
            return (
              <StoryBlock
                key={block.id}
                block={block}
                storyFontClass={fontFamilyClass}
                isFirstParagraph={isFirstP}
                onBlockVisible={setActiveBlockId}
              />
            );
          })}
        </main>

        {/* Điều hướng chương trước / sau */}
        {isPreview === "false" && (
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

