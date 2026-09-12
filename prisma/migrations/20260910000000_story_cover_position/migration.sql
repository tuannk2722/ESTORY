-- Store a normalized cover focal position so every 16:9 consumer renders the
-- same author-selected crop. Existing stories remain centered.
ALTER TABLE "Story"
ADD COLUMN "coverPositionX" DOUBLE PRECISION NOT NULL DEFAULT 50,
ADD COLUMN "coverPositionY" DOUBLE PRECISION NOT NULL DEFAULT 50;

ALTER TABLE "Story"
ADD CONSTRAINT "Story_coverPositionX_range" CHECK ("coverPositionX" >= 0 AND "coverPositionX" <= 100),
ADD CONSTRAINT "Story_coverPositionY_range" CHECK ("coverPositionY" >= 0 AND "coverPositionY" <= 100);
