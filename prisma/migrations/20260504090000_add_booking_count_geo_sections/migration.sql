-- Add bookingCount to professionals
ALTER TABLE "public"."professionals"
  ADD COLUMN IF NOT EXISTS "bookingCount" INTEGER NOT NULL DEFAULT 0;

-- Backfill from existing confirmed/completed bookings
UPDATE "public"."professionals" p
SET "bookingCount" = (
  SELECT COUNT(*)
  FROM "public"."bookings" b
  WHERE b."professionalId" = p.id
    AND b.status IN ('CONFIRMED', 'COMPLETED', 'NO_SHOW')
    AND b."deletedAt" IS NULL
);
