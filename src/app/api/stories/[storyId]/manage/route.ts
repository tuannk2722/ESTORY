import { storyReadRoute } from "@/lib/http/story-command-route";
import { managedStoryDataSchema } from "@/lib/validation/story-command-schema";

export const GET = storyReadRoute(managedStoryDataSchema, "managed");
