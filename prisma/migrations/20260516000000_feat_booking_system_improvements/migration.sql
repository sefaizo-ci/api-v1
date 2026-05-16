-- Add REJECTED value to BookingStatus enum
ALTER TYPE "public"."BookingStatus" ADD VALUE 'REJECTED';

-- Add travelBufferMin to professionals
ALTER TABLE "public"."professionals" ADD COLUMN "travelBufferMin" INTEGER NOT NULL DEFAULT 0;

-- Create booking_services table
CREATE TABLE "public"."booking_services" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "durationMin" INTEGER NOT NULL,
    "basePrice" DOUBLE PRECISION NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "booking_services_pkey" PRIMARY KEY ("id")
);

-- Unique constraint
ALTER TABLE "public"."booking_services" ADD CONSTRAINT "booking_services_bookingId_serviceId_key" UNIQUE ("bookingId", "serviceId");

-- Index
CREATE INDEX "booking_services_bookingId_idx" ON "public"."booking_services"("bookingId");

-- Foreign keys
ALTER TABLE "public"."booking_services" ADD CONSTRAINT "booking_services_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "public"."bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."booking_services" ADD CONSTRAINT "booking_services_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "public"."service_offerings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill: create a BookingService row for every existing booking that has a serviceId
INSERT INTO "public"."booking_services" ("id", "bookingId", "serviceId", "durationMin", "basePrice", "order")
SELECT
    gen_random_uuid()::text,
    b."id",
    b."serviceId",
    b."durationMin",
    (b."totalPrice" - b."travelFee"),
    0
FROM "public"."bookings" b
WHERE b."serviceId" IS NOT NULL
  AND b."deletedAt" IS NULL
ON CONFLICT DO NOTHING;
