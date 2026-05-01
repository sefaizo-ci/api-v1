/*
  Warnings:

  - You are about to drop the `auth_logs` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `notification_devices` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `notifications` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `otp_codes` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `phone_roles` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `phones` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `refresh_tokens` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `users` table. If the table is not empty, all the data it contains will be lost.

*/

-- ============================================================
-- PHASE 1: Create new schemas and enum types
-- ============================================================
CREATE SCHEMA IF NOT EXISTS "pulse";
CREATE SCHEMA IF NOT EXISTS "sentinel";

DO $$ BEGIN
  CREATE TYPE "sentinel"."Role" AS ENUM ('CLIENT', 'PROFESSIONAL', 'ADMIN');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "sentinel"."OtpChannel" AS ENUM ('WHATSAPP', 'SMS');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "sentinel"."OtpPurpose" AS ENUM ('REGISTRATION', 'LOGIN', 'PHONE_CHANGE', 'PIN_RESET');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "sentinel"."ChallengeType" AS ENUM ('OTP', 'PKCE');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "pulse"."NotificationChannel" AS ENUM ('IN_APP', 'PUSH', 'WHATSAPP', 'SMS');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "pulse"."NotificationStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'READ');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ============================================================
-- PHASE 2: Create core sentinel tables (needed before data migration)
-- ============================================================
CREATE TABLE IF NOT EXISTS "sentinel"."phone_numbers" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "phone_numbers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "sentinel"."users" (
    "id" TEXT NOT NULL,
    "phoneId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "role" "sentinel"."Role" NOT NULL DEFAULT 'CLIENT',
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "pinHash" TEXT,
    "pinFailCount" INTEGER NOT NULL DEFAULT 0,
    "pinBlockedUntil" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "sentinel"."phone_roles" (
    "id" TEXT NOT NULL,
    "phoneId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "sentinel"."Role" NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "phone_roles_pkey" PRIMARY KEY ("id")
);

-- ============================================================
-- PHASE 3: Data migration — public schema → sentinel schema
-- (Runs before DROP to preserve existing production data)
-- ============================================================

-- Migrate phone numbers (guard: skip if source table was already dropped by a previous partial run)
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'phones') THEN
    INSERT INTO "sentinel"."phone_numbers" ("id", "number", "isVerified", "metadata", "createdAt", "updatedAt", "deletedAt")
    SELECT "id", "number", "isVerified", "metadata", "createdAt", "updatedAt", "deletedAt"
    FROM "phones"
    ON CONFLICT ("id") DO NOTHING;
  END IF;
END $$;

-- Migrate users (role cast through text to avoid public→sentinel enum mismatch)
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'users') THEN
    INSERT INTO "sentinel"."users" ("id", "phoneId", "firstName", "lastName", "role", "isVerified", "isActive", "createdAt", "updatedAt", "deletedAt", "metadata", "pinHash", "pinFailCount", "pinBlockedUntil")
    SELECT "id", "phoneId", "firstName", "lastName", "role"::text::"sentinel"."Role", "isVerified", "isActive", "createdAt", "updatedAt", "deletedAt", "metadata", "pinHash", "pinFailCount", "pinBlockedUntil"
    FROM "users"
    WHERE "phoneId" IN (SELECT "id" FROM "sentinel"."phone_numbers")
    ON CONFLICT ("id") DO NOTHING;
  END IF;
END $$;

-- Migrate phone roles
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'phone_roles') THEN
    INSERT INTO "sentinel"."phone_roles" ("id", "phoneId", "userId", "role", "metadata", "createdAt", "updatedAt")
    SELECT "id", "phoneId", "userId", "role"::text::"sentinel"."Role", "metadata", "createdAt", "updatedAt"
    FROM "phone_roles"
    WHERE "userId" IN (SELECT "id" FROM "sentinel"."users")
      AND "phoneId" IN (SELECT "id" FROM "sentinel"."phone_numbers")
    ON CONFLICT ("id") DO NOTHING;
  END IF;
END $$;

