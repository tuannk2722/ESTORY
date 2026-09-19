import type { Metadata } from "next";
import SceneCatalogWorkspace, {
  type SceneCatalogWorkspaceQuery,
} from "@/components/admin/scene-library/SceneCatalogWorkspace";
import { requirePageRole } from "@/lib/auth/page-guards";
import { parseBackgroundAdminSearchParams } from "@/lib/validation/scene-catalog-schema";

export const metadata: Metadata = { title: "Thư viện bối cảnh" };

type RawSearchParams = Record<string, string | string[] | undefined>;

export default async function AdminSceneLibraryPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const [, params] = await Promise.all([
    requirePageRole("admin", "/admin/scene-library"),
    searchParams,
  ]);
  const query: SceneCatalogWorkspaceQuery = {
    tab: "backgrounds",
    ...parseBackgroundAdminSearchParams(params),
  };
  return <SceneCatalogWorkspace query={query} />;
}
