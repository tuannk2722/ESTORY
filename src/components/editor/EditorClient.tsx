// components/editor/EditorClient.tsx
// Phase 2: Client Component điều phối Editor — story state, preview toggle, layout 3 vùng (US-2.1 -> US-2.9)
// Scene logic → useSceneManager | Save logic → useStorySaver (09-non-functional-requirements.md: <300 dòng)
"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Story, StoryBlock } from "@/types/story";
import BlockEditor from "./BlockEditor";
import PreviewToggle from "./PreviewToggle";
import ReaderPane from "@/components/reader/ReaderPane";
import AppHeader from "@/components/ui/AppHeader";
import ScenePicker from "./ScenePicker";
import ScenePanel from "./ScenePanel";
import Timeline from "./Timeline";
import { useSceneManager } from "@/hooks/useSceneManager";
import { useStorySaver } from "@/hooks/useStorySaver";
import { useConfirm } from "@/components/ui/ConfirmModal";
import { Save, ArrowLeft, Loader2, Layers } from "lucide-react";

export interface EditorClientProps {
  initialStory: Story;
  chapterId: string;
}

export default function EditorClient({
  initialStory,
  chapterId,
}: EditorClientProps) {
  const [story, setStory] = useState<Story>(initialStory);
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);
  const [isPreview, setIsPreview] = useState<boolean>(false);

  // Scene Panel Collapsible state
  const [isScenePanelCollapsed, setIsScenePanelCollapsed] = useState<boolean>(false);

  // Range selection state (cho phép chọn dải block đồng bộ giữa ScenePanel và Timeline)
  const [isSelectingRange, setIsSelectingRange] = useState<boolean>(false);
  const [rangeStartId, setRangeStartId] = useState<string | null>(null);
  const [rangeEndId, setRangeEndId] = useState<string | null>(null);

  const confirm = useConfirm();
  const router = useRouter();

  const handleReturn = async () => {
    const ok = await confirm({
      title: "Rời khỏi trang soạn thảo?",
      description: "Bạn có chắc chắn muốn quay về trang chi tiết truyện?",
      variant: "warning",
      confirmText: "Rời đi",
      cancelText: "Ở lại tiếp tục",
    });
    if (ok) {
      router.push(`/stories/${story.id}`);
    }
  };

  // Tìm chapter đang chỉnh sửa
  const currentChapter =
    story.chapters.find((c) => c.id === chapterId) || story.chapters[0];

  // Scene management (US-2.7, US-2.8) — tách ra hook để giữ file này gọn
  const {
    scenes,
    scenePickerOpen,
    pickerRange,
    openScenePicker,
    closeScenePicker,
    handleSaveScene,
    handleDeleteScene,
  } = useSceneManager(currentChapter ?? null);

  // Save story (US-2.6) — tách ra hook
  const { isSaving, handleSave } = useStorySaver();

  // Cập nhật blocks của chapter hiện tại
  const handleUpdateBlocks = (newBlocks: StoryBlock[]) => {
    if (!currentChapter) return;
    setStory((prev) => ({
      ...prev,
      chapters: prev.chapters.map((ch) =>
        ch.id === currentChapter.id ? { ...ch, blocks: newBlocks } : ch
      ),
    }));
  };

  // Range selection click handler (tương tác khi click block trong Timeline hoặc BlockEditor)
  const handleBlockClickInRangeSelection = (blockId: string) => {
    if (!rangeStartId) {
      // Click 1: Chọn block bắt đầu
      setRangeStartId(blockId);
      setRangeEndId(null);
    } else if (rangeStartId && !rangeEndId) {
      // Click 2: Chọn block kết thúc
      setRangeEndId(blockId);
    } else {
      // Đã có cả start và end -> Click mới để chọn lại dải mới bắt đầu từ block này
      setRangeStartId(blockId);
      setRangeEndId(null);
    }
  };

  if (!currentChapter) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Không tìm thấy chương truyện này.
      </div>
    );
  }

  return (
    <div
      className="editor-screen font-editor min-h-screen bg-background text-foreground flex flex-col relative"
      onClick={() => setActiveBlockId(null)}
    >
      {/* 1. App Header */}
      <AppHeader />

      {/* 2. Story & Chapter Header */}
      <div className="max-w-[1536px] w-full mx-auto px-4 md:px-6 pt-5 pb-2">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleReturn}
              className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer border border-border/60 shadow-xs"
              title="Về trang chi tiết truyện"
              aria-label="Về trang chi tiết truyện"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>

            <div>
              <h1 className="font-editor font-bold text-xl md:text-2xl text-foreground line-clamp-1">
                {story.title}
              </h1>
              <p className="text-xs text-muted-foreground font-editor mt-0.5 flex items-center gap-2">
                <span>{currentChapter.title}</span>
                <span>•</span>
                <span>{currentChapter.blocks.length} blocks</span>
                <span>•</span>
                <span className="text-accent font-medium">{scenes.length} bối cảnh</span>
              </p>
            </div>
          </div>

          {/* Quick Toggle for Scene Panel on Medium screens */}
          <button
            type="button"
            onClick={() => setIsScenePanelCollapsed((prev) => !prev)}
            className="hidden md:flex lg:hidden items-center gap-1.5 px-3 py-2 rounded-xl bg-secondary hover:bg-secondary/80 border border-border text-xs font-semibold text-foreground transition-colors cursor-pointer"
          >
            <Layers className="w-4 h-4 text-primary" />
            <span>{isScenePanelCollapsed ? "Hiện Bối Cảnh" : "Ẩn Bối Cảnh"}</span>
          </button>
        </div>
      </div>

      {/* 3. Main Edit Area — 3 Column Layout (Left: ScenePanel, Center: BlockEditor, Right: Timeline) */}
      <main className="flex-1 max-w-[1536px] w-full mx-auto p-4 md:p-6 pb-28">
        <div className="flex flex-col lg:flex-row gap-6 items-start">
          {/* Cột 1: ScenePanel (Quản lý Bối Cảnh Scene bên trái — Sticky cố định khi cuộn) */}
          <div
            className={`hidden lg:block sticky top-20 transition-all duration-300 shrink-0 self-start z-20 ${isScenePanelCollapsed ? "w-14" : "w-72 xl:w-80"
              }`}
          >
            <ScenePanel
              scenes={scenes}
              blocks={currentChapter.blocks}
              activeBlockId={activeBlockId}
              onSelectBlock={setActiveBlockId}
              onOpenScenePicker={openScenePicker}
              onDeleteScene={handleDeleteScene}
              isCollapsed={isScenePanelCollapsed}
              onToggleCollapse={() => setIsScenePanelCollapsed((prev) => !prev)}
              isSelectingRange={isSelectingRange}
              setIsSelectingRange={setIsSelectingRange}
              rangeStartId={rangeStartId}
              setRangeStartId={setRangeStartId}
              rangeEndId={rangeEndId}
              setRangeEndId={setRangeEndId}
            />
          </div>

          {/* Cột 2: Block Editor (Soạn thảo & gắn hiệu ứng trung tâm) */}
          <div className="flex-1 min-w-0 w-full">
            <BlockEditor
              chapterId={currentChapter.id}
              blocks={currentChapter.blocks}
              onUpdateBlocks={handleUpdateBlocks}
              activeBlockId={activeBlockId}
              onSelectBlock={(blockId) => {
                if (isSelectingRange && blockId) {
                  handleBlockClickInRangeSelection(blockId);
                } else {
                  setActiveBlockId(blockId);
                }
              }}
            />
          </div>

          {/* Cột 3: Timeline Sidebar (Điều hướng block toàn chương bên phải — Tự động mở rộng khi cột Scene thu gọn) */}
          <div
            className={`hidden lg:block sticky top-20 transition-all duration-300 shrink-0 self-start z-20 ${isScenePanelCollapsed ? "w-80 xl:w-96" : "w-64 xl:w-72"
              }`}
          >
            <Timeline
              blocks={currentChapter.blocks}
              activeBlockId={activeBlockId}
              onSelectBlock={setActiveBlockId}
              scenes={scenes}
              isSelectingRange={isSelectingRange}
              onBlockClickInRangeSelection={handleBlockClickInRangeSelection}
              rangeStartId={rangeStartId}
              rangeEndId={rangeEndId}
            />
          </div>
        </div>
      </main>

      {/* 5. Preview: Full-screen overlay (US-2.5, US-2.9, docs/04b-page-layouts.md mục 5.5) */}
      {isPreview && (
        <div className="fixed inset-0 z-50 bg-[#05070F] overflow-y-auto animate-fade-in">
          <ReaderPane
            storyId={story.id}
            chapter={currentChapter}
            prevChapterId={null}
            nextChapterId={null}
            isLastChapter={true}
            scenes={scenes}
            isPreview="true"
          />
        </div>
      )}

      {/* 4. Floating Action Dock — luôn hiển thị nổi (z-[60]) trên cả chế độ Preview để chuyển đổi qua lại và lưu */}
      <div
        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-3 p-2 bg-card/95 backdrop-blur-xl border border-border rounded-2xl shadow-2xl max-w-[95vw] animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        <PreviewToggle isPreview={isPreview} onToggle={setIsPreview} />

        <button
          type="button"
          onClick={() => handleSave(story)}
          disabled={isSaving}
          className="px-5 py-2 rounded-xl bg-editor-action hover:bg-editor-action-hover text-editor-action-foreground font-editor font-semibold text-sm flex items-center gap-2 transition-all shadow-md cursor-pointer disabled:opacity-50 min-h-[44px]"
        >
          {isSaving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Đang lưu...</span>
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              <span>Lưu Thay Đổi</span>
            </>
          )}
        </button>
      </div>

      {/* 6. ScenePicker Modal (US-2.7, US-2.8) */}
      {scenePickerOpen && (
        <ScenePicker
          isOpen={scenePickerOpen}
          onClose={closeScenePicker}
          onSaveScene={handleSaveScene}
          chapterId={currentChapter.id}
          startBlockId={pickerRange.startBlockId}
          endBlockId={pickerRange.endBlockId}
          blocks={currentChapter.blocks}
          initialScene={pickerRange.sceneToEdit}
        />
      )}
    </div>
  );
}

