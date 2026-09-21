import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import { resolve } from "node:path";
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production");
let stage = "initialize";
async function run() {
  const { prisma } = await import("@/lib/db/prisma");
  const marker = randomUUID();
  const ids: string[] = [];
  const sessions: string[] = [];
  let server: ChildProcess | undefined;
  try {
    for (const role of ["READER", "AUTHOR", "AUTHOR"] as const) {
      const sessionToken = randomUUID(); sessions.push(sessionToken);
      ids.push((await prisma.user.create({ data: { role, email: `${randomUUID()}@example.invalid`,
        sessions: { create: { sessionToken, expires: new Date(Date.now() + 600_000) } },
      } })).id);
    }
    const listener = createServer().listen(0, "127.0.0.1"); await once(listener, "listening");
    const address = listener.address(); assert.ok(address && typeof address !== "string");
    const port = address.port; await new Promise<void>((done) => listener.close(() => done()));
    const origin = `http://localhost:${port}`;
    server = spawn(process.execPath, [resolve("node_modules/next/dist/bin/next"), "start", "-p", String(port)], {
      env: { ...process.env, AUTH_URL: origin, AUTH_SECRET: "test-only-personal-audio-secret-32-bytes", AUTH_GOOGLE_ID: "test", AUTH_GOOGLE_SECRET: "test", AUTH_GITHUB_ID: "test", AUTH_GITHUB_SECRET: "test", FREESOUND_CLIENT_ID: "test", FREESOUND_CLIENT_SECRET: "test", FREESOUND_TOKEN_ENCRYPTION_KEY: "ab".repeat(32) },
      windowsHide: true, stdio: "ignore",
    });
    const request = (path: string, user?: number, body?: unknown, requestOrigin = origin) => fetch(origin + path, {
      redirect: "manual", signal: AbortSignal.timeout(20_000),
      headers: { ...(user === undefined ? {} : { cookie: `authjs.session-token=${sessions[user]}` }), origin: requestOrigin, "Content-Type": "application/json" },
      ...(body === undefined ? {} : { method: "POST", body: JSON.stringify(body) }),
    });
    for (let i = 0; i < 40; i++) {
      try { if ((await request("/api/integrations/freesound/status")).status === 401) break; } catch { /* server startup */ }
      await new Promise((done) => setTimeout(done, 250));
    }
    stage = "auth boundary";
    for (const path of ["/api/audio-assets", "/api/integrations/freesound/status", "/api/integrations/freesound/search?q=rain", "/api/integrations/freesound/connect"]) {
      assert.equal((await request(path)).status, 401, path);
      assert.equal((await request(path, 0)).status, 403, path);
    }
    stage = "status projection and quota initialization";
    const status = await request("/api/integrations/freesound/status", 1);
    assert.equal(status.status, 200);
    const statusBody = await status.json();
    assert.equal(statusBody.data.freesound_import_quota.limit, 15);
    assert.equal(statusBody.data.freesound_connection.connected, false);
    assert.ok(!JSON.stringify(statusBody).includes("Ciphertext"));
    stage = "input and origin checks";
    assert.equal((await request("/api/integrations/freesound/search?q=", 1)).status, 400);
    assert.equal((await request("/api/integrations/freesound/import", 1, { freesound_sound_id: "1", ownerId: ids[2] })).status, 400);
    assert.equal((await request("/api/integrations/freesound/disconnect", 1, {}, "https://foreign.example")).status, 403);
    stage = "unconnected import refunds quota";
    assert.equal((await request("/api/integrations/freesound/import", 1, { freesound_sound_id: "1" })).status, 409);
    assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: ids[1] } })).freesoundImportQuotaUsed, 0);
    stage = "owned upload and reuse";
    const upload = await prisma.mediaUpload.create({ data: { ownerId: ids[1], purpose: "personal_audio", mediaKind: "audio", objectKey: marker, contentType: "audio/wav", expectedSize: 100, expiresAt: new Date(Date.now() + 60_000), status: "COMPLETED", result: { kind: "audio", primary: { url: "https://media.example/test.wav", size: 100, contentType: "audio/wav", durationMs: 1000 } } } });
    assert.equal((await request("/api/audio-assets", 2, { uploadId: upload.id, title: "stolen" })).status, 404);
    assert.equal((await request("/api/audio-assets", 1, { uploadId: upload.id, title: "Personal sound" })).status, 200);
    assert.equal((await request("/api/audio-assets", 1, { uploadId: upload.id, title: "retry" })).status, 200);
    assert.equal((await (await request("/api/audio-assets", 2)).json()).data.length, 0);
    stage = "disconnect does not delete imported audio";
    assert.equal((await request("/api/integrations/freesound/disconnect", 1, {})).status, 200);
    assert.equal((await (await request("/api/audio-assets", 1)).json()).data.length, 1);
    stage = "oauth state cookie and callback failure";
    const connect = await request("/api/integrations/freesound/connect", 1);
    assert.equal(connect.status, 302);
    assert.ok(connect.headers.get("location")?.startsWith("https://freesound.org/apiv2/oauth2/authorize/"));
    assert.ok(connect.headers.get("set-cookie")?.includes("HttpOnly"));
    const callback = await request("/api/integrations/freesound/callback?code=bad&state=bad", 1);
    assert.ok((await callback.text()).includes("connected:false"));
    console.log("P3-15 HTTP: auth, owner/DTO/origin, quota refund, upload retry, disconnect and OAuth state passed");
  } finally {
    if (server && server.exitCode === null) { const exit = once(server, "exit"); server.kill(); await exit; }
    await prisma.user.deleteMany({ where: { id: { in: ids } } }); await prisma.$disconnect();
  }
}
run().catch((e: unknown) => { console.error("P3-15 HTTP failed", stage, e instanceof assert.AssertionError ? e.message : "request failed"); process.exitCode = 1; });
