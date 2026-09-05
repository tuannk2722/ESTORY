// src/app/author/stories/[storyId]/[chapterId]/page.tsx
// Phase 2: Author Content Editor Screen — Parallel Bootstrap Loading (US-2.1 -> US-2.9)

import { notFound, redirect } from "next/navigation";
import {
  storyRepository,
  sceneRepository,
  sceneLibraryRepository,
} from "@/lib/repositories";
import EditorClient from "@/components/editor/EditorClient";
import { createEditorRevision } from "@/services/editorService";


interface EditorPageProps {
  params: Promise<{ storyId: string; chapterId: string }>;
}

export default async function EditorPage({ params }: EditorPageProps) {
  const { storyId, chapterId } = await params;

  // 1. Tải Story trước để xác thực sự tồn tại và danh sách chapters
  const story = await storyRepository.getById(storyId);
  if (!story) {
    notFound();
  }

  // 2. Tìm chapter hợp lệ trong story
  const targetChapter = story.chapters.find((c) => c.id === chapterId);
  if (!targetChapter) {
    // Nếu chapterId trong URL không tồn tại (ví dụ gõ nhầm 'ch1' cho truyện Sơn Tinh Thủy Tinh có chapter 'ch-son-tinh'),
    // tự động chuyển hướng về chapter đầu tiên hợp lệ của truyện thay vì nạp nhầm scenes của chapter khác
    if (story.chapters.length > 0) {
      redirect(`/author/stories/${storyId}/${story.chapters[0].id}`);
    }
    notFound();
  }

  // 3. Preload song song Scenes đúng của targetChapter và Thư viện mẫu Scene
  const [scenes, backgrounds, palettes, scenePresets] = await Promise.all([
    sceneRepository.getLegacyByChapter(storyId, targetChapter.id),
    sceneLibraryRepository.getBackgrounds(),
    sceneLibraryRepository.getPalettes(),
    sceneLibraryRepository.getScenePresets(),
  ]);

  return (
    <EditorClient
      initialStory={story}
      chapterId={targetChapter.id}
      initialScenes={scenes || []}
      initialRevision={createEditorRevision(targetChapter, scenes || [])}
      sceneLibrary={{
        backgrounds: backgrounds || [],
        palettes: palettes || [],
        scenePresets: scenePresets || [],
      }}
    />
  );
}
