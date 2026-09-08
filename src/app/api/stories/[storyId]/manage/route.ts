import { storyReadRoute } from "@/lib/http/story-command-route";
import { storySchema } from "@/lib/validation/story-command-schema";

export const GET = storyReadRoute(storySchema);
