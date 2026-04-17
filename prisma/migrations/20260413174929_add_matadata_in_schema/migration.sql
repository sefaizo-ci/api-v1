-- AlterTable
ALTER TABLE "otp_codes" ADD COLUMN     "metadata" JSONB;

-- AlterTable
ALTER TABLE "refresh_tokens" ADD COLUMN     "metadata" JSONB;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "metadata" JSONB;
