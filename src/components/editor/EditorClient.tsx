// components/editor/EditorClient.tsx
// Phase 2: Client Component quản lý trạng thái soạn thảo, lưu API và Preview (US-2.1 -> US-2.6)
"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Story, StoryBlock } from "@/types/story";
import BlockEditor from "./BlockEditor";
import PreviewToggle from "./PreviewToggle";
import ReaderPane from "@/components/reader/ReaderPane";
import AppHeader from "@/components/ui/AppHeader";
import {
  Save,
  ArrowLeft,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import Timeline from "./Timeline";

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
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Tìm chapter đang chỉnh sửa
  const currentChapter =
    story.chapters.find((c) => c.id === chapterId) || story.chapters[0];

  // Callback cập nhật blocks của chapter hiện tại
  const handleUpdateBlocks = (newBlocks: StoryBlock[]) => {
    const updatedChapters = story.chapters.map((ch) => {
      if (ch.id === currentChapter.id) {
        return { ...ch, blocks: newBlocks };
      }
      return ch;
    });

    setStory({ ...story, chapters: updatedChapters });
  };

  // Lưu nội dung qua Route Handler (US-2.6)
  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/stories/${story.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(story),
      });

      if (!res.ok) {
        throw new Error("Lỗi khi lưu truyện.");
      }

      toast.success("Đã lưu nội dung thành công!");
    } catch {
      toast.error("Không thể lưu truyện. Vui lòng thử lại.", { duration: 6000 });
    } finally {
      setIsSaving(false);
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
      {/* 1. App Header (Navbar toàn hệ thống) */}
      <AppHeader />

      {/* 2. Story & Chapter Header */}
      <div className="max-w-7xl w-full mx-auto px-4 md:px-6 pt-6 pb-2">
        <div className="flex items-center gap-3">
          <Link
            href={`/stories/${story.id}`}
            className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer border border-border/60 shadow-xs"
            title="Về trang chi tiết truyện"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-editor font-bold text-xl md:text-2xl text-foreground line-clamp-1">
                {story.title}
              </h1>
            </div>
            <p className="text-xs text-muted-foreground font-editor mt-0.5">
              {currentChapter.title} • {currentChapter.blocks.length} blocks
            </p>
          </div>
        </div>
      </div>

      {/* 3. Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 pb-28">
        {isPreview ? (
          /* Live Preview Mode (US-2.5) */
          <div className="preview-container border border-border/80 rounded-2xl bg-card/60 p-4 md:p-8 shadow-2xl relative">

            <ReaderPane
              storyId={story.id}
              chapter={currentChapter}
              prevChapterId={null}
              nextChapterId={null}
              isLastChapter={true}
            />
          </div>
        ) : (
          /* Edit Mode (US-2.1 -> US-2.4) */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left/Center Column: Block Editor (8 cols) */}
            <div className="lg:col-span-8">
              <BlockEditor
                chapterId={currentChapter.id}
                blocks={currentChapter.blocks}
                onUpdateBlocks={handleUpdateBlocks}
                activeBlockId={activeBlockId}
                onSelectBlock={setActiveBlockId}
              />
            </div>

            {/* Right Column: Effect Timeline Sidebar (4 cols) */}
            <div className="hidden lg:block lg:col-span-4">
              <Timeline
                blocks={currentChapter.blocks}
                activeBlockId={activeBlockId}
                onSelectBlock={setActiveBlockId}
              />
            </div>
          </div>
        )}
      </main>

      {/* 4. Floating Action Dock */}
      <div
        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 p-2 bg-card/95 backdrop-blur-xl border border-border rounded-2xl shadow-2xl max-w-[95vw] animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Preview Toggle */}
        <PreviewToggle isPreview={isPreview} onToggle={setIsPreview} />

        {/* Save Button */}
        <button
          type="button"
          onClick={handleSave}
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
    </div>
  );
}
