/*
  Warnings:

  - You are about to drop the `invoice_jobs` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[dial_code,phone_normalized,name_normalized]` on the table `swipe_customer_map` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `dial_code` to the `player_pass_purchases` table without a default value. This is not possible if the table is not empty.
  - Added the required column `dial_code` to the `swipe_customer_map` table without a default value. This is not possible if the table is not empty.
  - Made the column `customer_id` on table `swipe_customer_map` required. This step will fail if there are existing NULL values in that column.

*/
-- DropIndex
DROP INDEX "swipe_customer_map_phone_normalized_idx";

-- DropIndex
DROP INDEX "swipe_customer_map_phone_normalized_name_normalized_key";

-- AlterTable
ALTER TABLE "player_pass_purchases" ADD COLUMN     "dial_code" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "swipe_customer_map" ADD COLUMN     "dial_code" TEXT NOT NULL,
ALTER COLUMN "customer_id" SET NOT NULL;

-- DropTable
DROP TABLE "invoice_jobs";

-- DropEnum
DROP TYPE "InvoiceJobStatus";

-- CreateIndex
CREATE UNIQUE INDEX "swipe_customer_map_dial_code_phone_normalized_name_normaliz_key" ON "swipe_customer_map"("dial_code", "phone_normalized", "name_normalized");
