-- Expand: keep the column nullable while legacy rows are backfilled.
ALTER TABLE "Story" ADD COLUMN "searchTextNormalized" TEXT;

-- Match src/lib/search/text-search.ts without requiring the unaccent extension.
-- PostgreSQL normalize(..., NFD) separates Vietnamese combining marks first.
WITH normalized AS (
  SELECT
    "id",
    btrim(regexp_replace(
      lower(translate(
        regexp_replace(
          normalize("title" || ' ' || "authorDisplayName", NFD),
          U&'[\0300-\036F]',
          '',
          'g'
        ),
        'đĐ',
        'dD'
      )),
      '[^[:alnum:]]+',
      ' ',
      'g'
    )) AS document
  FROM "Story"
)
UPDATE "Story" AS story
SET "searchTextNormalized" = normalized.document || ' ' || replace(normalized.document, ' ', '')
FROM normalized
WHERE story."id" = normalized."id";

-- Verify before contracting the column. Empty documents indicate malformed source data.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "Story"
    WHERE "searchTextNormalized" IS NULL OR btrim("searchTextNormalized") = ''
  ) THEN
    RAISE EXCEPTION 'Story search document backfill produced a blank value';
  END IF;
END $$;

ALTER TABLE "Story" ALTER COLUMN "searchTextNormalized" SET NOT NULL;
