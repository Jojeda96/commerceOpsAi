import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seed() {
  console.log('🌱 Seeding CI database fixtures...');

  // 1. Create Sellers
  const sellerSP = await prisma.olistSeller.upsert({
    where: { id: 'seller-sp-1' },
    update: {},
    create: {
      id: 'seller-sp-1',
      sellerZipCodePrefix: '01000',
      sellerCity: 'sao paulo',
      sellerState: 'SP',
    },
  });

  const sellerRJ = await prisma.olistSeller.upsert({
    where: { id: 'seller-rj-1' },
    update: {},
    create: {
      id: 'seller-rj-1',
      sellerZipCodePrefix: '20000',
      sellerCity: 'rio de janeiro',
      sellerState: 'RJ',
    },
  });

  // 2. Create Customers
  const custSP = await prisma.olistCustomer.upsert({
    where: { id: 'cust-sp-1' },
    update: {},
    create: {
      id: 'cust-sp-1',
      customerUniqueId: 'unique-sp-1',
      customerZipCodePrefix: '02000',
      customerCity: 'sao paulo',
      customerState: 'SP',
    },
  });

  const custRJ = await prisma.olistCustomer.upsert({
    where: { id: 'cust-rj-1' },
    update: {},
    create: {
      id: 'cust-rj-1',
      customerUniqueId: 'unique-rj-1',
      customerZipCodePrefix: '21000',
      customerCity: 'rio de janeiro',
      customerState: 'RJ',
    },
  });

  // 3. Create Product
  const product = await prisma.olistProduct.upsert({
    where: { id: 'prod-1' },
    update: {},
    create: {
      id: 'prod-1',
      productCategoryName: 'beleza_saude',
      productNameLength: 40,
      productDescriptionLength: 500,
      productPhotosQty: 2,
      productWeightG: 500,
      productLengthCm: 20,
      productHeightCm: 10,
      productWidthCm: 15,
    },
  });

  // 4. Create sample monthly orders across 24 months for Anomaly and Logistics tests
  // Anomaly test needs 24 months, with 2 anomalous months (2018-02 and 2018-03).
  // Each normal month has 35 orders, 2 late (late rate ~5.7%).
  // 2018-02 has 35 orders, 6 late (late rate ~17.1%).
  // 2018-03 has 35 orders, 8 late (late rate ~22.8%).

  const months: string[] = [];
  for (let year = 2017; year <= 2018; year++) {
    for (let month = 1; month <= 12; month++) {
      const mStr = month < 10 ? `0${month}` : `${month}`;
      months.push(`${year}-${mStr}`);
    }
  }

  let orderCount = 0;
  for (const m of months) {
    const isAnom1 = m === '2018-02';
    const isAnom2 = m === '2018-03';

    const numOrders = 35;
    const numLate = isAnom2 ? 8 : isAnom1 ? 6 : 2;

    for (let i = 0; i < numOrders; i++) {
      orderCount++;
      const orderId = `ord-ci-${m}-${i}`;
      const isLate = i < numLate;
      const isInterstate = orderCount % 2 === 0;

      const purchaseDate = new Date(`${m}-15T10:00:00.000Z`);
      const approvedDate = new Date(`${m}-15T11:00:00.000Z`);
      const carrierDate = new Date(`${m}-16T10:00:00.000Z`);
      const estimatedDate = new Date(`${m}-25T10:00:00.000Z`);

      // If late, customer delivery is after estimated date
      const customerDate = isLate
        ? new Date(`${m}-28T10:00:00.000Z`)
        : new Date(`${m}-22T10:00:00.000Z`);

      const customerId = isInterstate ? custRJ.id : custSP.id;
      const sellerId = sellerSP.id;

      await prisma.olistOrder.upsert({
        where: { orderId },
        update: {},
        create: {
          orderId,
          customerId,
          orderStatus: 'delivered',
          orderPurchaseTimestamp: purchaseDate,
          orderApprovedAt: approvedDate,
          orderDeliveredCarrierDate: carrierDate,
          orderDeliveredCustomerDate: customerDate,
          orderEstimatedDeliveryDate: estimatedDate,
          items: {
            create: {
              orderItemId: 1,
              productId: product.id,
              sellerId,
              shippingLimitDate: estimatedDate,
              price: 50.0,
              freightValue: 15.0,
            },
          },
        },
      });
    }
  }

  console.log(`✅ Seeded ${orderCount} orders across 24 months for CI.`);
}

seed()
  .catch((e) => {
    console.error('❌ Error seeding CI fixtures:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
