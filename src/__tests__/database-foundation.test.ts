import assert from "node:assert/strict";
import { parseEnvironment, requireDatabaseUrl, requireR2Environment } from "@/lib/config/environment";
import { databaseJson } from "@/lib/db/json-fields";
import { snapshotConfig } from "./fixtures/scene-fixtures";

const defaults = parseEnvironment({});
assert.equal(defaults.PHASE3_STORY_READ_SOURCE, "json");
assert.equal(defaults.PHASE3_STORY_WRITE_SOURCE, "json");
assert.equal(defaults.PHASE3_SCENE_READ_SOURCE, "json");
assert.equal(defaults.PHASE3_SHADOW_READ, "false");
assert.equal(parseEnvironment({ DATABASE_URL: "" }).DATABASE_URL, undefined);
assert.throws(() => requireDatabaseUrl(defaults), /DATABASE_URL is required/);
const url = "postgresql://user:secret@localhost:5432/storytelling?sslmode=require";
assert.equal(requireDatabaseUrl(parseEnvironment({ DATABASE_URL: url })), url);
assert.throws(() => parseEnvironment({ DATABASE_URL: url, SHADOW_DATABASE_URL: url }), /SHADOW_DATABASE_URL/);
assert.throws(() => parseEnvironment({ DIRECT_URL: "postgresql://user:secret@ep-test-pooler.region.aws.neon.tech/db" }), /DIRECT_URL/);
assert.throws(() => parseEnvironment({ DATABASE_URL: "postgresql://user:secret@ep-test-pooler.region.aws.neon.tech/db", SHADOW_DATABASE_URL: "postgresql://another:secret@ep-test.region.aws.neon.tech:5432/db" }), /SHADOW_DATABASE_URL/);
assert.doesNotThrow(() => parseEnvironment({ DIRECT_URL: url, SHADOW_DATABASE_URL: "postgresql://user:secret@localhost:5432/shadow" }));
const r2 = {
  R2_ACCOUNT_ID: "a".repeat(32), R2_ACCESS_KEY_ID: "access", R2_SECRET_ACCESS_KEY: "secret",
  R2_BUCKET_NAME: "storytelling-media", R2_PUBLIC_BASE_URL: "https://media.example.test", R2_KEY_PREFIX: "preview",
};
assert.equal(requireR2Environment(parseEnvironment(r2)).R2_KEY_PREFIX, "preview");
assert.throws(() => requireR2Environment(parseEnvironment({})), /R2_ACCOUNT_ID/);
for (const invalid of [
  { ...r2, R2_ACCOUNT_ID: "not-an-account" },
  { ...r2, R2_BUCKET_NAME: "invalid.bucket" },
  { ...r2, R2_PUBLIC_BASE_URL: "http://media.example.test" },
  { ...r2, R2_KEY_PREFIX: "../production" },
]) assert.throws(() => parseEnvironment(invalid), (error: unknown) => error instanceof Error && !error.message.includes("secret"));

for (const key of ["DATABASE_URL", "DIRECT_URL", "SHADOW_DATABASE_URL"]) {
  for (const invalid of ["secret-value", "https://user:secret@host/db", "postgresql://user:secret@host/", "   "]) {
    assert.throws(() => parseEnvironment({ [key]: invalid }), (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, new RegExp(key));
      assert.ok(!error.message.includes("secret"));
      return true;
    });
  }
}
for (const key of ["PHASE3_STORY_READ_SOURCE", "PHASE3_SCENE_READ_SOURCE"]) {
  assert.throws(() => parseEnvironment({ [key]: "prisma" }), /DATABASE_URL/);
  assert.doesNotThrow(() => parseEnvironment({ DATABASE_URL: url, [key]: "prisma" }));
  for (const value of ["typo", ""]) assert.throws(() => parseEnvironment({ [key]: value }));
}
for (const value of ["prisma", "typo", ""]) {
  assert.throws(() => parseEnvironment({ DATABASE_URL: url, PHASE3_STORY_WRITE_SOURCE: value }));
}
assert.throws(() => parseEnvironment({ PHASE3_SHADOW_READ: "true" }), /DATABASE_URL/);
assert.doesNotThrow(() => parseEnvironment({ DATABASE_URL: url, PHASE3_SHADOW_READ: "true" }));
for (const value of ["1", "FALSE", ""]) assert.throws(() => parseEnvironment({ PHASE3_SHADOW_READ: value }));

for (const codec of [databaseJson.sceneRenderConfig, databaseJson.presetRenderConfig]) {
  const input = snapshotConfig();
  const stored = codec.write(input);
  const output = codec.read(stored);
  assert.deepEqual(output, input);
  output.palette.accent = "#000000";
  assert.notDeepEqual(output, stored);
  assert.deepEqual(stored, input);
  for (const invalid of [null, "{}", {}, { ...input, schema_version: 2 }, { ...input, ambient_effects: null }]) {
    assert.throws(() => codec.read(invalid), /Invalid database JSON/);
    assert.throws(() => codec.write(invalid), /Invalid database JSON/);
  }
}
const background = snapshotConfig().background;
assert.deepEqual(databaseJson.backgroundRender.read(databaseJson.backgroundRender.write(background)), background);
assert.throws(() => databaseJson.backgroundRender.write({ render_data: { kind: "video", media_url: "/private-video.mp4" }, motion: "looping" }), (error: unknown) => {
  assert.ok(error instanceof Error);
  assert.equal(error.message, "Invalid database JSON: BackgroundAsset.render");
  return true;
});
const categories = { visual: true, audio: false, motion: true, transition: true };
assert.deepEqual(databaseJson.effectsByCategory.read(databaseJson.effectsByCategory.write(categories)), categories);
for (const invalid of [null, {}, { ...categories, audio: "false" }, { ...categories, unknown: true }]) {
  assert.throws(() => databaseJson.effectsByCategory.read(invalid));
  assert.throws(() => databaseJson.effectsByCategory.write(invalid));
}
console.log("database-foundation.test.ts: environment guards and database JSON boundaries passed");
