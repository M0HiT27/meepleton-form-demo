-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('SUCCESS', 'FAILED', 'PENDING', 'REFUNDED');

-- CreateTable
CREATE TABLE "games" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "required_players" INTEGER NOT NULL,
    "max_slots" INTEGER NOT NULL,
    "current_booked_slots" INTEGER NOT NULL DEFAULT 0,
    "estimated_runtime_minutes" INTEGER NOT NULL,

    CONSTRAINT "games_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "passes" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "number_of_games" INTEGER NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "discounted" BOOLEAN NOT NULL DEFAULT false,
    "discounted_price" DECIMAL(10,2),
    "discount_start" TIMESTAMP(3),
    "discount_end" TIMESTAMP(3),

    CONSTRAINT "passes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "game_to_pass_mappings" (
    "id" SERIAL NOT NULL,
    "game_id" INTEGER NOT NULL,
    "pass_id" INTEGER NOT NULL,

    CONSTRAINT "game_to_pass_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "players" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "mobile" TEXT NOT NULL,

    CONSTRAINT "players_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" SERIAL NOT NULL,
    "transaction_id" TEXT NOT NULL,
    "status" "TransactionStatus" NOT NULL,
    "transaction_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "player_pass_purchases" (
    "id" SERIAL NOT NULL,
    "player_id" INTEGER NOT NULL,
    "pass_id" INTEGER NOT NULL,
    "purchase_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "transaction_id" INTEGER NOT NULL,

    CONSTRAINT "player_pass_purchases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "player_pass_selected_game_mappings" (
    "id" SERIAL NOT NULL,
    "player_pass_purchase_id" INTEGER NOT NULL,
    "game_id" INTEGER NOT NULL,

    CONSTRAINT "player_pass_selected_game_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "games_name_key" ON "games"("name");

-- CreateIndex
CREATE UNIQUE INDEX "passes_name_key" ON "passes"("name");

-- CreateIndex
CREATE UNIQUE INDEX "game_to_pass_mappings_game_id_pass_id_key" ON "game_to_pass_mappings"("game_id", "pass_id");

-- CreateIndex
CREATE UNIQUE INDEX "players_email_key" ON "players"("email");

-- CreateIndex
CREATE UNIQUE INDEX "players_mobile_key" ON "players"("mobile");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_transaction_id_key" ON "transactions"("transaction_id");

-- CreateIndex
CREATE UNIQUE INDEX "player_pass_selected_game_mappings_player_pass_purchase_id__key" ON "player_pass_selected_game_mappings"("player_pass_purchase_id", "game_id");

-- AddForeignKey
ALTER TABLE "game_to_pass_mappings" ADD CONSTRAINT "game_to_pass_mappings_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_to_pass_mappings" ADD CONSTRAINT "game_to_pass_mappings_pass_id_fkey" FOREIGN KEY ("pass_id") REFERENCES "passes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_pass_purchases" ADD CONSTRAINT "player_pass_purchases_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_pass_purchases" ADD CONSTRAINT "player_pass_purchases_pass_id_fkey" FOREIGN KEY ("pass_id") REFERENCES "passes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_pass_purchases" ADD CONSTRAINT "player_pass_purchases_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_pass_selected_game_mappings" ADD CONSTRAINT "player_pass_selected_game_mappings_player_pass_purchase_id_fkey" FOREIGN KEY ("player_pass_purchase_id") REFERENCES "player_pass_purchases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_pass_selected_game_mappings" ADD CONSTRAINT "player_pass_selected_game_mappings_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
