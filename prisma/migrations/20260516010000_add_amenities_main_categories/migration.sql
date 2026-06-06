-- AlterTable
ALTER TABLE "public"."professionals" ADD COLUMN "amenities" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "public"."professionals" ADD COLUMN "mainCategories" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
