-- Preserve the public content byline separately from the authenticated owner.
-- P3-04 apply backfills exact legacy attribution after this additive migration.
ALTER TABLE "Story" ADD COLUMN "authorDisplayName" TEXT;

UPDATE "Story"
SET "authorDisplayName" = 'Unknown author'
WHERE "authorDisplayName" IS NULL;

ALTER TABLE "Story" ALTER COLUMN "authorDisplayName" SET NOT NULL;
