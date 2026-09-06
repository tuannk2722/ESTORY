import type { SessionUser } from "@/lib/auth/policy";

declare module "next-auth" {
  interface Session {
    user: SessionUser;
  }
}
