import assert from "node:assert/strict";
import { parseEnvironment } from "@/lib/config/environment";
import { requireAuthEnvironment } from "@/lib/config/auth-environment";
import { AuthAccessError, createSessionGuards, hasMinimumRole, projectSession } from "@/lib/auth/policy";
import { isVerifiedOAuthEmail } from "@/lib/auth/oauth-profile";
import type { Role } from "@/types/user";

export async function runAuthTests() {
  const roles: Role[] = ["reader", "author", "admin"];
  for (const [index, role] of roles.entries()) for (const [minimumIndex, minimum] of roles.entries()) {
    assert.equal(hasMinimumRole(role, minimum), index >= minimumIndex);
  }
  for (const invalid of [null, undefined, "ADMIN", "owner", "__proto__", "constructor", {}]) {
    assert.equal(hasMinimumRole(invalid, "reader"), false);
  }

  const raw = { id: "stable-id", role: "ADMIN", email: "admin@example.invalid", name: null, image: null,
    freesoundAccessTokenCiphertext: "PRIVATE", access_token: "PRIVATE", sessionToken: "PRIVATE" };
  const expires = new Date(Date.now() + 60_000).toISOString();
  const session = projectSession(raw, expires);
  assert.deepEqual(session, { user: { id: raw.id, role: "admin", email: raw.email, name: null, image: null }, expires });
  assert.ok(!JSON.stringify(session).includes("PRIVATE"));
  assert.throws(() => projectSession({ ...raw, role: "owner" }, expires), /Invalid authentication user/);
  const accessError = (status: number) => (error: unknown) => error instanceof AuthAccessError && error.status === status;
  for (const invalid of [null, {}, { message: "Configuration error" }, { ...session, expires: "bad" },
    { ...session, expires: "2000-01-01T00:00:00.000Z" }, { ...session, user: { ...session.user, id: "" } }]) {
    await assert.rejects(createSessionGuards(async () => invalid).requireSession(), accessError(401));
  }
  for (const role of roles) {
    const guards = createSessionGuards(async () => ({ ...session, user: { ...session.user, role } }));
    assert.equal((await guards.requireSession()).user.role, role);
    if (role === "admin") assert.equal((await guards.requireRole("author")).user.id, raw.id);
    else await assert.rejects(guards.requireRole("admin"), accessError(403));
  }

  const valid = { DATABASE_URL: "postgresql://test:fixture@localhost/test", AUTH_URL: "http://localhost:3000",
    AUTH_SECRET: "unit-test-secret-with-at-least-32-characters", AUTH_GOOGLE_ID: "fixture", AUTH_GOOGLE_SECRET: "fixture",
    AUTH_GITHUB_ID: "fixture", AUTH_GITHUB_SECRET: "fixture" };
  assert.doesNotThrow(() => requireAuthEnvironment(parseEnvironment(valid)));
  for (const key of Object.keys(valid)) {
    assert.throws(() => requireAuthEnvironment(parseEnvironment({ ...valid, [key]: undefined })), new RegExp(key));
  }
  for (const value of ["https://app.invalid/path", "https://private:secret@app.invalid", "http://app.invalid", "https://app.invalid?secret=1", "not-a-url"]) {
    assert.throws(() => parseEnvironment({ AUTH_URL: value }), (error: unknown) => error instanceof Error && error.message === "Invalid server environment: AUTH_URL");
  }
  assert.throws(() => parseEnvironment({ AUTH_SECRET: "short-secret" }), /AUTH_SECRET/);
  assert.deepEqual(parseEnvironment({ BOOTSTRAP_ADMIN_EMAILS: " Admin@example.invalid,admin@example.invalid ", BOOTSTRAP_ADMIN_USER_IDS: "one,two,one" }).BOOTSTRAP_ADMIN_EMAILS, ["admin@example.invalid"]);
  assert.deepEqual(parseEnvironment({ BOOTSTRAP_ADMIN_USER_IDS: "one,two,one" }).BOOTSTRAP_ADMIN_USER_IDS, ["one", "two"]);
  for (const value of ["*", "@example.invalid", "a@example.invalid,", "a@example.invalid,,b@example.invalid"]) {
    assert.throws(() => parseEnvironment({ BOOTSTRAP_ADMIN_EMAILS: value }), /BOOTSTRAP_ADMIN_EMAILS/);
  }

  assert.equal(await isVerifiedOAuthEmail("google", raw.email, { email: raw.email, email_verified: true }, undefined), true);
  for (const profile of [{ email: raw.email, email_verified: false }, { email: "other@example.invalid", email_verified: true }, {}]) {
    assert.equal(await isVerifiedOAuthEmail("google", raw.email, profile, undefined), false);
  }
  const response = (body: unknown, status = 200): typeof fetch => async () => Response.json(body, { status });
  assert.equal(await isVerifiedOAuthEmail("github", raw.email, undefined, "fixture", response([{ email: raw.email, verified: true }])), true);
  for (const body of [[{ email: raw.email, verified: false }], [{ email: "other@example.invalid", verified: true }], {}, null]) {
    assert.equal(await isVerifiedOAuthEmail("github", raw.email, undefined, "fixture", response(body)), false);
  }
  assert.equal(await isVerifiedOAuthEmail("github", raw.email, undefined, "fixture", response({}, 401)), false);
  assert.equal(await isVerifiedOAuthEmail("github", raw.email, undefined, "fixture", async () => { throw new Error("upstream failed"); }), false);
  assert.equal(await isVerifiedOAuthEmail("credentials", raw.email, {}, "fixture"), false);
  console.log("auth.test.ts: role matrix, session projection/expiry, environment allowlists and verified OAuth email passed");
}
