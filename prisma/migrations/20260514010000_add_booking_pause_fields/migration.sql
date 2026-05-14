-- AlterTable
ALTER TABLE "public"."professionals"
  ADD COLUMN "isAcceptingBookings" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "bookingsPausedUntil" TIMESTAMP(3);
