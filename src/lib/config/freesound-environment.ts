import { z } from "zod";
const optional = z.preprocess((v) => v === "" ? undefined : v, z.string().trim().min(1).optional());
export const freesoundEnvironmentShape = {
  FREESOUND_CLIENT_ID: optional,
  FREESOUND_CLIENT_SECRET: optional,
  FREESOUND_API_KEY: optional,
  FREESOUND_TOKEN_ENCRYPTION_KEY: optional,
  FREESOUND_DAILY_IMPORT_LIMIT: z.preprocess((v) => v === "" ? undefined : v, z.coerce.number().int().min(0).max(1000).default(15)),
};
