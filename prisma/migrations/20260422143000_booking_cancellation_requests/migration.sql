-- CreateEnum
CREATE TYPE "BookingCancellationRequestStatus" AS ENUM ('NONE', 'PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "bookings"
ADD COLUMN "cancellationRequestReason" TEXT,
ADD COLUMN "cancellationRequestStatus" "BookingCancellationRequestStatus" NOT NULL DEFAULT 'NONE',
ADD COLUMN "cancellationRequestedAt" TIMESTAMP(3),
ADD COLUMN "cancellationReviewedAt" TIMESTAMP(3);
