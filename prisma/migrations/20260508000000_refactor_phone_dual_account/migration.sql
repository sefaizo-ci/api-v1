-- ──────────────────────────────────────────────────────────────────────────
-- Migration: Dual-account phone model
--
-- A PhoneNumber can now hold one CLIENT account and one PROFESSIONAL account
-- independently, each with its own PIN.
--
-- Changes:
--   1. Add clientUserId / professionalUserId to phone_numbers
--   2. Populate them from existing user records
--   3. Remove the @unique constraint on users."phoneId"
--   4. Add "phoneNumberId" to challenges (was userId-only before)
--   5. Drop phone_roles table
-- ──────────────────────────────────────────────────────────────────────────

-- 1. Add new columns to phone_numbers (camelCase — no @map in schema)
ALTER TABLE "sentinel"."phone_numbers"
  ADD COLUMN "clientUserId"       TEXT UNIQUE,
  ADD COLUMN "professionalUserId" TEXT UNIQUE;

-- 2. Populate from existing users
--    CLIENT accounts
UPDATE "sentinel"."phone_numbers" pn
SET "clientUserId" = u.id
FROM "sentinel"."users" u
WHERE u."phoneId" = pn.id
  AND u."role" = 'CLIENT'
  AND u."deletedAt" IS NULL;

--    PROFESSIONAL accounts
UPDATE "sentinel"."phone_numbers" pn
SET "professionalUserId" = u.id
FROM "sentinel"."users" u
WHERE u."phoneId" = pn.id
  AND u."role" = 'PROFESSIONAL'
  AND u."deletedAt" IS NULL;

-- 3. Add FK constraints
ALTER TABLE "sentinel"."phone_numbers"
  ADD CONSTRAINT "phone_numbers_clientUserId_fkey"
    FOREIGN KEY ("clientUserId")
    REFERENCES "sentinel"."users"("id")
    ON DELETE SET NULL;

ALTER TABLE "sentinel"."phone_numbers"
  ADD CONSTRAINT "phone_numbers_professionalUserId_fkey"
    FOREIGN KEY ("professionalUserId")
    REFERENCES "sentinel"."users"("id")
    ON DELETE SET NULL;

-- 4. Drop the @unique constraint on users."phoneId"
--    (two users can now share the same phoneId — one CLIENT + one PROFESSIONAL)
DROP INDEX IF EXISTS "sentinel"."users_phoneId_key";

-- 5. Add "phoneNumberId" to challenges
ALTER TABLE "sentinel"."challenges"
  ADD COLUMN "phoneNumberId" TEXT;

-- Populate from users."phoneId"
UPDATE "sentinel"."challenges" c
SET "phoneNumberId" = u."phoneId"
FROM "sentinel"."users" u
WHERE u.id = c."userId";

-- Make NOT NULL now that it's populated
ALTER TABLE "sentinel"."challenges"
  ALTER COLUMN "phoneNumberId" SET NOT NULL;

-- Make userId nullable
ALTER TABLE "sentinel"."challenges"
  ALTER COLUMN "userId" DROP NOT NULL;

-- Add FK for phoneNumberId
ALTER TABLE "sentinel"."challenges"
  ADD CONSTRAINT "challenges_phoneNumberId_fkey"
    FOREIGN KEY ("phoneNumberId")
    REFERENCES "sentinel"."phone_numbers"("id")
    ON DELETE CASCADE;

-- Drop old index, create new one
DROP INDEX IF EXISTS "sentinel"."challenges_userId_purpose_idx";
CREATE INDEX "challenges_phoneNumberId_purpose_idx"
  ON "sentinel"."challenges"("phoneNumberId", "purpose");

-- 6. Drop phone_roles table
DROP TABLE IF EXISTS "sentinel"."phone_roles";
