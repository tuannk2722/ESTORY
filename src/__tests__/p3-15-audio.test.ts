import assert from "node:assert/strict";
import { AudioImportService, type AudioImportDependencies } from "@/lib/services/audio-import-service";
import { QuotaService } from "@/lib/services/quota-service";
import { CommandError } from "@/lib/services/command-error";
import { encryptCredential, decryptCredential, encryptionKey } from "@/lib/integrations/freesound/crypto";
import type { AudioAsset } from "@/types/audio-asset";
import { inspectMedia } from "@/lib/media/inspect-media";

export async function runPersonalAudioTests() {
  const frame = Buffer.alloc(417); frame.set([0xff, 0xfb, 0x90, 0]);
  assert.equal(inspectMedia("audio/mpeg", frame).durationMs, 26, "Unsigned MPEG sync mask accepts a valid frame");
  const key = encryptionKey("ab".repeat(32));
  const ciphertext = encryptCredential("test-secret", key, "owner:access");
  assert.equal(decryptCredential(ciphertext, key, "owner:access"), "test-secret");
  assert.ok(!ciphertext.includes("test-secret"));
  assert.throws(() => decryptCredential(ciphertext, key, "outsider:access"));
  assert.throws(() => decryptCredential(ciphertext, Buffer.alloc(32), "owner:access"));
  const parts = ciphertext.split("."); parts[3] = Buffer.from("tampered").toString("base64url");
  assert.throws(() => decryptCredential(parts.join("."), key, "owner:access"));
  const asset: AudioAsset = { id: "a", owner_id: "u", title: "sound", source: "freesound", freesound_id: "1", duration_ms: 1000, url: "https://media.example/a.mp3", created_at: "2026-09-20T00:00:00.000Z" };
  for (const failing of ["none", "token", "sound", "download", "normalize", "save", "duplicate", "lost-ack", "unconfirmed"] as const) {
    let used = 0, refunds = 0, saves = 0;
    const quota = new QuotaService({ read: async () => ({ limit: 15, used, reset_at: "2026-09-21T00:00:00.000Z" }),
      reserve: async () => ({ reserved: true, quota: { limit: 15, used: ++used, reset_at: "2026-09-21T00:00:00.000Z" } }), refund: async () => { used--; refunds++; } });
    const failAt = (stage: string) => { if (failing === stage) throw new Error(stage); };
    const deps: AudioImportDependencies = {
      quota,
      find: async () => {
        if (saves && failing === "unconfirmed") throw new Error("DB unavailable");
        return saves && ["duplicate", "lost-ack"].includes(failing) ? asset : null;
      },
      token: async () => { failAt("token"); return "token"; },
      sound: async () => { failAt("sound"); return { id: 1, name: "sound", username: "creator", url: "https://freesound.org/s/1/", license: "https://creativecommons.org/publicdomain/zero/1.0/", duration: 1 }; },
      download: async () => { failAt("download"); return new Uint8Array([1]); },
      normalize: async (bytes) => { failAt("normalize"); return { bytes, durationMs: 1000 }; },
      save: async () => {
        saves++; failAt("save");
        if (failing === "duplicate") throw new CommandError(409, "AUDIO_ALREADY_IMPORTED", "duplicate");
        if (["lost-ack", "unconfirmed"].includes(failing)) throw new Error("Lost acknowledgement");
        return asset;
      },
    };
    const service = new AudioImportService(deps);
    if (["none", "duplicate", "lost-ack"].includes(failing)) assert.equal((await service.import("u", "1")).id, "a");
    else await assert.rejects(service.import("u", "1"));
    assert.equal(refunds, ["none", "lost-ack", "unconfirmed"].includes(failing) ? 0 : 1, failing);
    deps.find = async () => asset;
    assert.equal((await service.import("u", "1")).id, "a", "Existing assets bypass quota/provider");
  }
}
