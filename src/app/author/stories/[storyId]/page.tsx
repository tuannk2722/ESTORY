import type { Metadata } from "next";
import { notFound } from "next/navigation";
import AppHeader from "@/components/ui/AppHeader";
import StoryManagement from "@/components/author/StoryManagement";
import { requirePageStoryAccess } from "@/lib/auth/page-guards";
import { CommandError } from "@/lib/services/command-error";
import { StoryDataAccess } from "@/lib/services/story-dal";

export const metadata: Metadata = { title: "Quản lý truyện" };

interface ManageStoryPageProps {
  params: Promise<{ storyId: string }>;
}

export default async function ManageStoryPage({ params }: ManageStoryPageProps) {
  const { storyId } = await params;
  const session = await requirePageStoryAccess(storyId, `/author/stories/${encodeURIComponent(storyId)}`);
  const result = await new StoryDataAccess().getManagedStory(session.user.id, storyId).catch((error: unknown) => {
    if (error instanceof CommandError && error.status === 404) notFound();
    throw error;
  });
  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader />
      <StoryManagement initial={result.data} initialRevision={result.meta.updatedAt} />
    </div>
  );
}