-- ============================================================
-- PHASE 4: Drop old public schema FK constraints
-- ============================================================
ALTER TABLE IF EXISTS "auth_logs" DROP CONSTRAINT IF EXISTS "auth_logs_userId_fkey";
ALTER TABLE IF EXISTS "notification_devices" DROP CONSTRAINT IF EXISTS "notification_devices_userId_fkey";
ALTER TABLE IF EXISTS "notifications" DROP CONSTRAINT IF EXISTS "notifications_userId_fkey";
ALTER TABLE IF EXISTS "otp_codes" DROP CONSTRAINT IF EXISTS "otp_codes_userId_fkey";
ALTER TABLE IF EXISTS "phone_roles" DROP CONSTRAINT IF EXISTS "phone_roles_phoneId_fkey";
ALTER TABLE IF EXISTS "phone_roles" DROP CONSTRAINT IF EXISTS "phone_roles_userId_fkey";
ALTER TABLE IF EXISTS "refresh_tokens" DROP CONSTRAINT IF EXISTS "refresh_tokens_userId_fkey";
ALTER TABLE IF EXISTS "users" DROP CONSTRAINT IF EXISTS "users_phoneId_fkey";

-- Drop cross-schema FKs (public tables referencing users) before dropping users
ALTER TABLE IF EXISTS "professionals" DROP CONSTRAINT IF EXISTS "professionals_userId_fkey";
ALTER TABLE IF EXISTS "bookings" DROP CONSTRAINT IF EXISTS "bookings_clientId_fkey";
ALTER TABLE IF EXISTS "service_category_requests" DROP CONSTRAINT IF EXISTS "service_category_requests_reviewedByUserId_fkey";

-- ============================================================
-- PHASE 5: Drop old public schema tables
-- ============================================================
DROP TABLE IF EXISTS "auth_logs";
DROP TABLE IF EXISTS "notification_devices";
DROP TABLE IF EXISTS "notifications";
DROP TABLE IF EXISTS "otp_codes";
DROP TABLE IF EXISTS "phone_roles";
DROP TABLE IF EXISTS "phones";
DROP TABLE IF EXISTS "refresh_tokens";
DROP TABLE IF EXISTS "users";

-- ============================================================
-- PHASE 6: Drop old public schema enum types
-- ============================================================
DROP TYPE IF EXISTS "NotificationChannel";
DROP TYPE IF EXISTS "NotificationStatus";
DROP TYPE IF EXISTS "OtpChannel";
DROP TYPE IF EXISTS "OtpPurpose";
DROP TYPE IF EXISTS "Role";

-- ============================================================
-- PHASE 7: Create remaining sentinel and pulse tables
-- ============================================================
CREATE TABLE IF NOT EXISTS "sentinel"."challenges" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "deviceId" TEXT,
    "type" "sentinel"."ChallengeType" NOT NULL DEFAULT 'OTP',
    "code" TEXT NOT NULL,
    "purpose" "sentinel"."OtpPurpose" NOT NULL,
    "channel" "sentinel"."OtpChannel" NOT NULL,
    "isUsed" BOOLEAN NOT NULL DEFAULT false,
    "failCount" INTEGER NOT NULL DEFAULT 0,
    "blockedUntil" TIMESTAMP(3),
    "metadata" JSONB,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "challenges_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "sentinel"."refresh_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "deviceInfo" TEXT,
    "ipAddress" TEXT,
    "isRevoked" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "platform" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "sentinel"."auth_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "event" TEXT NOT NULL,
    "channel" TEXT,
    "ipAddress" TEXT,
    "deviceInfo" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "auth_logs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "sentinel"."devices" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fingerprint" TEXT,
    "platform" TEXT NOT NULL,
    "model" TEXT,
    "osVersion" TEXT,
    "appVersion" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "devices_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "sentinel"."device_authentications" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "refreshTokenId" TEXT,
    "lastActiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "device_authentications_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "sentinel"."client_secrets" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "secretHash" TEXT NOT NULL,
    "appPlatform" TEXT NOT NULL,
    "appVersionMin" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_secrets_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "pulse"."notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "channel" "pulse"."NotificationChannel" NOT NULL,
    "status" "pulse"."NotificationStatus" NOT NULL DEFAULT 'PENDING',
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "scheduledFor" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "failedReason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "pulse"."notification_devices" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "pushToken" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "notification_devices_pkey" PRIMARY KEY ("id")
);

