-- Migration: move PIN data from sentinel.users to sentinel.client_secrets
-- and add device tracking FK + auth logging columns

-- Step 1: Add new columns to client_secrets
ALTER TABLE "sentinel"."client_secrets"
  ADD COLUMN "failCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "blockedUntil" TIMESTAMP(3);

-- Step 2: Set default on appPlatform
ALTER TABLE "sentinel"."client_secrets"
  ALTER COLUMN "appPlatform" SET DEFAULT 'MOBILE';

-- Step 3: Migrate PIN data from users → client_secrets
INSERT INTO "sentinel"."client_secrets"
  ("id", "clientId", "secretHash", "appPlatform", "failCount", "blockedUntil", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  u."id",
  u."pinHash",
  'MOBILE',
  u."pinFailCount",
  u."pinBlockedUntil",
  NOW(),
  NOW()
FROM "sentinel"."users" u
WHERE u."pinHash" IS NOT NULL
ON CONFLICT ("clientId") DO UPDATE
  SET "secretHash"   = EXCLUDED."secretHash",
      "failCount"    = EXCLUDED."failCount",
      "blockedUntil" = EXCLUDED."blockedUntil",
      "updatedAt"    = NOW();

-- Step 4: Add FK constraint from client_secrets.clientId → users.id
ALTER TABLE "sentinel"."client_secrets"
  ADD CONSTRAINT "client_secrets_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "sentinel"."users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Step 5: Drop old PIN columns from users
ALTER TABLE "sentinel"."users"
  DROP COLUMN IF EXISTS "pinHash",
  DROP COLUMN IF EXISTS "pinFailCount",
  DROP COLUMN IF EXISTS "pinBlockedUntil";
