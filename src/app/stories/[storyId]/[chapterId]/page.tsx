import Link from "next/link";
import { notFound } from "next/navigation";
import { storyRepository } from "@/lib/repositories";
import ReaderPane from "@/components/reader/ReaderPane";

interface ReaderPageProps {
  params: Promise<{ storyId: string; chapterId: string }>;
}

export default async function ReaderPage({ params }: ReaderPageProps) {
  const { storyId, chapterId } = await params;
  const story = await storyRepository.getById(storyId);

  if (!story) {
    notFound();
  }

  const chapter = story.chapters.find((ch) => ch.id === chapterId);
  if (!chapter) {
    notFound();
  }

  return (
    <div className="reader-screen min-h-screen">
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur border-b px-4 py-3 flex items-center justify-between">
        <Link href={`/stories/${story.id}`} className="text-sm text-muted-foreground hover:underline">
          ← {story.title}
        </Link>
        <span className="text-sm font-medium">{chapter.title}</span>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        <ReaderPane chapter={chapter} />
      </main>
    </div>
  );
}