-- ============================================================
-- PHASE 8: Create indexes
-- ============================================================
CREATE UNIQUE INDEX IF NOT EXISTS "users_phoneId_key" ON "sentinel"."users"("phoneId");
CREATE UNIQUE INDEX IF NOT EXISTS "phone_numbers_number_key" ON "sentinel"."phone_numbers"("number");
CREATE INDEX IF NOT EXISTS "phone_roles_userId_idx" ON "sentinel"."phone_roles"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "phone_roles_phoneId_role_key" ON "sentinel"."phone_roles"("phoneId", "role");
CREATE INDEX IF NOT EXISTS "challenges_userId_purpose_idx" ON "sentinel"."challenges"("userId", "purpose");
CREATE UNIQUE INDEX IF NOT EXISTS "refresh_tokens_tokenHash_key" ON "sentinel"."refresh_tokens"("tokenHash");
CREATE INDEX IF NOT EXISTS "devices_userId_isActive_idx" ON "sentinel"."devices"("userId", "isActive");
CREATE INDEX IF NOT EXISTS "device_authentications_userId_deviceId_idx" ON "sentinel"."device_authentications"("userId", "deviceId");
CREATE UNIQUE INDEX IF NOT EXISTS "client_secrets_clientId_key" ON "sentinel"."client_secrets"("clientId");
CREATE INDEX IF NOT EXISTS "notifications_userId_createdAt_idx" ON "pulse"."notifications"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "notifications_status_channel_idx" ON "pulse"."notifications"("status", "channel");
CREATE INDEX IF NOT EXISTS "notification_devices_userId_isActive_idx" ON "pulse"."notification_devices"("userId", "isActive");
CREATE UNIQUE INDEX IF NOT EXISTS "notification_devices_userId_platform_deviceId_key" ON "pulse"."notification_devices"("userId", "platform", "deviceId");

-- ============================================================
-- PHASE 9: Add FK constraints within sentinel/pulse schemas
-- ============================================================
DO $$ BEGIN
  ALTER TABLE "sentinel"."users" ADD CONSTRAINT "users_phoneId_fkey" FOREIGN KEY ("phoneId") REFERENCES "sentinel"."phone_numbers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "sentinel"."phone_roles" ADD CONSTRAINT "phone_roles_phoneId_fkey" FOREIGN KEY ("phoneId") REFERENCES "sentinel"."phone_numbers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "sentinel"."phone_roles" ADD CONSTRAINT "phone_roles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "sentinel"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "sentinel"."challenges" ADD CONSTRAINT "challenges_userId_fkey" FOREIGN KEY ("userId") REFERENCES "sentinel"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "sentinel"."challenges" ADD CONSTRAINT "challenges_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "sentinel"."devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "sentinel"."refresh_tokens" ADD CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "sentinel"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "sentinel"."auth_logs" ADD CONSTRAINT "auth_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "sentinel"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "sentinel"."devices" ADD CONSTRAINT "devices_userId_fkey" FOREIGN KEY ("userId") REFERENCES "sentinel"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "sentinel"."device_authentications" ADD CONSTRAINT "device_authentications_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "sentinel"."devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "sentinel"."device_authentications" ADD CONSTRAINT "device_authentications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "sentinel"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "sentinel"."device_authentications" ADD CONSTRAINT "device_authentications_refreshTokenId_fkey" FOREIGN KEY ("refreshTokenId") REFERENCES "sentinel"."refresh_tokens"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "pulse"."notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "sentinel"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "pulse"."notification_devices" ADD CONSTRAINT "notification_devices_userId_fkey" FOREIGN KEY ("userId") REFERENCES "sentinel"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ============================================================
-- PHASE 10: Restore cross-schema FK constraints (public → sentinel.users)
-- Safety cleanup: remove any rows that could not be migrated (truly orphaned data)
-- ============================================================
DELETE FROM "bookings" WHERE "clientId" NOT IN (SELECT "id" FROM "sentinel"."users");
DELETE FROM "professionals" WHERE "userId" NOT IN (SELECT "id" FROM "sentinel"."users");
UPDATE "service_category_requests"
  SET "reviewedByUserId" = NULL
  WHERE "reviewedByUserId" IS NOT NULL
    AND "reviewedByUserId" NOT IN (SELECT "id" FROM "sentinel"."users");

DO $$ BEGIN
  ALTER TABLE "professionals" ADD CONSTRAINT "professionals_userId_fkey" FOREIGN KEY ("userId") REFERENCES "sentinel"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "bookings" ADD CONSTRAINT "bookings_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "sentinel"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "service_category_requests" ADD CONSTRAINT "service_category_requests_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "sentinel"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
