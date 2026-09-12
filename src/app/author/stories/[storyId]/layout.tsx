import { requirePageStoryAccess } from "@/lib/auth/page-guards";

interface AuthorStoryLayoutProps {
  children: React.ReactNode;
  params: Promise<{ storyId: string }>;
}

export default async function AuthorStoryLayout({ children, params }: AuthorStoryLayoutProps) {
  const { storyId } = await params;
  await requirePageStoryAccess(storyId, `/author/stories/${encodeURIComponent(storyId)}`);
  return children;
}

