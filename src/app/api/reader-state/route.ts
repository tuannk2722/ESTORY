import { requireSession } from "@/lib/auth/guards";
import { AuthAccessError } from "@/lib/auth/policy";
import { serverEnv } from "@/lib/env";
import { commandFailure, publicResponse, readCommandJson } from "@/lib/http/command-response";
import { bootstrapSchema, mutationSchema, readerStateSchema } from "@/lib/reader-state/schema";
import { ReaderStateService } from "@/lib/services/reader-state-service";
import { CommandError } from "@/lib/services/command-error";
import { validateCommand } from "@/lib/validation/story-command-schema";

const service = new ReaderStateService();
function checkAccount(actual: string, expected: string | null) {
  if (actual !== expected) throw new CommandError(409, "ACCOUNT_CHANGED", "Session changed. Reload before syncing.");
}
function checkOrigin(request: Request) {
  if (!serverEnv.AUTH_URL || request.headers.get("origin") !== new URL(serverEnv.AUTH_URL).origin) throw new AuthAccessError(403);
}
export async function GET(request: Request) {
  try {
    const session = await requireSession();
    checkAccount(session.user.id, request.headers.get("x-reader-user"));
    return publicResponse(readerStateSchema.nullable(), await service.read(session.user.id));
  } catch (error) { return commandFailure(error); }
}
export async function POST(request: Request) {
  try {
    const session = await requireSession();
    checkOrigin(request);
    const body = validateCommand(bootstrapSchema, await readCommandJson(request));
    checkAccount(session.user.id, body.expectedUserId);
    return publicResponse(readerStateSchema, await service.bootstrap(session.user.id, body.guest));
  } catch (error) { return commandFailure(error); }
}
export async function PATCH(request: Request) {
  try {
    const session = await requireSession();
    checkOrigin(request);
    const body = validateCommand(mutationSchema, await readCommandJson(request));
    checkAccount(session.user.id, body.expectedUserId);
    return publicResponse(readerStateSchema, await service.mutate(session.user.id, body));
  } catch (error) { return commandFailure(error); }
}
