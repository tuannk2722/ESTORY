"use client";

import dynamic from "next/dynamic";
import { ArrowLeft, Layers, ListOrdered, Loader2, Save } from "lucide-react";
import { Story } from "@/types/story";
import { LegacyScene as Scene, LegacySceneLibraryData as SceneLibraryData } from "@/types/scene-legacy";
import { EditorProvider } from "./EditorProvider";
import { useEditorClientController } from "./useEditorClientController";
import BlockEditor from "./blocks/BlockEditor";
import ScenePanel from "./scenes/ScenePanel";
import Timeline from "./timeline/Timeline";
import PreviewToggle from "./PreviewToggle";
import AppHeader from "@/components/ui/AppHeader";
import { EditorSheet } from "./shared/EditorSheet";
import ReaderScreenHeader from "@/components/reader/ReaderScreenHeader";

const ReaderPane = dynamic(() => import("@/components/reader/ReaderPane"), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
      Đang mở bản xem trước…
    </div>
  ),
});
const ScenePicker = dynamic(() => import("./scenes/picker/ScenePicker"), {
  ssr: false,
  loading: () => null,
});

const EMPTY_SCENE_LIBRARY: SceneLibraryData = {
  backgrounds: [],
  palettes: [],
  scenePresets: [],
};

export interface EditorClientProps {
  initialStory: Story;
  chapterId: string;
  initialScenes?: Scene[];
  initialRevision: string;
  sceneLibrary?: SceneLibraryData;
}

