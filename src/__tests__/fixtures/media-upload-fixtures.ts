import type { MediaUploadPurpose, MediaUploadStatus } from "@/types/media";

interface StoryCoverUploadFixtureOptions {
  id: string;
  ownerId: string;
  purpose?: MediaUploadPurpose;
  status?: MediaUploadStatus;
  url?: string;
}

const databaseStatus = {
  pending: "PENDING",
  processing: "PROCESSING",
  completed: "COMPLETED",
  claimed: "CLAIMED",
  cancelled: "CANCELLED",
  expired: "EXPIRED",
  rejected: "REJECTED",
} as const;

export function storyCoverUploadFixture(options: StoryCoverUploadFixtureOptions) {
  const url = options.url ?? `https://media.example.invalid/${encodeURIComponent(options.id)}.png`;
  const status = options.status ?? "completed";
  return {
    id: options.id,
    ownerId: options.ownerId,
    purpose: options.purpose ?? "story_cover",
    mediaKind: "image",
    objectKey: `test/story-cover/${options.id}.png`,
    contentType: "image/png",
    expectedSize: 128,
    status: databaseStatus[status],
    result: status === "completed" || status === "claimed"
      ? { kind: "image", primary: { url, contentType: "image/png", size: 128, width: 32, height: 32 } }
      : undefined,
    expiresAt: new Date(Date.now() + 600_000),
    ...(status === "completed" || status === "claimed" ? { completedAt: new Date() } : {}),
    ...(status === "claimed" ? { claimedAt: new Date() } : {}),
  } as const;
}
