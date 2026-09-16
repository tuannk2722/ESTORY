import type { Metadata } from "next";
import EffectAdminWorkspace from "@/components/admin/effects/EffectAdminWorkspace";
import { requirePageRole } from "@/lib/auth/page-guards";
import { parseEffectAdminSearchParams } from "@/lib/validation/effect-admin-schema";

export const metadata: Metadata = {
  title: "Thư viện hiệu ứng",
};

type RawSearchParams = Record<string, string | string[] | undefined>;

export default async function AdminEffectsPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const [, params] = await Promise.all([
    requirePageRole("admin", "/admin/effects"),
    searchParams,
  ]);
  const query = parseEffectAdminSearchParams(params);
  return <EffectAdminWorkspace query={query} />;
}
