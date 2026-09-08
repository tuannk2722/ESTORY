import { z } from "zod";
import { AuthAccessError } from "@/lib/auth/policy";
import { CommandError } from "@/lib/services/command-error";
import { commandMetaSchema } from "@/lib/validation/story-command-schema";

// Headroom below the platform body limit; content JSON does not carry upload bytes.
export const MAX_COMMAND_BODY_BYTES = 4_000_000;
const failureSchema = z.strictObject({ error: z.strictObject({
  code: z.string(), message: z.string(), fieldErrors: z.record(z.string(), z.array(z.string())).optional(),
}) });
const headers = { "Cache-Control": "private, no-store" };

export function commandResponse(dataSchema: z.ZodType, result: unknown, status = 200): Response {
  const body = z.strictObject({ data: dataSchema, meta: commandMetaSchema }).parse(result);
  return Response.json(body, { status, headers });
}
export function publicResponse(dataSchema: z.ZodType, data: unknown): Response {
  return Response.json({ data: dataSchema.parse(data) }, { headers });
}
export function commandFailure(error: unknown): Response {
  if (error instanceof AuthAccessError || error instanceof CommandError) {
    return Response.json(failureSchema.parse(error.body), { status: error.status, headers });
  }
  // No content, actor IDs, SQL, credentials or exception causes in logs/responses.
  console.error("[commands] COMMAND_REQUEST_FAILED");
  return Response.json(failureSchema.parse({ error: { code: "INTERNAL_ERROR", message: "Request could not be completed" } }), { status: 500, headers });
}

export async function readCommandJson(request: Request): Promise<unknown> {
  const declared = request.headers.get("content-length");
  if (declared && /^\d+$/.test(declared) && Number(declared) > MAX_COMMAND_BODY_BYTES) {
    throw new CommandError(413, "PAYLOAD_TOO_LARGE", "Request body is too large");
  }
  const type = request.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
  if (type !== "application/json") throw new CommandError(400, "INVALID_CONTENT_TYPE", "Expected application/json");
  if (!request.body) throw new CommandError(400, "INVALID_JSON", "Expected a JSON body");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > MAX_COMMAND_BODY_BYTES) {
        await reader.cancel();
        throw new CommandError(413, "PAYLOAD_TOO_LARGE", "Request body is too large");
      }
      chunks.push(chunk.value);
    }
  } finally { reader.releaseLock(); }
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks)));
  } catch {
    throw new CommandError(400, "INVALID_JSON", "Invalid JSON body");
  }
}
