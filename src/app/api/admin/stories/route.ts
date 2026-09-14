import { requireRole } from "@/lib/auth/guards";
import { commandFailure, publicResponse } from "@/lib/http/command-response";
import { StoryDataAccess } from "@/lib/services/story-dal";
import {
  moderationListSchema,
  parseModerationSearchParams,
} from "@/lib/validation/story-moderation-schema";

const dataAccess = new StoryDataAccess();

export async function GET(request: Request) {
  try {
    const session = await requireRole("admin");
    const url = new URL(request.url);
    const query = parseModerationSearchParams({
      q: url.searchParams.getAll("q"),
      status: url.searchParams.getAll("status"),
      cursor: url.searchParams.getAll("cursor"),
      limit: url.searchParams.getAll("limit"),
    });
    return publicResponse(
      moderationListSchema,
      await dataAccess.listModerationStories(session.user.id, query),
    );
  } catch (error) {
    return commandFailure(error);
  }
}
