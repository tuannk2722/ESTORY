import "server-only";
import { requireR2Environment } from "@/lib/config/environment";
import { serverEnv } from "@/lib/env";
import { PrismaMediaUploadStore } from "@/lib/repositories/prisma-media-upload-store";
import { CommandError } from "@/lib/services/command-error";
import { UploadService } from "@/lib/services/upload";
import { R2MediaStorageProvider } from "./r2-media-storage-provider";

let service: UploadService | undefined;

export function getRuntimeUploadService(): UploadService {
  if (service) return service;
  let env: ReturnType<typeof requireR2Environment>;
  try { env = requireR2Environment(serverEnv); }
  catch { throw new CommandError(503, "MEDIA_STORAGE_UNAVAILABLE", "Media storage is not configured"); }
  const provider = new R2MediaStorageProvider({
    accountId: env.R2_ACCOUNT_ID,
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    bucket: env.R2_BUCKET_NAME,
    publicBaseUrl: env.R2_PUBLIC_BASE_URL,
  });
  service = new UploadService(new PrismaMediaUploadStore(), provider, { keyPrefix: env.R2_KEY_PREFIX });
  return service;
}
