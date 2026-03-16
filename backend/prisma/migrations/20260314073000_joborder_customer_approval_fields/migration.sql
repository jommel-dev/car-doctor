-- AlterTable
ALTER TABLE "tbljoborders"
ADD COLUMN "customer_approval_summary" JSONB,
ADD COLUMN "customer_signature_data" TEXT,
ADD COLUMN "customer_approved_by" TEXT,
ADD COLUMN "customer_approved_at" TIMESTAMPTZ;