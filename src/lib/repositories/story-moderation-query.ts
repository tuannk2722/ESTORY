import type { ModerationListQuery, ModerationStatusFilter } from "@/types/story-moderation";
import { normalizeSearchText } from "@/lib/search/text-search";

export interface ModerationCursor {
  rank: number;
  submittedAt: string | null;
  createdAt: string;
  id: string;
}

interface CursorPayload extends ModerationCursor {
  v: 1;
  q: string;
  status: ModerationStatusFilter;
}

export function encodeModerationCursor(query: ModerationListQuery, cursor: ModerationCursor): string {
  const payload: CursorPayload = {
    v: 1,
    q: normalizeSearchText(query.q),
    status: query.status,
    ...cursor,
  };
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

export function decodeModerationCursor(
  query: ModerationListQuery,
): ModerationCursor | null {
  if (!query.cursor) return null;
  try {
    const parsed = JSON.parse(Buffer.from(query.cursor, "base64url").toString("utf8")) as Partial<CursorPayload>;
    return parsed.v === 1
      && parsed.q === normalizeSearchText(query.q)
      && parsed.status === query.status
      && (parsed.rank === 0 || parsed.rank === 1)
      && (parsed.submittedAt === null || typeof parsed.submittedAt === "string")
      && typeof parsed.createdAt === "string"
      && Number.isFinite(Date.parse(parsed.createdAt))
      && (parsed.submittedAt === null || Number.isFinite(Date.parse(parsed.submittedAt)))
      && typeof parsed.id === "string"
      && Boolean(parsed.id)
      ? {
          rank: parsed.rank,
          submittedAt: parsed.submittedAt,
          createdAt: parsed.createdAt,
          id: parsed.id,
        }
      : null;
  } catch {
    return null;
  }
}
