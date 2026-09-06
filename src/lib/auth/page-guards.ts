import "server-only";
import { redirect } from "next/navigation";
import type { Role } from "@/types/user";
import { requireRole } from "./guards";
import { AuthAccessError } from "./policy";

export async function requirePageRole(minRole: Role, callbackUrl: string) {
  try {
    return await requireRole(minRole);
  } catch (error) {
    if (!(error instanceof AuthAccessError)) throw error;
    if (error.status === 401) redirect(`/api/auth/signin?${new URLSearchParams({ callbackUrl })}`);
    redirect("/");
  }
}
