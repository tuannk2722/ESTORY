import "server-only";
import type { Prisma } from "@/generated/prisma/client";

export interface AdminAllowlist { emails: readonly string[]; userIds: readonly string[] }

/** Caller supplies a transaction. Validate every selector before changing roles. */
export async function bootstrapAdmins(db: Pick<Prisma.TransactionClient, "user">, allowlist: AdminAllowlist) {
  const emails = [...new Set(allowlist.emails.map((email) => email.toLowerCase()))];
  const userIds = [...new Set(allowlist.userIds)];
  if (!emails.length && !userIds.length) throw new Error("Bootstrap requires BOOTSTRAP_ADMIN_EMAILS or BOOTSTRAP_ADMIN_USER_IDS");
  const selected = new Set<string>();
  const selectors: Prisma.UserWhereInput[] = [
    ...emails.map((email): Prisma.UserWhereInput => ({ email: { equals: email, mode: "insensitive" } })),
    ...userIds.map((id) => ({ id })),
  ];
  for (const selector of selectors) {
    const users = await db.user.findMany({
      where: { ...selector, accounts: { some: { provider: { in: ["google", "github"] } } } },
      select: { id: true }, take: 2,
    });
    if (users.length !== 1) throw new Error("Each bootstrap selector must match exactly one existing OAuth user; sign in first or use an exact user ID");
    selected.add(users[0].id);
  }
  const result = await db.user.updateMany({
    where: { id: { in: [...selected] }, role: { not: "ADMIN" } }, data: { role: "ADMIN" },
  });
  const adminCount = await db.user.count({ where: { role: "ADMIN" } });
  if (adminCount < 1) throw new Error("Bootstrap did not establish an admin");
  return { matched: selected.size, promoted: result.count, adminCount };
}
