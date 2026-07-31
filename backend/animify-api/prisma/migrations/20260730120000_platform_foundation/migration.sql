-- CreateEnum
CREATE TYPE "JobType" AS ENUM ('STYLIZE', 'TEXT_TO_VIDEO', 'IMAGE_TO_VIDEO', 'AVATAR', 'DUB', 'SUBTITLE', 'VOICE', 'SCRIPT', 'IMAGE_GEN', 'BG_REMOVE', 'EDIT_TRIM', 'EDIT_MERGE', 'EDIT_CROP', 'EDIT_FILTER', 'EDIT_EXPORT');

-- CreateEnum
CREATE TYPE "CreditTxnType" AS ENUM ('GRANT', 'DEBIT', 'REFUND', 'PURCHASE', 'PROMO');

-- CreateEnum
CREATE TYPE "AssetType" AS ENUM ('VIDEO', 'IMAGE', 'AUDIO', 'SUBTITLE', 'OTHER');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "FileType" ADD VALUE 'AUDIO';
ALTER TYPE "FileType" ADD VALUE 'SUBTITLE';
ALTER TYPE "FileType" ADD VALUE 'IMAGE';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'SUBSCRIPTION';
ALTER TYPE "NotificationType" ADD VALUE 'CREDITS_LOW';
ALTER TYPE "NotificationType" ADD VALUE 'JOB_FAILED';

-- DropForeignKey
ALTER TABLE "video_jobs" DROP CONSTRAINT "video_jobs_input_file_id_fkey";

-- AlterTable
ALTER TABLE "coupons" ADD COLUMN     "credit_grant" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "invoice_url" TEXT;

-- AlterTable
ALTER TABLE "refresh_tokens" ADD COLUMN "family_id" TEXT,
ADD COLUMN "replaced_by_hash" TEXT;

UPDATE "refresh_tokens" SET "family_id" = gen_random_uuid()::text WHERE "family_id" IS NULL;

ALTER TABLE "refresh_tokens" ALTER COLUMN "family_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "subscriptions" ADD COLUMN     "stripe_customer_id" TEXT,
ADD COLUMN     "stripe_sub_id" TEXT;

-- AlterTable
ALTER TABLE "usage" ADD COLUMN     "api_calls" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "apple_id" TEXT,
ADD COLUMN     "credit_balance" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "fcm_token" TEXT,
ADD COLUMN     "locale" TEXT NOT NULL DEFAULT 'en';

-- AlterTable
ALTER TABLE "video_jobs" ADD COLUMN     "bull_job_id" TEXT,
ADD COLUMN     "credits_cost" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "job_type" "JobType" NOT NULL DEFAULT 'STYLIZE',
ADD COLUMN     "project_id" TEXT,
ADD COLUMN     "prompt" TEXT,
ADD COLUMN     "provider" TEXT NOT NULL DEFAULT 'oss',
ALTER COLUMN "input_file_id" DROP NOT NULL,
ALTER COLUMN "settings" SET DEFAULT '{}';

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "cover_url" TEXT,
    "is_favorite" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assets" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "project_id" TEXT,
    "type" "AssetType" NOT NULL,
    "storage_key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" BIGINT NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_ledgers" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" "CreditTxnType" NOT NULL,
    "amount" INTEGER NOT NULL,
    "balance_after" INTEGER NOT NULL,
    "reason" TEXT,
    "job_id" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_ledgers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "voices" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "name" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'en',
    "preview_url" TEXT,
    "is_clone" BOOLEAN NOT NULL DEFAULT false,
    "is_public" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "voices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feature_flags" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "config" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feature_flags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "favorites" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "favorites_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "projects_user_id_idx" ON "projects"("user_id");

-- CreateIndex
CREATE INDEX "assets_user_id_idx" ON "assets"("user_id");

-- CreateIndex
CREATE INDEX "assets_project_id_idx" ON "assets"("project_id");

-- CreateIndex
CREATE INDEX "credit_ledgers_user_id_idx" ON "credit_ledgers"("user_id");

-- CreateIndex
CREATE INDEX "credit_ledgers_created_at_idx" ON "credit_ledgers"("created_at");

-- CreateIndex
CREATE INDEX "voices_user_id_idx" ON "voices"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "feature_flags_key_key" ON "feature_flags"("key");

-- CreateIndex
CREATE UNIQUE INDEX "favorites_user_id_job_id_key" ON "favorites"("user_id", "job_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_family_id_idx" ON "refresh_tokens"("family_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_apple_id_key" ON "users"("apple_id");

-- CreateIndex
CREATE INDEX "video_jobs_job_type_idx" ON "video_jobs"("job_type");

-- CreateIndex
CREATE INDEX "video_jobs_project_id_idx" ON "video_jobs"("project_id");

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_ledgers" ADD CONSTRAINT "credit_ledgers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voices" ADD CONSTRAINT "voices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "video_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_jobs" ADD CONSTRAINT "video_jobs_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_jobs" ADD CONSTRAINT "video_jobs_input_file_id_fkey" FOREIGN KEY ("input_file_id") REFERENCES "video_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;
