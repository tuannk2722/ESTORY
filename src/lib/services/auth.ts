import "server-only";
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import GitHub from "next-auth/providers/github";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { serverEnv } from "@/lib/env";
import { requireAuthEnvironment } from "@/lib/config/auth-environment";
import { projectSession } from "@/lib/auth/policy";
import { isVerifiedOAuthEmail } from "@/lib/auth/oauth-profile";

// Lazy initialization keeps build-time route collection independent of the DB.
export const { handlers, auth, signIn, signOut } = NextAuth(async () => {
  const env = requireAuthEnvironment(serverEnv);
  const { prisma } = await import("@/lib/db/prisma");
  return {
    adapter: PrismaAdapter(prisma),
    secret: env.AUTH_SECRET,
    basePath: "/api/auth",
    // AUTH_URL pins the origin; TLS termination/forwarded hosts cannot choose it.
    trustHost: true,
    useSecureCookies: new URL(env.AUTH_URL).protocol === "https:",
    session: { strategy: "database" },
    providers: [
      Google({ clientId: env.AUTH_GOOGLE_ID, clientSecret: env.AUTH_GOOGLE_SECRET, allowDangerousEmailAccountLinking: false }),
      GitHub({ clientId: env.AUTH_GITHUB_ID, clientSecret: env.AUTH_GITHUB_SECRET, allowDangerousEmailAccountLinking: false }),
    ],
    callbacks: {
      async signIn({ user, account, profile }) {
        return isVerifiedOAuthEmail(account?.provider, user.email, profile, account?.access_token);
      },
      session({ session, user }) {
        return projectSession(user, typeof session.expires === "string" ? session.expires : new Date(session.expires).toISOString());
      },
      redirect({ url }) {
        const origin = new URL(env.AUTH_URL).origin;
        try {
          const target = new URL(url, origin);
          if (target.origin === origin) return target.href;
        } catch { /* Fall through to the configured app origin. */ }
        return origin;
      },
    },
    debug: false,
    logger: {
      // Auth.js default error causes may include adapter inputs/OAuth tokens.
      error() { console.error("[auth] Authentication request failed"); },
      warn() { console.warn("[auth] Authentication configuration warning"); },
      debug() {},
    },
  };
});