function EditorClientInner({
  story,
  sceneLibrary,
}: {
  story: Story;
  sceneLibrary: SceneLibraryData;
}) {
  const controller = useEditorClientController(story, sceneLibrary);
  const {
    state,
    commands,
    currentChapter,
    scenes,
    compactPanel,
    setCompactPanel,
    closeCompactPanel,
    scenePickerOpen,
    pickerRange,
    isSelectingRange,
    isScenePanelCollapsed,
    toggleDesktopScenePanel,
    isSaving,
    handleSave,
    handleReturn,
    openScenePicker,
    closeScenePicker,
    handleSaveScene,
    handleProceedSceneRange,
    handleDeleteBlock,
    handleMoveBlock,
    handleSelectEditorBlock,
  } = controller;

  const renderScenePanel = (compact: boolean) => (
    <ScenePanel
      scenes={scenes}
      blocks={currentChapter.blocks}
      activeBlockId={state.activeBlockId}
      onSelectBlock={commands.blocks.selectActive}
      onOpenScenePicker={openScenePicker}
      onDeleteScene={commands.scenes.deleteScene}
      isCollapsed={compact ? false : isScenePanelCollapsed}
      onToggleCollapse={compact ? closeCompactPanel : toggleDesktopScenePanel}
      isSelectingRange={isSelectingRange}
      onStartRangeSelection={commands.range.startRange}
      onCancelRangeSelection={commands.range.cancelRange}
      onProceedToCreate={handleProceedSceneRange}
      rangeStartId={state.range.startId}
      rangeEndId={state.range.endId}
      sceneLibrary={sceneLibrary}
    />
  );
  const timeline = (
    <Timeline
      blocks={currentChapter.blocks}
      activeBlockId={state.activeBlockId}
      onSelectBlock={commands.blocks.selectActive}
      scenes={scenes}
      isSelectingRange={isSelectingRange}
      onBlockClickInRangeSelection={commands.range.selectRangeBlock}
      rangeStartId={state.range.startId}
      rangeEndId={state.range.endId}
    />
  );

  return (
    <div className="editor-screen relative flex min-h-screen flex-col bg-background font-editor text-foreground">
      <AppHeader />
      <header className="mx-auto w-full max-w-[1536px] px-4 pb-2 pt-5 md:px-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={handleReturn}
              className="flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-border/60 text-muted-foreground shadow-xs transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none"
              aria-label="Về trang chi tiết truyện"
            >
              <ArrowLeft className="h-5 w-5" aria-hidden="true" />
            </button>
            <div className="min-w-0">
              <h1 className="truncate text-xl font-bold md:text-2xl">{story.title}</h1>
              <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>{currentChapter.title}</span><span aria-hidden="true">•</span>
                <span>{currentChapter.blocks.length} blocks</span><span aria-hidden="true">•</span>
                <span className="font-medium text-accent">{scenes.length} bối cảnh</span>
                {state.dirty && <span className="font-semibold text-amber-500">Có thay đổi chưa lưu</span>}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2 lg:hidden">
            <button
              type="button"
              onClick={() => setCompactPanel("scenes")}
              className="flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-xl border border-border bg-secondary px-3 text-xs font-semibold transition-colors hover:bg-secondary/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none"
              aria-label="Mở bảng Bối Cảnh"
            >
              <Layers className="h-4 w-4 text-primary" aria-hidden="true" />
              <span className="hidden md:inline">Bối Cảnh</span>
            </button>
            <button
              type="button"
              onClick={() => setCompactPanel("timeline")}
              className="flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-xl border border-border bg-secondary px-3 text-xs font-semibold transition-colors hover:bg-secondary/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none"
              aria-label="Mở Timeline chương"
            >
              <ListOrdered className="h-4 w-4 text-accent" aria-hidden="true" />
              <span className="hidden md:inline">Timeline</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1536px] flex-1 p-4 pb-48 md:p-6 md:pb-48">
        <div className="flex flex-col items-start gap-6 lg:flex-row">
          <aside className={`sticky top-20 z-20 hidden shrink-0 self-start transition-[width] duration-300 motion-reduce:transition-none lg:block ${isScenePanelCollapsed ? "w-14" : "w-72 xl:w-80"}`}>
            {renderScenePanel(false)}
          </aside>
          <div className="w-full min-w-0 flex-1">
            <BlockEditor
              blocks={currentChapter.blocks}
              activeBlockId={state.activeBlockId}
              onSelectBlock={handleSelectEditorBlock}
              onUpdateText={commands.blocks.updateText}
              onChangeType={commands.blocks.changeType}
              onInsertBlock={commands.blocks.insertBlock}
              onDeleteBlock={handleDeleteBlock}
              onMoveBlock={handleMoveBlock}
              onUpsertEffect={commands.blocks.upsertEffect}
              onDeleteEffect={commands.blocks.deleteEffect}
            />
          </div>
          <aside className={`sticky top-20 z-20 hidden shrink-0 self-start transition-[width] duration-300 motion-reduce:transition-none lg:block ${isScenePanelCollapsed ? "w-80 xl:w-96" : "w-64 xl:w-72"}`}>
            {timeline}
          </aside>
        </div>
      </main>

      {state.preview && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-[#05070F] animate-fade-in motion-reduce:animate-none">
          <ReaderScreenHeader
            storyId={story.id}
            storyTitle={story.title}
            chapterTitle={currentChapter.title}
            disableReturn
          />
          <div className="relative z-10 mx-auto w-full max-w-5xl px-4 py-8 md:py-12">
            <ReaderPane
              storyId={story.id}
              chapter={currentChapter}
              prevChapterId={null}
              nextChapterId={null}
              isLastChapter
              scenes={scenes}
              sceneLibrary={sceneLibrary}
              isPreview
            />
          </div>
        </div>
      )}
      <div className="fixed bottom-6 left-1/2 z-[60] flex max-w-[95vw] -translate-x-1/2 items-center gap-2 rounded-2xl border border-border bg-card/95 p-2 shadow-2xl backdrop-blur-xl sm:gap-3">
        <PreviewToggle isPreview={state.preview} onToggle={commands.preview.togglePreview} />
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving || !state.dirty}
          className="flex min-h-11 items-center gap-2 rounded-xl bg-editor-action px-3 py-2 text-sm font-semibold text-editor-action-foreground shadow-md transition-colors hover:bg-editor-action-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none sm:px-5"
        >
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <Save className="h-4 w-4" aria-hidden="true" />}
          <span className="hidden sm:inline">{isSaving ? "Đang lưu…" : "Lưu Thay Đổi"}</span>
          <span className="sm:hidden">Lưu</span>
        </button>
      </div>

      <EditorSheet isOpen={compactPanel === "scenes"} onClose={closeCompactPanel} title="Bối Cảnh Chương" position="left">
        {renderScenePanel(true)}
      </EditorSheet>
      <EditorSheet isOpen={compactPanel === "timeline"} onClose={closeCompactPanel} title="Timeline Chương" position="right">
        {timeline}
      </EditorSheet>
      {scenePickerOpen && pickerRange && (
        <ScenePicker
          isOpen
          onClose={closeScenePicker}
          onSaveScene={handleSaveScene}
          chapterId={currentChapter.id}
          startBlockId={pickerRange.startBlockId}
          endBlockId={pickerRange.endBlockId}
          blocks={currentChapter.blocks}
          initialScene={pickerRange.sceneToEdit}
          sceneLibrary={sceneLibrary}
        />
      )}
    </div>
  );
}

export default function EditorClient({ initialStory, chapterId, initialScenes = [], initialRevision, sceneLibrary = EMPTY_SCENE_LIBRARY }: EditorClientProps) {
  const chapter = initialStory.chapters.find((item) => item.id === chapterId);
  if (!chapter) return <div className="p-8 text-center text-muted-foreground">Không tìm thấy chương truyện này.</div>;
  return (
    <EditorProvider
      initialChapter={chapter}
      initialScenes={initialScenes}
      initialRevision={initialRevision}
    >
      <EditorClientInner story={initialStory} sceneLibrary={sceneLibrary} />
    </EditorProvider>
  );
}
