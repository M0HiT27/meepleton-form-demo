-- CreateEnum
CREATE TYPE "InvoiceJobStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "swipe_customer_map" (
    "id" SERIAL NOT NULL,
    "phone_normalized" TEXT NOT NULL,
    "name_normalized" TEXT NOT NULL,
    "swipe_id" TEXT NOT NULL,
    "customer_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "swipe_customer_map_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_jobs" (
    "id" SERIAL NOT NULL,
    "purchase_id" INTEGER NOT NULL,
    "status" "InvoiceJobStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "swipe_doc_hash_id" TEXT,
    "invoice_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoice_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "swipe_customer_map_phone_normalized_idx" ON "swipe_customer_map"("phone_normalized");

-- CreateIndex
CREATE UNIQUE INDEX "swipe_customer_map_phone_normalized_name_normalized_key" ON "swipe_customer_map"("phone_normalized", "name_normalized");

-- CreateIndex
CREATE UNIQUE INDEX "invoice_jobs_purchase_id_key" ON "invoice_jobs"("purchase_id");

-- CreateIndex
CREATE INDEX "invoice_jobs_status_idx" ON "invoice_jobs"("status");
