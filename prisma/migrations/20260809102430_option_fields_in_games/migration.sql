-- AlterTable
ALTER TABLE "games" ALTER COLUMN "required_players" DROP NOT NULL,
ALTER COLUMN "estimated_runtime_minutes" DROP NOT NULL;
