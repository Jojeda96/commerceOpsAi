import fs from 'fs';
import path from 'path';
import csv from 'csv-parser';
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();
const RAW_DIR = path.join(__dirname, '..', 'data', 'raw');

function cleanRow(row: any): any {
  const cleaned: any = {};
  for (const key of Object.keys(row)) {
    const cleanKey = key.replace(/^\uFEFF/, '').trim();
    cleaned[cleanKey] = row[key];
  }
  return cleaned;
}

function parseDate(dateStr: string | undefined): Date | null {
  if (!dateStr || dateStr.trim() === '') return null;
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
}

function parseFloatNull(val: string | undefined): number | null {
  if (!val || val.trim() === '') return null;
  const n = parseFloat(val);
  return isNaN(n) ? null : n;
}

function parseIntNull(val: string | undefined): number | null {
  if (!val || val.trim() === '') return null;
  const n = parseInt(val, 10);
  return isNaN(n) ? null : n;
}

async function readCsvInBatches<T>(
  filename: string,
  transform: (row: any) => T | null,
  onBatch: (batch: T[]) => Promise<void>,
  batchSize = 2000
): Promise<number> {
  const filepath = path.join(RAW_DIR, filename);
  if (!fs.existsSync(filepath)) {
    console.log(`[SKIP] Archivo no encontrado: ${filename}`);
    return 0;
  }

  let batch: T[] = [];
  let totalProcessed = 0;

  return new Promise((resolve, reject) => {
    const stream = fs.createReadStream(filepath).pipe(csv());

    stream
      .on('data', (rawRow) => {
        try {
          const row = cleanRow(rawRow);
          const item = transform(row);
          if (item !== null && item !== undefined) {
            batch.push(item);
            if (batch.length >= batchSize) {
              const currentBatch = batch;
              batch = [];
              totalProcessed += currentBatch.length;

              stream.pause();
              onBatch(currentBatch)
                .then(() => stream.resume())
                .catch(reject);
            }
          }
        } catch (err) {
          console.error(`Error procesando fila en ${filename}:`, err);
        }
      })
      .on('end', async () => {
        try {
          if (batch.length > 0) {
            totalProcessed += batch.length;
            await onBatch(batch);
          }
          resolve(totalProcessed);
        } catch (err) {
          reject(err);
        }
      })
      .on('error', (error) => reject(error));
  });
}

