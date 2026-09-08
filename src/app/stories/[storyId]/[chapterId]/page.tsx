import { notFound } from "next/navigation";
import { storyRepository } from "@/lib/repositories";
import ReaderPane from "@/components/reader/ReaderPane";
import ReaderScreenHeader from "@/components/reader/ReaderScreenHeader";
import ProgressBar from "@/components/reader/ProgressBar";

interface ReaderPageProps {
  params: Promise<{ storyId: string; chapterId: string }>;
}

export default async function ReaderPage({ params }: ReaderPageProps) {
  const { storyId, chapterId } = await params;
  const data = await storyRepository.getPublicChapter(storyId, chapterId);

  if (!data) {
    notFound();
  }

  const { story, chapter, scenes, previousChapterId, nextChapterId, isLastChapter } = data;

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
          prevChapterId={previousChapterId}
          nextChapterId={nextChapterId}
          isLastChapter={isLastChapter}
          scenes={scenes}
          isPreview={false}
        />
      </div>
    </div>
  );
}
