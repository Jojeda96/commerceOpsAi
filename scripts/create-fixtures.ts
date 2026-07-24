import fs from 'fs';
import path from 'path';
import csv from 'csv-parser';

const RAW_DIR = path.join(__dirname, '..', 'data', 'raw');
const FIXTURES_DIR = path.join(__dirname, '..', 'data', 'fixtures');

async function readCsvLimit<T>(filename: string, limit: number, filterKey?: string, filterValues?: Set<string>): Promise<T[]> {
  const filepath = path.join(RAW_DIR, filename);
  if (!fs.existsSync(filepath)) return [];

  const results: T[] = [];
  return new Promise((resolve, reject) => {
    fs.createReadStream(filepath)
      .pipe(csv())
      .on('data', (row) => {
        if (filterKey && filterValues && !filterValues.has(row[filterKey])) {
          return;
        }
        if (results.length < limit || filterKey) {
          results.push(row);
        }
      })
      .on('end', () => resolve(results))
      .on('error', reject);
  });
}

async function createFixtures() {
  console.log('📦 Generando fixtures de prueba (~1000 pedidos)...');

  if (!fs.existsSync(FIXTURES_DIR)) {
    fs.mkdirSync(FIXTURES_DIR, { recursive: true });
  }

  // 1. Obtener 1000 pedidos
  const rawOrders: any[] = await readCsvLimit('olist_orders_dataset.csv', 1000);
  const orderIds = new Set<string>(rawOrders.map((o) => o.order_id));
  const customerIds = new Set<string>(rawOrders.map((o) => o.customer_id));

  // 2. Obtener items relacionados
  const rawItems: any[] = await readCsvLimit('olist_order_items_dataset.csv', 10000, 'order_id', orderIds);
  const productIds = new Set<string>(rawItems.map((i) => i.product_id));
  const sellerIds = new Set<string>(rawItems.map((i) => i.seller_id));

  // 3. Obtener clientes, vendedores, productos, pagos, reviews
  const rawCustomers = await readCsvLimit('olist_customers_dataset.csv', 10000, 'customer_id', customerIds);
  const rawSellers = await readCsvLimit('olist_sellers_dataset.csv', 10000, 'seller_id', sellerIds);
  const rawProducts = await readCsvLimit('olist_products_dataset.csv', 10000, 'product_id', productIds);
  const rawPayments = await readCsvLimit('olist_order_payments_dataset.csv', 10000, 'order_id', orderIds);
  const rawReviews = await readCsvLimit('olist_order_reviews_dataset.csv', 10000, 'order_id', orderIds);

  const fixtures = {
    orders: rawOrders,
    customers: rawCustomers,
    sellers: rawSellers,
    products: rawProducts,
    orderItems: rawItems,
    payments: rawPayments,
    reviews: rawReviews,
  };

  const outputPath = path.join(FIXTURES_DIR, 'sample-1000-orders.json');
  fs.writeFileSync(outputPath, JSON.stringify(fixtures, null, 2), 'utf-8');

  console.log(`✅ Fixtures creados exitosamente en ${outputPath}`);
  console.log(`   Orders: ${rawOrders.length}`);
  console.log(`   Customers: ${rawCustomers.length}`);
  console.log(`   Sellers: ${rawSellers.length}`);
  console.log(`   Products: ${rawProducts.length}`);
  console.log(`   Items: ${rawItems.length}`);
  console.log(`   Payments: ${rawPayments.length}`);
  console.log(`   Reviews: ${rawReviews.length}`);
}

if (require.main === module) {
  createFixtures();
}
