-- Add relation column
ALTER TABLE "service_offerings" ADD COLUMN "categoryId" TEXT;

-- Ensure every existing service category text has a row in service_categories
INSERT INTO "service_categories" ("id", "professionalId", "name", "description", "isActive", "createdAt", "updatedAt", "deletedAt", "metadata")
SELECT
  md5(s."professionalId" || ':' || lower(trim(s."category"))),
  s."professionalId",
  trim(s."category"),
  NULL,
  true,
  NOW(),
  NOW(),
  NULL,
  NULL
FROM "service_offerings" s
LEFT JOIN "service_categories" c
  ON c."professionalId" = s."professionalId"
 AND lower(c."name") = lower(trim(s."category"))
WHERE c."id" IS NULL
GROUP BY s."professionalId", trim(s."category");

-- Backfill FK from existing text category
UPDATE "service_offerings" s
SET "categoryId" = c."id"
FROM "service_categories" c
WHERE c."professionalId" = s."professionalId"
  AND lower(c."name") = lower(trim(s."category"));

-- Enforce relation
ALTER TABLE "service_offerings" ALTER COLUMN "categoryId" SET NOT NULL;
ALTER TABLE "service_offerings"
  ADD CONSTRAINT "service_offerings_categoryId_fkey"
  FOREIGN KEY ("categoryId") REFERENCES "service_categories"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Keep query performance for category filters
CREATE INDEX "service_offerings_categoryId_idx" ON "service_offerings"("categoryId");

-- Remove old denormalized text category
ALTER TABLE "service_offerings" DROP COLUMN "category";
