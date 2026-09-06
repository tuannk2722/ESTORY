import { requirePageRole } from "@/lib/auth/page-guards";

export default async function AuthorLayout({ children }: { children: React.ReactNode }) {
  // Readers must be able to reach the first-story wizard in P3-10.
  await requirePageRole("reader", "/author");
  return children;
}
