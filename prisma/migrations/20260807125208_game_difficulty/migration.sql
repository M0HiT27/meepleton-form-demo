-- CreateEnum
CREATE TYPE "GameDifficulty" AS ENUM ('LIGHT', 'MEDIUM', 'HEAVY');

-- AlterTable
ALTER TABLE "games" ADD COLUMN     "difficulty" "GameDifficulty" NOT NULL DEFAULT 'LIGHT';

-- AlterTable
ALTER TABLE "passes" ADD COLUMN     "minimum_difficult_games_to_select" INTEGER NOT NULL DEFAULT 0;
