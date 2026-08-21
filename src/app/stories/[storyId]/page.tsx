import Link from "next/link";
import { notFound } from "next/navigation";
import { storyRepository } from "@/lib/repositories";

interface StoryDetailPageProps {
  params: Promise<{ storyId: string }>;
}

export default async function StoryDetailPage({ params }: StoryDetailPageProps) {
  const { storyId } = await params;
  const story = await storyRepository.getById(storyId);

  if (!story) {
    notFound();
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <nav className="mb-6">
        <Link href="/" className="text-sm text-muted-foreground hover:underline">
          ← Quay lại danh sách
        </Link>
      </nav>

      <header className="mb-8">
        <h1 className="text-3xl font-bold">{story.title}</h1>
        <p className="text-muted-foreground mt-1">Tác giả: {story.author}</p>
        <p className="mt-4 leading-relaxed">{story.description}</p>
      </header>

      <section>
        <h2 className="text-xl font-semibold mb-4">Mục Lục Chương</h2>
        <div className="space-y-3">
          {story.chapters.map((chapter) => (
            <Link
              key={chapter.id}
              href={`/stories/${story.id}/${chapter.id}`}
              className="flex items-center justify-between p-4 rounded-md border border-border hover:bg-accent transition-colors"
            >
              <span>{chapter.title}</span>
              <span className="text-sm text-muted-foreground">Đọc →</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
