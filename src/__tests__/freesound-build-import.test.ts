import assert from "node:assert/strict";

// Separate process: deliberately do not load .env.local. Build-time module discovery
// must work without a database, while runtime database operations must still fail closed.
async function run() {
  for (const key of ["DATABASE_URL", "DIRECT_URL", "SHADOW_DATABASE_URL"]) delete process.env[key];
  process.env.PHASE3_STORY_READ_SOURCE = "json";
  process.env.PHASE3_STORY_WRITE_SOURCE = "json";
  process.env.PHASE3_SCENE_READ_SOURCE = "json";
  process.env.PHASE3_SHADOW_READ = "false";
  const oauth = await import("@/lib/integrations/freesound/oauth");
  const search = await import("@/lib/integrations/freesound/search");
  const audio = await import("@/lib/integrations/freesound/import");
  assert.equal(typeof search.searchFreesound, "function");
  assert.equal(typeof audio.importFreesound, "function");
  await assert.rejects(oauth.connectionStatus("test-user"), /DATABASE_URL is required to initialize Prisma/);
  console.log("Freesound build imports pass without DATABASE_URL; runtime DB validation remains enforced");
}
run().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Freesound build import test failed");
  process.exitCode = 1;
});
