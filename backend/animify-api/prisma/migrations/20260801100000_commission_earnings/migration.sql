-- AlterTable
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "earnings_balance_inr" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE IF NOT EXISTS "commission_entries" (
    "id" TEXT NOT NULL,
    "buyer_user_id" TEXT NOT NULL,
    "owner_user_id" TEXT,
    "payment_id" TEXT,
    "source" TEXT NOT NULL,
    "gross_inr" DECIMAL(12,2) NOT NULL,
    "api_budget_inr" DECIMAL(12,2) NOT NULL,
    "commission_inr" DECIMAL(12,2) NOT NULL,
    "margin_percent" INTEGER NOT NULL DEFAULT 55,
    "credits_granted" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "commission_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "commission_entries_buyer_user_id_idx" ON "commission_entries"("buyer_user_id");
CREATE INDEX IF NOT EXISTS "commission_entries_owner_user_id_idx" ON "commission_entries"("owner_user_id");
CREATE INDEX IF NOT EXISTS "commission_entries_created_at_idx" ON "commission_entries"("created_at");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "commission_entries" ADD CONSTRAINT "commission_entries_buyer_user_id_fkey"
    FOREIGN KEY ("buyer_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "commission_entries" ADD CONSTRAINT "commission_entries_owner_user_id_fkey"
    FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
