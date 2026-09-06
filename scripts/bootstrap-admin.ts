import { loadEnvConfig } from "@next/env";
import { bootstrapAdmins } from "@/lib/auth/bootstrap-admin";

loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production");

async function run() {
  const { serverEnv } = await import("@/lib/env");
  if (!serverEnv.BOOTSTRAP_ADMIN_EMAILS.length && !serverEnv.BOOTSTRAP_ADMIN_USER_IDS.length) {
    throw new Error("Missing bootstrap allowlist");
  }
  const { prisma } = await import("@/lib/db/prisma");
  try {
    const result = await prisma.$transaction((tx) => bootstrapAdmins(tx, {
      emails: serverEnv.BOOTSTRAP_ADMIN_EMAILS, userIds: serverEnv.BOOTSTRAP_ADMIN_USER_IDS,
    }), { timeout: 30_000 });
    console.log(`Admin bootstrap passed: matched=${result.matched}, promoted=${result.promoted}, admins=${result.adminCount}`);
  } finally {
    await prisma.$disconnect();
  }
}

run().catch(() => {
  console.error("Admin bootstrap failed. Check database configuration and allowlist; every target must have signed in with Google/GitHub. No tokens or user details are logged.");
  process.exitCode = 1;
});
