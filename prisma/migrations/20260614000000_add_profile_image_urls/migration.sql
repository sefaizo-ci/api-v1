-- AlterTable
ALTER TABLE "public"."professionals" ADD COLUMN "profileImageUrls" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
