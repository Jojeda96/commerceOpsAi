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

  // 5. Create Sample Order Reviews for Customer Experience Tests
  const sampleReviewTemplates = [
    // DELIVERY_DELAY - LATE_DELIVERY
    { score: 1, text: 'O produto chegou com muito atraso, a entrega demorou demais.' },
    { score: 2, text: 'Muito atrasado a entrega, demorou dias a mais.' },
    { score: 1, text: 'Entrega com atraso consideravel, fiquei chateado com a demora.' },
    { score: 2, text: 'Chegou muito tarde do esperado.' },

    // DELIVERY_DELAY - NOT_DELIVERED
    { score: 1, text: 'Nao recebi o produto ate agora, o pedido nao chegou.' },
    { score: 1, text: 'Produto nao entregue na minha residencia, nunca chegou.' },
    { score: 1, text: 'Ainda nao recebi nada, pedido nao entregue.' },

    // DELIVERY_DELAY - DEADLINE_MISSED
    { score: 2, text: 'A entrega foi realizada totalmente fora do prazo combinado.' },
    { score: 1, text: 'Passou do prazo de entrega estipulado na compra.' },
    { score: 2, text: 'Prazo vencido e o produto demorou para ser postado.' },

    // PACKAGE_DAMAGE - BROKEN_PRODUCT
    { score: 1, text: 'O produto veio totalmente quebrado dentro da caixa.' },
    { score: 1, text: 'Item rachado e partido, pessima qualidade de embalagem.' },
    { score: 1, text: 'Veio com a peca quebrada ao abrir o pacote.' },

    // PACKAGE_DAMAGE - DAMAGED_PRODUCT
    { score: 2, text: 'O produto veio danificado e estragado no transporte.' },
    { score: 1, text: 'Mercadoria totalmente avariada e estragada.' },
    { score: 2, text: 'Produto veio danificada, necessito de troca urgente.' },

    // PACKAGE_DAMAGE - DAMAGED_PACKAGING
    { score: 2, text: 'A caixa veio amassada e a embalagem aberta.' },
    { score: 1, text: 'Pacote rasgado e embalagem danificada pelo correio.' },
    { score: 2, text: 'Caixa quebrada e amassada na entrega.' },

    // NEUTRAL / POSITIVE
    { score: 5, text: 'Produto excelente, entrega dentro do prazo normal.' },
    { score: 5, text: 'Muito bom produto, chegou perfeitamente.' },
    { score: 4, text: 'Gostei bastante do produto, recomendo a loja.' },
    { score: 5, text: 'Tudo perfeito e entrega rapida.' },
    { score: 4, text: 'Atendeu as expectativas, produto de boa qualidade.' },
    { score: 5, text: 'Excelente atendimento e envio muito agil.' },
  ];

  const createdOrders = await prisma.olistOrder.findMany({
    where: {
      orderId: {
        startsWith: 'ord-ci-',
      },
    },
    orderBy: {
      orderId: 'asc',
    },
    take: sampleReviewTemplates.length,
    select: {
      id: true,
      orderId: true,
      orderPurchaseTimestamp: true,
    },
  });

  if (createdOrders.length < sampleReviewTemplates.length) {
    throw new Error(
      `CI seed expected at least ${sampleReviewTemplates.length} orders ` +
        `but found ${createdOrders.length}.`,
    );
  }

  let reviewCount = 0;
  for (let idx = 0; idx < createdOrders.length; idx++) {
    const order = createdOrders[idx];
    const tmpl = sampleReviewTemplates[idx];
    const reviewId = `rev-ci-${idx + 1}`;

    const creationDate = new Date(order.orderPurchaseTimestamp.getTime() + 86400000 * 5);
    const answerDate = new Date(creationDate.getTime() + 86400000);

    await prisma.olistOrderReview.upsert({
      where: {
        reviewId_orderId: {
          reviewId,
          orderId: order.id,
        },
      },
      update: {},
      create: {
        reviewId,
        orderId: order.id,
        reviewScore: tmpl.score,
        reviewCommentTitle: tmpl.score <= 2 ? 'Reclamacao' : 'Elogio',
        reviewCommentMessage: tmpl.text,
        reviewCreationDate: creationDate,
        reviewAnswerTimestamp: answerDate,

        // Required scalar-list fields in OlistOrderReview
        embedding: [],
        secondaryTopics: [],
      },
    });
    reviewCount++;
  }

  console.log(`✅ Seeded ${reviewCount} order reviews for CX tests.`);
}

seed()
  .catch((e) => {
    console.error('❌ Error seeding CI fixtures:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
