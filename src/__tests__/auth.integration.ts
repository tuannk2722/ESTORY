import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { loadEnvConfig } from "@next/env";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { bootstrapAdmins } from "@/lib/auth/bootstrap-admin";
import { projectSession } from "@/lib/auth/policy";

loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production");

async function run() {
  const { prisma } = await import("@/lib/db/prisma");
  const suffix = randomUUID();
  const email = `auth-${suffix}@example.invalid`;
  const rollback = new Error("ROLLBACK_AUTH_TEST");
  try {
    await assert.rejects(prisma.$transaction(async (tx) => {
      // Adapter only uses CRUD delegates; the transaction has the same delegates.
      const adapter = PrismaAdapter(tx as typeof prisma);
      const user = await adapter.createUser!({ id: "provider-id-must-not-be-used", email, emailVerified: null, name: "Auth test", image: null });
      assert.notEqual(user.id, "provider-id-must-not-be-used");
      assert.equal((await tx.user.findUniqueOrThrow({ where: { id: user.id } })).role, "READER");
      await adapter.linkAccount!({ userId: user.id, type: "oauth", provider: "google", providerAccountId: suffix, access_token: "private-test-token" });
      assert.equal((await adapter.getUserByAccount!({ provider: "google", providerAccountId: suffix }))?.id, user.id);
      await adapter.createSession!({ userId: user.id, sessionToken: suffix, expires: new Date(Date.now() + 60_000) });
      let stored = await adapter.getSessionAndUser!(suffix);
      assert.ok(stored);
      assert.equal(projectSession(stored.user, stored.session.expires.toISOString()).user.role, "reader");

      const existingAdmin = await tx.user.create({ data: { email: `existing-${suffix}@example.invalid`, role: "ADMIN" } });
      const unlinked = await tx.user.create({ data: { email: `unlinked-${suffix}@example.invalid` } });
      await assert.rejects(bootstrapAdmins(tx, { emails: [], userIds: [] }), /requires/);
      await assert.rejects(bootstrapAdmins(tx, { emails: [email, `missing-${suffix}@example.invalid`], userIds: [] }), /exactly one/);
      assert.equal((await tx.user.findUniqueOrThrow({ where: { id: user.id } })).role, "READER", "Invalid selectors must not partially promote users");
      await assert.rejects(bootstrapAdmins(tx, { emails: [], userIds: [unlinked.id] }), /exactly one/);

      const countBefore = await tx.user.count();
      const first = await bootstrapAdmins(tx, { emails: [email.toUpperCase(), email], userIds: [user.id] });
      assert.equal(first.matched, 1);
      assert.equal(first.promoted, 1);
      assert.ok(first.adminCount >= 2);
      const promoted = await tx.user.findUniqueOrThrow({ where: { id: user.id } });
      const repeat = await bootstrapAdmins(tx, { emails: [], userIds: [user.id] });
      assert.equal(repeat.promoted, 0);
      assert.equal(await tx.user.count(), countBefore);
      assert.equal((await tx.user.findUniqueOrThrow({ where: { id: user.id } })).updatedAt.getTime(), promoted.updatedAt.getTime());
      assert.equal((await tx.user.findUniqueOrThrow({ where: { id: existingAdmin.id } })).role, "ADMIN");

      stored = await adapter.getSessionAndUser!(suffix);
      assert.ok(stored);
      assert.equal(projectSession(stored.user, stored.session.expires.toISOString()).user.role, "admin", "An existing session must observe bootstrap promotion");
      await tx.user.update({ where: { id: user.id }, data: { role: "READER", freesoundAccessTokenCiphertext: "private-test-ciphertext" } });
      stored = await adapter.getSessionAndUser!(suffix);
      assert.ok(stored);
      const projection = projectSession(stored.user, stored.session.expires.toISOString());
      assert.equal(projection.user.role, "reader");
      assert.ok(!JSON.stringify(projection).includes("private-test"));
      await adapter.deleteSession!(suffix);
      assert.equal(await adapter.getSessionAndUser!(suffix), null);
      throw rollback;
    }, { timeout: 60_000 }), (error: unknown) => error === rollback);
    assert.equal(await prisma.user.count({ where: { email } }), 0);
    console.log("Auth DB integration passed: Prisma adapter, stable IDs, fresh roles, bootstrap idempotency/rollback, projection and revocation; fixtures rolled back.");
  } finally {
    await prisma.$disconnect();
  }
}

run().catch(() => {
  console.error("Auth DB integration failed; details suppressed to keep database credentials/session tokens out of logs.");
  process.exitCode = 1;
});
