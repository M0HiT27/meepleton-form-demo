/*
  Warnings:

  - You are about to drop the column `player_id` on the `player_pass_purchases` table. All the data in the column will be lost.
  - You are about to drop the `players` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[transaction_id]` on the table `player_pass_purchases` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `description` to the `games` table without a default value. This is not possible if the table is not empty.
  - Added the required column `end_time` to the `passes` table without a default value. This is not possible if the table is not empty.
  - Added the required column `start_time` to the `passes` table without a default value. This is not possible if the table is not empty.
  - Added the required column `address` to the `player_pass_purchases` table without a default value. This is not possible if the table is not empty.
  - Added the required column `city` to the `player_pass_purchases` table without a default value. This is not possible if the table is not empty.
  - Added the required column `email` to the `player_pass_purchases` table without a default value. This is not possible if the table is not empty.
  - Added the required column `mobile` to the `player_pass_purchases` table without a default value. This is not possible if the table is not empty.
  - Added the required column `name` to the `player_pass_purchases` table without a default value. This is not possible if the table is not empty.
  - Added the required column `pincode` to the `player_pass_purchases` table without a default value. This is not possible if the table is not empty.
  - Added the required column `payment_method` to the `transactions` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "PurchaseStatus" AS ENUM ('PENDING', 'CONFIRMED', 'FAILED', 'CANCELLED');

-- DropForeignKey
ALTER TABLE "player_pass_purchases" DROP CONSTRAINT "player_pass_purchases_player_id_fkey";

-- AlterTable
ALTER TABLE "games" ADD COLUMN     "description" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "passes" ADD COLUMN     "end_time" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "start_time" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "player_pass_purchases" DROP COLUMN "player_id",
ADD COLUMN     "address" TEXT NOT NULL,
ADD COLUMN     "city" TEXT NOT NULL,
ADD COLUMN     "email" TEXT NOT NULL,
ADD COLUMN     "mobile" TEXT NOT NULL,
ADD COLUMN     "name" TEXT NOT NULL,
ADD COLUMN     "pincode" TEXT NOT NULL,
ADD COLUMN     "status" "PurchaseStatus" NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "payment_method" TEXT NOT NULL,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "transaction_id" DROP NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'PENDING';

-- DropTable
DROP TABLE "players";

-- CreateIndex
CREATE INDEX "game_to_pass_mappings_pass_id_idx" ON "game_to_pass_mappings"("pass_id");

-- CreateIndex
CREATE INDEX "passes_pass_offer_id_idx" ON "passes"("pass_offer_id");

-- CreateIndex
CREATE UNIQUE INDEX "player_pass_purchases_transaction_id_key" ON "player_pass_purchases"("transaction_id");

-- CreateIndex
CREATE INDEX "player_pass_purchases_pass_id_idx" ON "player_pass_purchases"("pass_id");

-- CreateIndex
CREATE INDEX "player_pass_purchases_email_idx" ON "player_pass_purchases"("email");

-- CreateIndex
CREATE INDEX "player_pass_purchases_mobile_idx" ON "player_pass_purchases"("mobile");

-- CreateIndex
CREATE INDEX "player_pass_selected_game_mappings_game_id_idx" ON "player_pass_selected_game_mappings"("game_id");
