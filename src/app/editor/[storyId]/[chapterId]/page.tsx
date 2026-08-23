// src/app/editor/[storyId]/[chapterId]/page.tsx
// Phase 2: Author Editor Screen (US-2.1 -> US-2.6)

import { notFound } from "next/navigation";
import { storyRepository } from "@/lib/repositories";
import EditorClient from "@/components/editor/EditorClient";

interface EditorPageProps {
  params: Promise<{ storyId: string; chapterId: string }>;
}

export default async function EditorPage({ params }: EditorPageProps) {
  const { storyId, chapterId } = await params;
  const story = await storyRepository.getById(storyId);

  if (!story) {
    notFound();
  }

  // Đảm bảo chapterId hợp lệ trong story
  const chapterExists = story.chapters.some((c) => c.id === chapterId);
  const targetChapterId = chapterExists ? chapterId : story.chapters[0]?.id || chapterId;

  return <EditorClient initialStory={story} chapterId={targetChapterId} />;
}
