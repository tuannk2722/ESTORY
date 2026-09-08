import { sceneLibraryRepository } from "@/lib/repositories";
import EditorClient from "@/components/editor/EditorClient";
import { requirePageStoryAccess } from "@/lib/auth/page-guards";
import { StoryDataAccess } from "@/lib/services/story-dal";
import { CommandError } from "@/lib/services/command-error";
import { notFound } from "next/navigation";

interface EditorPageProps {
  params: Promise<{ storyId: string; chapterId: string }>;
}

export default async function EditorPage({ params }: EditorPageProps) {
  const { storyId, chapterId } = await params;
  const session = await requirePageStoryAccess(storyId, chapterId, `/author/stories/${encodeURIComponent(storyId)}/${encodeURIComponent(chapterId)}`);
  const dal = new StoryDataAccess();
  const [story, editor, backgrounds, palettes, scenePresets] = await Promise.all([
    dal.getStory(session.user.id, storyId),
    dal.getEditor(session.user.id, storyId, chapterId),
    sceneLibraryRepository.getActiveGlobalBackgrounds(),
    sceneLibraryRepository.getActivePalettes(),
    sceneLibraryRepository.getActiveScenePresets(),
  ]).catch((error: unknown) => {
    if (error instanceof CommandError && error.status === 404) notFound();
    throw error;
  });
  // Chapter, scenes and revision come from the same authorized DB snapshot.
  return (
    <EditorClient
      initialStory={{ ...story.data, chapters: [editor.data.chapter] }}
      chapterId={chapterId}
      initialScenes={editor.data.scenes}
      initialRevision={editor.meta.updatedAt}
      sceneLibrary={{ backgrounds, palettes, scenePresets }}
    />
  );
}
