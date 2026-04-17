-- Add phone relation column on users
ALTER TABLE "users" ADD COLUMN "phoneId" TEXT;

-- Backfill phoneId from legacy users.phone -> phones.number
UPDATE "users" u
SET "phoneId" = p."id"
FROM "phones" p
WHERE p."number" = u."phone";

-- Enforce not-null once backfilled
ALTER TABLE "users" ALTER COLUMN "phoneId" SET NOT NULL;

-- Keep one user per phone
CREATE UNIQUE INDEX "users_phoneId_key" ON "users"("phoneId");

-- Add FK users.phoneId -> phones.id
ALTER TABLE "users"
ADD CONSTRAINT "users_phoneId_fkey"
FOREIGN KEY ("phoneId") REFERENCES "phones"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

-- Remove legacy duplicated phone field from users
ALTER TABLE "users" DROP COLUMN "phone";
