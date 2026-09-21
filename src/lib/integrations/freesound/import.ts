import "server-only";
import { randomUUID } from "node:crypto";
import { loadRuntimePrismaClient } from "@/lib/repositories/prisma-read-client";
import { serverEnv } from "@/lib/env";
import { requireR2Environment } from "@/lib/config/environment";
import { R2MediaStorageProvider } from "@/lib/storage/r2-media-storage-provider";
import { mapAudioAsset } from "@/lib/repositories/prisma-audio-asset-repository";
import { AudioImportService, type ImportSound } from "@/lib/services/audio-import-service";
import { CommandError } from "@/lib/services/command-error";
import { normalizeAudio } from "@/lib/media/normalize-audio";
import { accessToken } from "./oauth";
import { freesoundClient, quotaService } from "./runtime";

export function licenseMetadata(sound: ImportSound) {
  const url = new URL(sound.license);
  if (!["creativecommons.org", "www.creativecommons.org"].includes(url.hostname) || !["http:", "https:"].includes(url.protocol)) throw new CommandError(400, "UNSUPPORTED_LICENSE", "This sound's license is not supported");
  const license = url.pathname.startsWith("/publicdomain/zero/") ? "cc0" : url.pathname.startsWith("/licenses/by-nc/") ? "cc-by-nc" : url.pathname.startsWith("/licenses/by/") ? "cc-by" : null;
  if (!license) throw new CommandError(400, "UNSUPPORTED_LICENSE", "This sound's license is not supported");
  return { license, ...(license === "cc0" ? {} : {
    attributionAuthorName: sound.username, attributionSourceUrl: sound.url,
    attributionLicenseName: `${license.toUpperCase()} ${url.pathname.split("/").filter(Boolean).at(-1)}`,
  }) };
}
const activeImports = new Set<string>();
export async function importFreesound(ownerId: string, soundId: string) {
  const prisma = await loadRuntimePrismaClient();
  const client = freesoundClient();
  const find = async (id: string, sound: string) => {
    const row = await prisma.audioAsset.findUnique({ where: { ownerId_freesoundId: { ownerId: id, freesoundId: sound } } });
    return row ? mapAudioAsset(row) : null;
  };
  // Limit expensive work locally; DB quota and the unique owner/sound constraint remain
  // authoritative across instances. Never occupy a pool connection while transcoding.
  if (activeImports.has(ownerId) || activeImports.size >= 2) throw new CommandError(429, "FREESOUND_IMPORT_BUSY", "An audio import is already running; try again shortly");
  activeImports.add(ownerId);
  try {
    return await new AudioImportService({
      quota: quotaService(), find, token: accessToken,
      sound: (id) => client.sound(id), download: (id, token) => client.download(id, token), normalize: normalizeAudio,
      save: async (id, sound, audio) => {
        const env = requireR2Environment(serverEnv);
        const storage = new R2MediaStorageProvider({ accountId: env.R2_ACCOUNT_ID, accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY, bucket: env.R2_BUCKET_NAME, publicBaseUrl: env.R2_PUBLIC_BASE_URL });
        const metadata = licenseMetadata(sound);
        const key = `${env.R2_KEY_PREFIX}/personal_audio/${id}/${randomUUID()}.mp3`;
        try {
          const put = await storage.presignPut({ key, contentType: "audio/mpeg", expiresInSeconds: 120 });
          const response = await fetch(put.url, { method: "PUT", headers: put.headers, body: Buffer.from(audio.bytes), signal: AbortSignal.timeout(30_000) });
          if (!response.ok) throw new CommandError(503, "AUDIO_STORAGE_FAILED", "Could not store the imported audio");
          const row = await prisma.audioAsset.create({ data: { ownerId: id, source: "freesound", title: sound.name, url: storage.publicUrl(key), durationMs: audio.durationMs, freesoundId: String(sound.id), ...metadata } });
          return mapAudioAsset(row);
        } catch (error) {
          // Delete only when a successful read proves no committed asset uses our immutable URL.
          try {
            const saved = await find(id, String(sound.id));
            if (!saved || saved.url !== storage.publicUrl(key)) await storage.deleteObject(key);
          } catch { console.error("[audio] IMPORT_CLEANUP_UNCONFIRMED"); }
          if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
            throw new CommandError(409, "AUDIO_ALREADY_IMPORTED", "This sound was imported concurrently");
          }
          throw error;
        }
      },
    }).import(ownerId, soundId);
  } finally { activeImports.delete(ownerId); }
}
