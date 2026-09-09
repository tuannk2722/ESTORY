CREATE TYPE "MediaUploadStatus" AS ENUM (
  'PENDING',
  'COMPLETED',
  'CLAIMED',
  'CANCELLED',
  'EXPIRED',
  'REJECTED'
);

CREATE TABLE "MediaUpload" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "purpose" TEXT NOT NULL,
  "mediaKind" TEXT NOT NULL,
  "videoSlot" INTEGER,
  "objectKey" TEXT NOT NULL,
  "contentType" TEXT NOT NULL,
  "expectedSize" INTEGER NOT NULL,
  "posterObjectKey" TEXT,
  "posterContentType" TEXT,
  "posterExpectedSize" INTEGER,
  "status" "MediaUploadStatus" NOT NULL DEFAULT 'PENDING',
  "result" JSONB,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "completedAt" TIMESTAMP(3),
  "claimedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "MediaUpload_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MediaUpload_expectedSize_check" CHECK ("expectedSize" > 0),
  CONSTRAINT "MediaUpload_videoSlot_check" CHECK ("videoSlot" IS NULL OR "videoSlot" BETWEEN 1 AND 10),
  CONSTRAINT "MediaUpload_poster_bundle_check" CHECK (
    ("posterObjectKey" IS NULL AND "posterContentType" IS NULL AND "posterExpectedSize" IS NULL)
    OR
    ("posterObjectKey" IS NOT NULL AND "posterContentType" IS NOT NULL AND "posterExpectedSize" IS NOT NULL AND "posterExpectedSize" > 0)
  )
);

CREATE UNIQUE INDEX "MediaUpload_objectKey_key" ON "MediaUpload"("objectKey");
CREATE UNIQUE INDEX "MediaUpload_posterObjectKey_key" ON "MediaUpload"("posterObjectKey");
CREATE UNIQUE INDEX "MediaUpload_ownerId_videoSlot_key" ON "MediaUpload"("ownerId", "videoSlot");
CREATE INDEX "MediaUpload_ownerId_status_expiresAt_idx" ON "MediaUpload"("ownerId", "status", "expiresAt");
CREATE INDEX "MediaUpload_ownerId_purpose_mediaKind_status_idx" ON "MediaUpload"("ownerId", "purpose", "mediaKind", "status");

ALTER TABLE "MediaUpload"
ADD CONSTRAINT "MediaUpload_ownerId_fkey"
FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
