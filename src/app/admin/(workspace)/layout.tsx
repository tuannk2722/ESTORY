import { requirePageRole } from "@/lib/auth/page-guards";
import AdminShell from "@/components/admin/AdminShell";
import { StoryDataAccess } from "@/lib/services/story-dal";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requirePageRole("admin", "/admin");
  const pendingCount = await new StoryDataAccess()
    .getModerationSummary(session.user.id)
    .then((summary) => summary.pendingReview)
    .catch(() => null);
  return (
    <AdminShell
      identity={{ name: session.user.name, email: session.user.email }}
      pendingCount={pendingCount}
    >
      {children}
    </AdminShell>
  );
}
