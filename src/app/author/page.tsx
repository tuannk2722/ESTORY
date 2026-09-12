import type { Metadata } from "next";
import AppHeader from "@/components/ui/AppHeader";
import AuthorDashboard from "@/components/author/AuthorDashboard";
import { requirePageRole } from "@/lib/auth/page-guards";
import { StoryDataAccess } from "@/lib/services/story-dal";

export const metadata: Metadata = { title: "Truyện của tôi" };

export default async function AuthorDashboardPage() {
  const session = await requirePageRole("author", "/author");
  const stories = await new StoryDataAccess().getStoriesForAuthor(session.user.id);
  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader />
      <AuthorDashboard initialStories={stories} />
    </div>
  );
}

