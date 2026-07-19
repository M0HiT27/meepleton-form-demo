/*
  Warnings:

  - You are about to drop the column `discount_end` on the `passes` table. All the data in the column will be lost.
  - You are about to drop the column `discount_start` on the `passes` table. All the data in the column will be lost.
  - You are about to drop the column `discounted` on the `passes` table. All the data in the column will be lost.
  - You are about to drop the column `discounted_price` on the `passes` table. All the data in the column will be lost.
  - You are about to alter the column `price` on the `passes` table. The data in that column could be lost. The data in that column will be cast from `Decimal(10,2)` to `Integer`.

*/
-- AlterTable
ALTER TABLE "passes" DROP COLUMN "discount_end",
DROP COLUMN "discount_start",
DROP COLUMN "discounted",
DROP COLUMN "discounted_price",
ADD COLUMN     "pass_offer_id" INTEGER,
ALTER COLUMN "price" SET DATA TYPE INTEGER;

-- CreateTable
CREATE TABLE "pass_offers" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "discount_percent" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "start_time" TIMESTAMP(3) NOT NULL,
    "end_time" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pass_offers_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "passes" ADD CONSTRAINT "passes_pass_offer_id_fkey" FOREIGN KEY ("pass_offer_id") REFERENCES "pass_offers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
