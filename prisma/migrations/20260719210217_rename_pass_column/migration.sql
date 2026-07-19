/*
  Warnings:

  - You are about to drop the column `number_of_games` on the `passes` table. All the data in the column will be lost.
  - Added the required column `required_selection_count` to the `passes` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "passes" DROP COLUMN "number_of_games",
ADD COLUMN     "required_selection_count" INTEGER NOT NULL;
