-- AlterTable
ALTER TABLE "tbljoborders"
ADD COLUMN "jobs_done" TEXT,
ADD COLUMN "service_remarks" TEXT,
ADD COLUMN "mechanic_signatory_name" TEXT,
ADD COLUMN "mechanic_signature_data" TEXT,
ADD COLUMN "mechanic_signed_at" TIMESTAMPTZ,
ADD COLUMN "for_payment_at" TIMESTAMPTZ,
ADD COLUMN "payment_details" JSONB;