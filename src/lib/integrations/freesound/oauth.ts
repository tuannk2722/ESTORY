import "server-only";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { CommandError } from "@/lib/services/command-error";
import { decryptCredential, encryptCredential } from "./crypto";
import { boundedResponse, FreesoundClient } from "./client";
import { freesoundConfig } from "./runtime";

const tokenSchema = z.object({ access_token: z.string().min(1), refresh_token: z.string().min(1), expires_in: z.number().int().positive() });
async function exchangeToken(parameters: Record<string, string>) {
  const config = freesoundConfig();
  const response = await fetch("https://freesound.org/apiv2/oauth2/access_token/", {
    method: "POST", body: new URLSearchParams({ client_id: config.clientId, client_secret: config.clientSecret, ...parameters }),
    signal: AbortSignal.timeout(12_000), redirect: "error", cache: "no-store",
  });
  if (!response.ok) { await response.body?.cancel(); throw new CommandError(409, "FREESOUND_RECONNECT", "Reconnect your Freesound account"); }
  return tokenSchema.parse(JSON.parse(new TextDecoder().decode(await boundedResponse(response, 32_000))));
}
function encryptedTokens(userId: string, tokens: z.infer<typeof tokenSchema>) {
  const { key } = freesoundConfig();
  return {
    freesoundAccessTokenCiphertext: encryptCredential(tokens.access_token, key, `${userId}:access`),
    freesoundRefreshTokenCiphertext: encryptCredential(tokens.refresh_token, key, `${userId}:refresh`),
    freesoundTokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
  };
}
export async function connectFreesound(userId: string, code: string) {
  const tokens = await exchangeToken({ grant_type: "authorization_code", code });
  const { apiKey } = freesoundConfig();
  const profile = z.object({ username: z.string().min(1).max(200) }).parse(await new FreesoundClient(apiKey).json("me/", tokens.access_token));
  await prisma.user.update({ where: { id: userId }, data: { ...encryptedTokens(userId, tokens), freesoundUsername: profile.username } });
}
export async function disconnectFreesound(userId: string) {
  await prisma.user.update({ where: { id: userId }, data: {
    freesoundAccessTokenCiphertext: null, freesoundRefreshTokenCiphertext: null,
    freesoundTokenExpiresAt: null, freesoundUsername: null,
  } });
}
export async function connectionStatus(userId: string) {
  const row = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: {
    freesoundAccessTokenCiphertext: true, freesoundRefreshTokenCiphertext: true, freesoundTokenExpiresAt: true, freesoundUsername: true,
  } });
  const connected = Boolean(row.freesoundAccessTokenCiphertext && row.freesoundRefreshTokenCiphertext && row.freesoundTokenExpiresAt && row.freesoundUsername);
  return { connected, ...(connected ? { freesound_username: row.freesoundUsername! } : {}) };
}
export async function accessToken(userId: string): Promise<string> {
  const { key } = freesoundConfig();
  // Serialize rotating refresh tokens across instances; disconnect waits for this same row lock.
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`;
    const row = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    if (!row.freesoundAccessTokenCiphertext || !row.freesoundRefreshTokenCiphertext || !row.freesoundTokenExpiresAt) {
      throw new CommandError(409, "FREESOUND_RECONNECT", "Connect your Freesound account first");
    }
    if (row.freesoundTokenExpiresAt.getTime() > Date.now() + 30_000) return decryptCredential(row.freesoundAccessTokenCiphertext, key, `${userId}:access`);
    const tokens = await exchangeToken({ grant_type: "refresh_token", refresh_token: decryptCredential(row.freesoundRefreshTokenCiphertext, key, `${userId}:refresh`) });
    await tx.user.update({ where: { id: userId }, data: encryptedTokens(userId, tokens) });
    return tokens.access_token;
  }, { maxWait: 15_000, timeout: 20_000 });
}