async function main() {
  console.log('🚀 Iniciando importación masiva del dataset Olist...');
  const startTime = Date.now();

  try {
    // 1. Traducciones de categorías
    console.log('1/9 Importando ProductCategoryTranslation...');
    const catCount = await readCsvInBatches<Prisma.ProductCategoryTranslationCreateManyInput>(
      'product_category_name_translation.csv',
      (row) => ({
        productCategoryName: row.product_category_name,
        productCategoryNameEnglish: row.product_category_name_english,
      }),
      async (batch) => {
        await prisma.productCategoryTranslation.createMany({
          data: batch,
          skipDuplicates: true,
        });
      }
    );
    console.log(`   -> ${catCount} categorías importadas.`);

    // 2. Customers
    console.log('2/9 Importando OlistCustomer...');
    const custCount = await readCsvInBatches<Prisma.OlistCustomerCreateManyInput>(
      'olist_customers_dataset.csv',
      (row) => ({
        id: row.customer_id,
        customerUniqueId: row.customer_unique_id,
        customerZipCodePrefix: row.customer_zip_code_prefix,
        customerCity: row.customer_city,
        customerState: row.customer_state,
      }),
      async (batch) => {
        await prisma.olistCustomer.createMany({
          data: batch,
          skipDuplicates: true,
        });
      }
    );
    console.log(`   -> ${custCount} clientes importados.`);

    // 3. Sellers
    console.log('3/9 Importando OlistSeller...');
    const sellerCount = await readCsvInBatches<Prisma.OlistSellerCreateManyInput>(
      'olist_sellers_dataset.csv',
      (row) => ({
        id: row.seller_id,
        sellerZipCodePrefix: row.seller_zip_code_prefix,
        sellerCity: row.seller_city,
        sellerState: row.seller_state,
      }),
      async (batch) => {
        await prisma.olistSeller.createMany({
          data: batch,
          skipDuplicates: true,
        });
      }
    );
    console.log(`   -> ${sellerCount} vendedores importados.`);

    // 4. Products
    console.log('4/9 Importando OlistProduct...');
    const prodCount = await readCsvInBatches<Prisma.OlistProductCreateManyInput>(
      'olist_products_dataset.csv',
      (row) => ({
        id: row.product_id,
        productCategoryName: row.product_category_name || null,
        productNameLength: parseIntNull(row.product_name_lenght), // typo en CSV original
        productDescriptionLength: parseIntNull(row.product_description_lenght), // typo en CSV original
        productPhotosQty: parseIntNull(row.product_photos_qty),
        productWeightG: parseFloatNull(row.product_weight_g),
        productLengthCm: parseFloatNull(row.product_length_cm),
        productHeightCm: parseFloatNull(row.product_height_cm),
        productWidthCm: parseFloatNull(row.product_width_cm),
      }),
      async (batch) => {
        await prisma.olistProduct.createMany({
          data: batch,
          skipDuplicates: true,
        });
      }
    );
    console.log(`   -> ${prodCount} productos importados.`);

    // 5. Orders
    console.log('5/9 Importando OlistOrder...');
    const orderCount = await readCsvInBatches<Prisma.OlistOrderCreateManyInput>(
      'olist_orders_dataset.csv',
      (row): Prisma.OlistOrderCreateManyInput | null => {
        const purchaseDate = parseDate(row.order_purchase_timestamp);
        const estDelivery = parseDate(row.order_estimated_delivery_date);
        if (!purchaseDate || !estDelivery) return null;

        return {
          orderId: row.order_id,
          customerId: row.customer_id,
          orderStatus: row.order_status,
          orderPurchaseTimestamp: purchaseDate,
          orderApprovedAt: parseDate(row.order_approved_at),
          orderDeliveredCarrierDate: parseDate(row.order_delivered_carrier_date),
          orderDeliveredCustomerDate: parseDate(row.order_delivered_customer_date),
          orderEstimatedDeliveryDate: estDelivery,
        };
      },
      async (batch) => {
        await prisma.olistOrder.createMany({
          data: batch,
          skipDuplicates: true,
        });
      }
    );
    console.log(`   -> ${orderCount} pedidos importados.`);

    // Map internal order IDs
    console.log('   Cargando mapa de order_id -> database ID...');
    const ordersMap = new Map<string, string>();
    const allOrders = await prisma.olistOrder.findMany({
      select: { id: true, orderId: true },
    });
    for (const o of allOrders) {
      ordersMap.set(o.orderId, o.id);
    }

    // 6. Order Items
    console.log('6/9 Importando OlistOrderItem...');
    const itemCount = await readCsvInBatches<Prisma.OlistOrderItemCreateManyInput>(
      'olist_order_items_dataset.csv',
      (row): Prisma.OlistOrderItemCreateManyInput | null => {
        const dbOrderId = ordersMap.get(row.order_id);
        const shipLimit = parseDate(row.shipping_limit_date);
        if (!dbOrderId || !shipLimit) return null;

        return {
          orderId: dbOrderId,
          orderItemId: parseInt(row.order_item_id, 10),
          productId: row.product_id,
          sellerId: row.seller_id,
          shippingLimitDate: shipLimit,
          price: parseFloat(row.price),
          freightValue: parseFloat(row.freight_value),
        };
      },
      async (batch) => {
        await prisma.olistOrderItem.createMany({
          data: batch,
          skipDuplicates: true,
        });
      }
    );
    console.log(`   -> ${itemCount} items importados.`);

    // 7. Payments
    console.log('7/9 Importando OlistOrderPayment...');
    const payCount = await readCsvInBatches<Prisma.OlistOrderPaymentCreateManyInput>(
      'olist_order_payments_dataset.csv',
      (row): Prisma.OlistOrderPaymentCreateManyInput | null => {
        const dbOrderId = ordersMap.get(row.order_id);
        if (!dbOrderId) return null;

        return {
          orderId: dbOrderId,
          paymentSequential: parseInt(row.payment_sequential, 10),
          paymentType: row.payment_type,
          paymentInstallments: parseInt(row.payment_installments, 10),
          paymentValue: parseFloat(row.payment_value),
        };
      },
      async (batch) => {
        await prisma.olistOrderPayment.createMany({
          data: batch,
          skipDuplicates: true,
        });
      }
    );
    console.log(`   -> ${payCount} pagos importados.`);

    // 8. Reviews
    console.log('8/9 Importando OlistOrderReview...');
    const reviewCount = await readCsvInBatches<Prisma.OlistOrderReviewCreateManyInput>(
      'olist_order_reviews_dataset.csv',
      (row): Prisma.OlistOrderReviewCreateManyInput | null => {
        const dbOrderId = ordersMap.get(row.order_id);
        const creationDate = parseDate(row.review_creation_date);
        const answerTime = parseDate(row.review_answer_timestamp);
        if (!dbOrderId || !creationDate || !answerTime) return null;

        return {
          reviewId: row.review_id,
          orderId: dbOrderId,
          reviewScore: parseInt(row.review_score, 10),
          reviewCommentTitle: row.review_comment_title || null,
          reviewCommentMessage: row.review_comment_message || null,
          reviewCreationDate: creationDate,
          reviewAnswerTimestamp: answerTime,
        };
      },
      async (batch) => {
        await prisma.olistOrderReview.createMany({
          data: batch,
          skipDuplicates: true,
        });
      }
    );
    console.log(`   -> ${reviewCount} reseñas importadas.`);

    // 9. Geolocation
    console.log('9/9 Importando OlistGeolocation (lotes de 5000)...');
    const geoCount = await readCsvInBatches<Prisma.OlistGeolocationCreateManyInput>(
      'olist_geolocation_dataset.csv',
      (row) => ({
        geolocationZipCodePrefix: row.geolocation_zip_code_prefix,
        geolocationLat: parseFloat(row.geolocation_lat),
        geolocationLng: parseFloat(row.geolocation_lng),
        geolocationCity: row.geolocation_city,
        geolocationState: row.geolocation_state,
      }),
      async (batch) => {
        await prisma.olistGeolocation.createMany({
          data: batch,
          skipDuplicates: true,
        });
      },
      5000
    );
    console.log(`   -> ${geoCount} geolocalizaciones importadas.`);

    const durationSec = Math.round((Date.now() - startTime) / 1000);
    console.log(`\n🎉 Importación masiva completada con éxito en ${durationSec}s!`);
  } catch (error) {
    console.error('\n❌ Error durante la importación:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main();
}
