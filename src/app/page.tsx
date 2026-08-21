import Link from "next/link";
import { storyRepository } from "@/lib/repositories";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const stories = await storyRepository.getAll();

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Thư Viện Truyện</h1>
        <p className="text-muted-foreground mt-2">
          Đọc truyện tương tác với hiệu ứng thị giác và âm thanh sống động theo từng đoạn văn.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {stories.map((story) => (
          <Link
            key={story.id}
            href={`/stories/${story.id}`}
            className="block p-6 rounded-lg border border-border hover:border-primary transition-colors"
          >
            <h2 className="text-xl font-semibold">{story.title}</h2>
            <p className="text-sm text-muted-foreground mt-1">Tác giả: {story.author}</p>
            <p className="mt-3 text-sm line-clamp-2">{story.description}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {story.genre.map((g) => (
                <span
                  key={g}
                  className="px-2 py-0.5 text-xs rounded-full bg-secondary text-secondary-foreground"
                >
                  {g}
                </span>
              ))}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
