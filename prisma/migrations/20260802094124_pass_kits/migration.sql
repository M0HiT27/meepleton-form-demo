-- AlterTable
ALTER TABLE "passes" ADD COLUMN     "kit_id" INTEGER;

-- CreateTable
CREATE TABLE "kits" (
    "id" SERIAL NOT NULL,
    "kit_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kit_items" (
    "id" SERIAL NOT NULL,
    "item_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kit_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kit_to_kit_item_mappings" (
    "id" SERIAL NOT NULL,
    "kit_id" INTEGER NOT NULL,
    "kit_item_id" INTEGER NOT NULL,

    CONSTRAINT "kit_to_kit_item_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "kits_kit_name_key" ON "kits"("kit_name");

-- CreateIndex
CREATE UNIQUE INDEX "kit_items_item_name_key" ON "kit_items"("item_name");

-- CreateIndex
CREATE INDEX "kit_to_kit_item_mappings_kit_item_id_idx" ON "kit_to_kit_item_mappings"("kit_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "kit_to_kit_item_mappings_kit_id_kit_item_id_key" ON "kit_to_kit_item_mappings"("kit_id", "kit_item_id");

-- CreateIndex
CREATE INDEX "passes_kit_id_idx" ON "passes"("kit_id");

-- AddForeignKey
ALTER TABLE "passes" ADD CONSTRAINT "passes_kit_id_fkey" FOREIGN KEY ("kit_id") REFERENCES "kits"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kit_to_kit_item_mappings" ADD CONSTRAINT "kit_to_kit_item_mappings_kit_id_fkey" FOREIGN KEY ("kit_id") REFERENCES "kits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kit_to_kit_item_mappings" ADD CONSTRAINT "kit_to_kit_item_mappings_kit_item_id_fkey" FOREIGN KEY ("kit_item_id") REFERENCES "kit_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
