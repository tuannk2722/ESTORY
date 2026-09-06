import { requirePageRole } from "@/lib/auth/page-guards";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requirePageRole("admin", "/admin");
  return children;
}
