import type { Metadata } from "next";
import AppHeader from "@/components/ui/AppHeader";
import StoryWizard from "@/components/author/StoryWizard";
import { requirePageRole } from "@/lib/auth/page-guards";

export const metadata: Metadata = { title: "Tạo truyện mới" };

export default async function NewStoryPage() {
  const session = await requirePageRole("reader", "/author/stories/new");
  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader />
      <StoryWizard initialByline={session.user.name?.trim() ?? ""} />
    </div>
  );
}

