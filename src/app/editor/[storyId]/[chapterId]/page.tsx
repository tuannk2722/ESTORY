// src/app/editor/[storyId]/[chapterId]/page.tsx
// Phase 2: Author Editor Screen

interface EditorPageProps {
  params: Promise<{ storyId: string; chapterId: string }>;
}

export default async function EditorPage({ params }: EditorPageProps) {
  const { storyId, chapterId } = await params;

  return (
    <div className="editor-screen min-h-screen p-8">
      <h1 className="text-2xl font-bold">Author Editor (Phase 2)</h1>
      <p className="text-muted-foreground mt-2">
        Story ID: {storyId} | Chapter ID: {chapterId}
      </p>
    </div>
  );
}
