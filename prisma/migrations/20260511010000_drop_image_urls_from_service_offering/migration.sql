-- AlterTable: replace imageUrls array with single imageUrl text column
ALTER TABLE "public"."service_offerings" DROP COLUMN IF EXISTS "imageUrls";
