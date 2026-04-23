-- Add slug column first as nullable to backfill existing rows
ALTER TABLE "service_categories"
ADD COLUMN "slug" TEXT;

-- Backfill slug from name with accent normalization and kebab-case conversion
UPDATE "service_categories"
SET "slug" = TRIM(BOTH '-' FROM REGEXP_REPLACE(
  TRANSLATE(
    LOWER("name"),
    'àáâäãåæçèéêëìíîïñòóôöõœùúûüýÿ',
    'aaaaaaceeeeiiiinooooouuuuyy'
  ),
  '[^a-z0-9]+',
  '-',
  'g'
));

-- Fallback for edge cases that could produce empty slug
UPDATE "service_categories"
SET "slug" = CONCAT('category-', SUBSTRING("id" FROM 1 FOR 8))
WHERE "slug" IS NULL OR "slug" = '';

-- Ensure uniqueness by suffixing duplicates
WITH duplicates AS (
  SELECT
    "id",
    "slug",
    ROW_NUMBER() OVER (PARTITION BY "slug" ORDER BY "createdAt", "id") AS rn
  FROM "service_categories"
)
UPDATE "service_categories" sc
SET "slug" = CONCAT(duplicates."slug", '-', duplicates.rn)
FROM duplicates
WHERE sc."id" = duplicates."id"
  AND duplicates.rn > 1;

ALTER TABLE "service_categories"
ALTER COLUMN "slug" SET NOT NULL;

CREATE UNIQUE INDEX "service_categories_slug_key" ON "service_categories"("slug");
