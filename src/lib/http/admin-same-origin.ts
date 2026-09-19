import { AuthAccessError } from "@/lib/auth/policy";
import { serverEnv } from "@/lib/env";

export function requireAdminSameOrigin(request: Request): void {
  if (!serverEnv.AUTH_URL || request.headers.get("origin") !== new URL(serverEnv.AUTH_URL).origin) {
    throw new AuthAccessError(403);
  }
}
