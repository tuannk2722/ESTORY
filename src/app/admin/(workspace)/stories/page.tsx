import type { Metadata } from "next";
import AdminStoryWorkspace from "@/components/admin/stories/AdminStoryWorkspace";
import { requirePageRole } from "@/lib/auth/page-guards";
import { StoryDataAccess } from "@/lib/services/story-dal";
import { parseModerationSearchParams } from "@/lib/validation/story-moderation-schema";
import type { PublicStorySearchParams } from "@/lib/validation/story-search-schema";

export const metadata: Metadata = {
  title: "Kiểm duyệt tác phẩm",
};

export default async function AdminStoriesPage({
  searchParams,
}: {
  searchParams: Promise<PublicStorySearchParams>;
}) {
  const [session, params] = await Promise.all([
    requirePageRole("admin", "/admin/stories"),
    searchParams,
  ]);
  const query = parseModerationSearchParams(params);
  const data = await new StoryDataAccess().listModerationStories(session.user.id, query);
  const workspaceKey = `${query.status}:${query.q}:${query.cursor ?? "first"}`;

  return <AdminStoryWorkspace key={workspaceKey} data={data} query={query} />;
}
