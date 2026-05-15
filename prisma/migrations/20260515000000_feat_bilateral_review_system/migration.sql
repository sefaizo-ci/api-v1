-- CreateEnum (already exist on remote, created during partial first attempt)
-- CREATE TYPE "ReviewerType" AS ENUM ('CLIENT', 'PROFESSIONAL');
-- CREATE TYPE "CancellationInitiator" AS ENUM ('CLIENT', 'PROFESSIONAL');

-- Truncate old unidirectional reviews (incompatible with the new bilateral schema)
TRUNCATE TABLE "reviews";

-- AlterTable
ALTER TABLE "reviews" ADD COLUMN     "editableUntil" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "isEdited" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isVisible" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "revieweeId" TEXT NOT NULL,
ADD COLUMN     "reviewerId" TEXT NOT NULL,
ADD COLUMN     "reviewerType" "ReviewerType" NOT NULL,
ADD COLUMN     "sessionId" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "review_sessions" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revealedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "review_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cancellation_events" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "initiatedBy" "CancellationInitiator" NOT NULL,
    "clientId" TEXT NOT NULL,
    "professionalId" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cancellation_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "review_sessions_bookingId_key" ON "review_sessions"("bookingId");

-- CreateIndex
CREATE INDEX "cancellation_events_clientId_idx" ON "cancellation_events"("clientId");

-- CreateIndex
CREATE INDEX "cancellation_events_professionalId_idx" ON "cancellation_events"("professionalId");

-- CreateIndex
CREATE INDEX "reviews_professionalId_reviewerType_isVisible_idx" ON "reviews"("professionalId", "reviewerType", "isVisible");

-- CreateIndex
CREATE INDEX "reviews_revieweeId_reviewerType_isVisible_idx" ON "reviews"("revieweeId", "reviewerType", "isVisible");

-- CreateIndex
CREATE UNIQUE INDEX "reviews_sessionId_reviewerType_key" ON "reviews"("sessionId", "reviewerType");

-- CreateIndex
CREATE INDEX "users_phoneId_role_idx" ON "sentinel"."users"("phoneId", "role");

-- AddForeignKey
ALTER TABLE "sentinel"."phone_numbers" ADD CONSTRAINT "phone_numbers_clientUserId_fkey" FOREIGN KEY ("clientUserId") REFERENCES "sentinel"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sentinel"."phone_numbers" ADD CONSTRAINT "phone_numbers_professionalUserId_fkey" FOREIGN KEY ("professionalUserId") REFERENCES "sentinel"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sentinel"."challenges" ADD CONSTRAINT "challenges_phoneNumberId_fkey" FOREIGN KEY ("phoneNumberId") REFERENCES "sentinel"."phone_numbers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_sessions" ADD CONSTRAINT "review_sessions_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "review_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cancellation_events" ADD CONSTRAINT "cancellation_events_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cancellation_events" ADD CONSTRAINT "cancellation_events_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "professionals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
