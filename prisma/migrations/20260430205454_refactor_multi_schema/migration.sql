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
-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "pulse";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "sentinel";

-- CreateEnum
CREATE TYPE "sentinel"."Role" AS ENUM ('CLIENT', 'PROFESSIONAL', 'ADMIN');

-- CreateEnum
CREATE TYPE "sentinel"."OtpChannel" AS ENUM ('WHATSAPP', 'SMS');

-- CreateEnum
CREATE TYPE "sentinel"."OtpPurpose" AS ENUM ('REGISTRATION', 'LOGIN', 'PHONE_CHANGE', 'PIN_RESET');

-- CreateEnum
CREATE TYPE "sentinel"."ChallengeType" AS ENUM ('OTP', 'PKCE');

-- CreateEnum
CREATE TYPE "pulse"."NotificationChannel" AS ENUM ('IN_APP', 'PUSH', 'WHATSAPP', 'SMS');

-- CreateEnum
CREATE TYPE "pulse"."NotificationStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'READ');

-- DropForeignKey
ALTER TABLE "auth_logs" DROP CONSTRAINT "auth_logs_userId_fkey";

-- DropForeignKey
ALTER TABLE "notification_devices" DROP CONSTRAINT "notification_devices_userId_fkey";

-- DropForeignKey
ALTER TABLE "notifications" DROP CONSTRAINT "notifications_userId_fkey";

-- DropForeignKey
ALTER TABLE "otp_codes" DROP CONSTRAINT "otp_codes_userId_fkey";

-- DropForeignKey
ALTER TABLE "phone_roles" DROP CONSTRAINT "phone_roles_phoneId_fkey";

-- DropForeignKey
ALTER TABLE "phone_roles" DROP CONSTRAINT "phone_roles_userId_fkey";

-- DropForeignKey
ALTER TABLE "refresh_tokens" DROP CONSTRAINT "refresh_tokens_userId_fkey";

-- DropForeignKey
ALTER TABLE "users" DROP CONSTRAINT "users_phoneId_fkey";

-- DropForeignKey (public tables referencing users — must drop before users is dropped)
ALTER TABLE "professionals" DROP CONSTRAINT "professionals_userId_fkey";
ALTER TABLE "bookings" DROP CONSTRAINT "bookings_clientId_fkey";
ALTER TABLE "service_category_requests" DROP CONSTRAINT "service_category_requests_reviewedByUserId_fkey";

-- DropTable
DROP TABLE "auth_logs";

-- DropTable
DROP TABLE "notification_devices";

-- DropTable
DROP TABLE "notifications";

-- DropTable
DROP TABLE "otp_codes";

-- DropTable
DROP TABLE "phone_roles";

-- DropTable
DROP TABLE "phones";

-- DropTable
DROP TABLE "refresh_tokens";

-- DropTable
DROP TABLE "users";

-- DropEnum
DROP TYPE "NotificationChannel";

-- DropEnum
DROP TYPE "NotificationStatus";

-- DropEnum
DROP TYPE "OtpChannel";

-- DropEnum
DROP TYPE "OtpPurpose";

-- DropEnum
DROP TYPE "Role";

-- CreateTable
CREATE TABLE "sentinel"."users" (
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

-- CreateTable
CREATE TABLE "sentinel"."phone_numbers" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "phone_numbers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sentinel"."phone_roles" (
    "id" TEXT NOT NULL,
    "phoneId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "sentinel"."Role" NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "phone_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sentinel"."challenges" (
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

-- CreateTable
CREATE TABLE "sentinel"."refresh_tokens" (
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

-- CreateTable
CREATE TABLE "sentinel"."auth_logs" (
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

-- CreateTable
CREATE TABLE "sentinel"."devices" (
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

-- CreateTable
CREATE TABLE "sentinel"."device_authentications" (
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

-- CreateTable
CREATE TABLE "sentinel"."client_secrets" (
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

-- CreateTable
CREATE TABLE "pulse"."notifications" (
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

-- CreateTable
CREATE TABLE "pulse"."notification_devices" (
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

-- CreateIndex
CREATE UNIQUE INDEX "users_phoneId_key" ON "sentinel"."users"("phoneId");

-- CreateIndex
CREATE UNIQUE INDEX "phone_numbers_number_key" ON "sentinel"."phone_numbers"("number");

-- CreateIndex
CREATE INDEX "phone_roles_userId_idx" ON "sentinel"."phone_roles"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "phone_roles_phoneId_role_key" ON "sentinel"."phone_roles"("phoneId", "role");

-- CreateIndex
CREATE INDEX "challenges_userId_purpose_idx" ON "sentinel"."challenges"("userId", "purpose");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_tokenHash_key" ON "sentinel"."refresh_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "devices_userId_isActive_idx" ON "sentinel"."devices"("userId", "isActive");

-- CreateIndex
CREATE INDEX "device_authentications_userId_deviceId_idx" ON "sentinel"."device_authentications"("userId", "deviceId");

-- CreateIndex
CREATE UNIQUE INDEX "client_secrets_clientId_key" ON "sentinel"."client_secrets"("clientId");

-- CreateIndex
CREATE INDEX "notifications_userId_createdAt_idx" ON "pulse"."notifications"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "notifications_status_channel_idx" ON "pulse"."notifications"("status", "channel");

-- CreateIndex
CREATE INDEX "notification_devices_userId_isActive_idx" ON "pulse"."notification_devices"("userId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "notification_devices_userId_platform_deviceId_key" ON "pulse"."notification_devices"("userId", "platform", "deviceId");

-- AddForeignKey
ALTER TABLE "sentinel"."users" ADD CONSTRAINT "users_phoneId_fkey" FOREIGN KEY ("phoneId") REFERENCES "sentinel"."phone_numbers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sentinel"."phone_roles" ADD CONSTRAINT "phone_roles_phoneId_fkey" FOREIGN KEY ("phoneId") REFERENCES "sentinel"."phone_numbers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sentinel"."phone_roles" ADD CONSTRAINT "phone_roles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "sentinel"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sentinel"."challenges" ADD CONSTRAINT "challenges_userId_fkey" FOREIGN KEY ("userId") REFERENCES "sentinel"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sentinel"."challenges" ADD CONSTRAINT "challenges_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "sentinel"."devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sentinel"."refresh_tokens" ADD CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "sentinel"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sentinel"."auth_logs" ADD CONSTRAINT "auth_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "sentinel"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sentinel"."devices" ADD CONSTRAINT "devices_userId_fkey" FOREIGN KEY ("userId") REFERENCES "sentinel"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sentinel"."device_authentications" ADD CONSTRAINT "device_authentications_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "sentinel"."devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sentinel"."device_authentications" ADD CONSTRAINT "device_authentications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "sentinel"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sentinel"."device_authentications" ADD CONSTRAINT "device_authentications_refreshTokenId_fkey" FOREIGN KEY ("refreshTokenId") REFERENCES "sentinel"."refresh_tokens"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pulse"."notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "sentinel"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pulse"."notification_devices" ADD CONSTRAINT "notification_devices_userId_fkey" FOREIGN KEY ("userId") REFERENCES "sentinel"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey (restore public → sentinel.users cross-schema constraints)
ALTER TABLE "professionals" ADD CONSTRAINT "professionals_userId_fkey" FOREIGN KEY ("userId") REFERENCES "sentinel"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "sentinel"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "service_category_requests" ADD CONSTRAINT "service_category_requests_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "sentinel"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
