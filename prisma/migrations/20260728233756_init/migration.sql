/*
  Warnings:

  - You are about to alter the column `price` on the `olist_order_items` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(10,2)`.
  - You are about to alter the column `freight_value` on the `olist_order_items` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(10,2)`.
  - You are about to alter the column `payment_value` on the `olist_order_payments` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(10,2)`.
  - A unique constraint covering the columns `[order_id,order_item_id]` on the table `olist_order_items` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[order_id,payment_sequential]` on the table `olist_order_payments` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[review_id,order_id]` on the table `olist_order_reviews` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "investigations" ADD COLUMN     "categories_json" JSONB,
ADD COLUMN     "customer_states_json" JSONB,
ADD COLUMN     "seller_ids_json" JSONB;

-- AlterTable
ALTER TABLE "olist_order_items" ALTER COLUMN "price" SET DATA TYPE DECIMAL(10,2),
ALTER COLUMN "freight_value" SET DATA TYPE DECIMAL(10,2);

-- AlterTable
ALTER TABLE "olist_order_payments" ALTER COLUMN "payment_value" SET DATA TYPE DECIMAL(10,2);

-- CreateIndex
CREATE UNIQUE INDEX "olist_order_items_order_id_order_item_id_key" ON "olist_order_items"("order_id", "order_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "olist_order_payments_order_id_payment_sequential_key" ON "olist_order_payments"("order_id", "payment_sequential");

-- CreateIndex
CREATE UNIQUE INDEX "olist_order_reviews_review_id_order_id_key" ON "olist_order_reviews"("review_id", "order_id");
