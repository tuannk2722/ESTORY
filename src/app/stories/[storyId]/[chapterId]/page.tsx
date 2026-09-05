import { notFound } from "next/navigation";
import {
  sceneLibraryRepository,
  sceneRepository,
  storyRepository,
} from "@/lib/repositories";
import ReaderPane from "@/components/reader/ReaderPane";
import ReaderScreenHeader from "@/components/reader/ReaderScreenHeader";
import ProgressBar from "@/components/reader/ProgressBar";

interface ReaderPageProps {
  params: Promise<{ storyId: string; chapterId: string }>;
}

export default async function ReaderPage({ params }: ReaderPageProps) {
  const { storyId, chapterId } = await params;
  const story = await storyRepository.getPublicById(storyId);

  if (!story) {
    notFound();
  }

  // Sắp xếp các chương theo thứ tự order
  const sortedChapters = [...story.chapters].sort((a, b) => a.order - b.order);
  const currentChapterIndex = sortedChapters.findIndex((ch) => ch.id === chapterId);

  if (currentChapterIndex === -1) {
    notFound();
  }

  const chapter = sortedChapters[currentChapterIndex];
  const prevChapter = currentChapterIndex > 0 ? sortedChapters[currentChapterIndex - 1] : null;
  const nextChapter =
    currentChapterIndex < sortedChapters.length - 1
      ? sortedChapters[currentChapterIndex + 1]
      : null;
  const isLastChapter = currentChapterIndex === sortedChapters.length - 1;
  const [scenes, backgrounds, palettes] = await Promise.all([
    sceneRepository.getLegacyByChapter(storyId, chapter.id),
    sceneLibraryRepository.getBackgrounds(),
    sceneLibraryRepository.getPalettes(),
  ]);

  return (
    <div className="reader-screen min-h-screen bg-[#05070F] text-[#F8FAFC] transition-colors duration-300">

      <ProgressBar />

      {/* Header thanh công cụ đọc */}
      <ReaderScreenHeader
        storyId={story.id}
        storyTitle={story.title}
        chapterTitle={chapter.title}
      />

      {/* Khung đọc chính */}
      <div className="relative z-10 w-full max-w-5xl mx-auto px-4 py-8 md:py-12">
        <ReaderPane
          storyId={story.id}
          chapter={chapter}
          prevChapterId={prevChapter?.id}
          nextChapterId={nextChapter?.id}
          isLastChapter={isLastChapter}
          scenes={scenes}
          sceneLibrary={{ backgrounds, palettes, scenePresets: [] }}
          isPreview={false}
        />
      </div>
    </div>
  );
}
