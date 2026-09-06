import { z } from "zod";
import type { ApiFailure } from "@/types/api";
import type { Role } from "@/types/user";

const roleSchema = z.enum(["reader", "author", "admin"]);
const roleRank: Record<Role, number> = { reader: 1, author: 2, admin: 3 };
const userSchema = z.object({
  id: z.string().min(1),
  role: roleSchema,
  email: z.string().email(),
  name: z.string().nullable(),
  image: z.string().nullable(),
});
const sessionSchema = z.object({ user: userSchema, expires: z.iso.datetime() });
export type SessionUser = z.infer<typeof userSchema>;
export type AuthSession = z.infer<typeof sessionSchema>;

export function hasMinimumRole(role: unknown, minimum: Role): boolean {
  const parsed = roleSchema.safeParse(role);
  return parsed.success && roleRank[parsed.data] >= roleRank[minimum];
}

/** Explicit projection: never spread a Prisma User or database Session. */
export function projectSession(user: unknown, expires: string): AuthSession {
  const parsed = z.object({
    id: z.string().min(1), email: z.string().email(),
    name: z.string().nullish(), image: z.string().nullish(),
    role: z.enum(["READER", "AUTHOR", "ADMIN"]),
  }).safeParse(user);
  if (!parsed.success) throw new Error("Invalid authentication user");
  const value = parsed.data;
  const roles = { READER: "reader", AUTHOR: "author", ADMIN: "admin" } as const;
  return {
    user: { id: value.id, role: roles[value.role], email: value.email, name: value.name ?? null, image: value.image ?? null },
    expires,
  };
}

export class AuthAccessError extends Error {
  readonly status: 401 | 403;
  readonly body: ApiFailure;

  constructor(status: 401 | 403) {
    const message = status === 401 ? "Authentication required" : "Insufficient permissions";
    super(message);
    this.status = status;
    this.body = { error: { code: status === 401 ? "UNAUTHENTICATED" : "FORBIDDEN", message } };
  }
}

/** The injected reader must validate the session against its trusted store. */
export function createSessionGuards(readSession: () => Promise<unknown>) {
  async function requireSession(): Promise<AuthSession> {
    const parsed = sessionSchema.safeParse(await readSession());
    if (!parsed.success || Date.parse(parsed.data.expires) <= Date.now()) throw new AuthAccessError(401);
    return parsed.data;
  }
  async function requireRole(minRole: Role): Promise<AuthSession> {
    const session = await requireSession();
    if (!hasMinimumRole(session.user.role, minRole)) throw new AuthAccessError(403);
    return session;
  }
  return { requireSession, requireRole };
}
