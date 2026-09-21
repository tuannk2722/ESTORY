import "server-only";
import { serverEnv } from "@/lib/env";
import { CommandError } from "@/lib/services/command-error";
import { QuotaService } from "@/lib/services/quota-service";
import { PrismaQuotaStore } from "@/lib/repositories/prisma-quota-store";
import { FreesoundClient } from "./client";
import { encryptionKey } from "./crypto";

export function freesoundConfig() {
  const { FREESOUND_CLIENT_ID: clientId, FREESOUND_CLIENT_SECRET: clientSecret, FREESOUND_TOKEN_ENCRYPTION_KEY: key, AUTH_URL: origin } = serverEnv;
  const apiKey = serverEnv.FREESOUND_API_KEY ?? clientSecret;
  if (!clientId || !clientSecret || !apiKey || !key || !origin) throw new CommandError(503, "FREESOUND_NOT_CONFIGURED", "Freesound is not configured");
  return { clientId, clientSecret, apiKey, key: encryptionKey(key), origin: new URL(origin).origin };
}
export function freesoundClient() {
  const token = serverEnv.FREESOUND_API_KEY ?? serverEnv.FREESOUND_CLIENT_SECRET;
  if (!token) throw new CommandError(503, "FREESOUND_NOT_CONFIGURED", "Freesound search is not configured");
  return new FreesoundClient(token);
}
export function quotaService() {
  return new QuotaService(new PrismaQuotaStore(undefined, serverEnv.FREESOUND_DAILY_IMPORT_LIMIT));
}
