import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { PrismaService } from '../../database/prisma.service';
import { AnalysisScope, EvidenceMetric } from '@commerce-ops/shared-types';

function buildSalesScope(input: {
  dateFrom?: string;
  dateTo?: string;
  scopeHash?: string;
}): AnalysisScope {
  return {
    dateFrom: input.dateFrom,
    dateTo: input.dateTo,
    interstateOnly: false,
    provenance: [],
    scopeHash: input.scopeHash || 'global-scope',
  };
}

export function createSalesTools(prisma: PrismaService) {
  const getRevenueSummary = tool(
    async ({ dateFrom, dateTo }) => {
      const where: any = {};
      if (dateFrom || dateTo) {
        where.orderPurchaseTimestamp = {};
        if (dateFrom) where.orderPurchaseTimestamp.gte = new Date(dateFrom);
        if (dateTo) where.orderPurchaseTimestamp.lte = new Date(dateTo);
      }

      const itemsAgg = await prisma.olistOrderItem.aggregate({
        _sum: { price: true, freightValue: true },
        _count: { id: true },
        where: { order: where },
      });

      const totalOrders = await prisma.olistOrder.count({ where });
      const revenue = Number(itemsAgg._sum.price || 0);
      const freightTotal = Number(itemsAgg._sum.freightValue || 0);
      const avgOrderValue =
        totalOrders > 0 ? (revenue + freightTotal) / totalOrders : 0;

      return JSON.stringify({
        revenue,
        freightTotal,
        totalOrders,
        totalItems: itemsAgg._count.id || 0,
        averageOrderValue: Math.round(avgOrderValue * 100) / 100,
      });
    },
    {
      name: 'get_revenue_summary',
      description:
        'Calcula el resumen de facturación, total de pedidos, costo de envío y ticket promedio.',
      schema: z.object({
        dateFrom: z
          .string()
          .optional()
          .describe('Fecha inicio en formato ISO (ej: 2018-02-01)'),
        dateTo: z
          .string()
          .optional()
          .describe('Fecha fin en formato ISO (ej: 2018-02-28)'),
      }),
    },
  );

  const getSalesByCategory = tool(
    async ({ dateFrom, dateTo, topN = 10, scopeHash = 'global-scope' }) => {
      const where: any = {};

      if (dateFrom || dateTo) {
        where.order = { orderPurchaseTimestamp: {} };

        if (dateFrom) {
          where.order.orderPurchaseTimestamp.gte = new Date(dateFrom);
        }

        if (dateTo) {
          where.order.orderPurchaseTimestamp.lte = new Date(dateTo);
        }
      }

      const items = await prisma.olistOrderItem.findMany({
        where,
        select: {
          orderId: true,
          price: true,
          product: {
            select: {
              productCategoryName: true,
            },
          },
        },
      });

      const appliedScope = buildSalesScope({
        dateFrom,
        dateTo,
        scopeHash,
      });

      if (items.length === 0) {
        return JSON.stringify({
          status: 'NO_DATA',
          reasonCode: 'NO_SALES_ITEMS_IN_SCOPE',
          scopeHash,
          appliedScope,
          rowCount: 0,
          sampleSize: 0,
          methods: ['CATEGORY_REVENUE_AGGREGATION'],
          metrics: [],
          data: [],
        });
      }

      const catAgg: Record<
        string,
        {
          revenue: number;
          items: number;
          orderIds: Set<string>;
        }
      > = {};

      for (const item of items) {
        const category = item.product?.productCategoryName || 'sin_categoria';

        if (!catAgg[category]) {
          catAgg[category] = {
            revenue: 0,
            items: 0,
            orderIds: new Set<string>(),
          };
        }

        catAgg[category].revenue += Number(item.price);
        catAgg[category].items += 1;
        catAgg[category].orderIds.add(item.orderId);
      }

      const rows = Object.entries(catAgg)
        .map(([category, data]) => {
          const uniqueOrders = data.orderIds.size;
          const revenue = Math.round(data.revenue * 100) / 100;

          const averageOrderValue =
            uniqueOrders > 0
              ? Math.round((revenue / uniqueOrders) * 100) / 100
              : 0;

          return {
            category,
            revenue,
            items: data.items,
            uniqueOrders,
            averageOrderValue,
          };
        })
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, topN);

      const metrics: EvidenceMetric[] = rows.flatMap((row) => {
        const safeCategory = row.category;

        return [
          {
            key: `sales.category.${safeCategory}.revenue`,
            label: `Ingresos categoría ${safeCategory}`,
            value: row.revenue,
            unit: 'BRL' as const,
            sampleSize: row.uniqueOrders,
            sourcePath: `$.data[?(@.category=='${safeCategory}')].revenue`,
            aggregation: 'SUM' as const,
          },
          {
            key: `sales.category.${safeCategory}.orders`,
            label: `Pedidos únicos categoría ${safeCategory}`,
            value: row.uniqueOrders,
            unit: 'COUNT' as const,
            sampleSize: row.uniqueOrders,
            sourcePath: `$.data[?(@.category=='${safeCategory}')].uniqueOrders`,
            aggregation: 'COUNT' as const,
          },
          {
            key: `sales.category.${safeCategory}.aov`,
            label: `Ticket promedio categoría ${safeCategory}`,
            value: row.averageOrderValue,
            unit: 'BRL' as const,
            sampleSize: row.uniqueOrders,
            sourcePath: `$.data[?(@.category=='${safeCategory}')].averageOrderValue`,
            aggregation: 'MEAN' as const,
          },
        ];
      });

      return JSON.stringify({
        status: 'AVAILABLE',
        scopeHash,
        appliedScope,
        rowCount: items.length,
        sampleSize: items.length,
        methods: ['CATEGORY_REVENUE_AGGREGATION'],
        metrics,
        data: rows,
      });
    },
    {
      name: 'get_sales_by_category',
      description:
        'Agrupa las ventas por categoría de producto, ordenadas por mayores ingresos, e incluye pedidos únicos y ticket promedio por categoría.',
      schema: z.object({
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
        topN: z.number().int().min(1).max(50).default(10),
        scopeHash: z.string().default('global-scope'),
      }),
    },
  );

  const getSalesByPaymentMethod = tool(
    async ({ dateFrom, dateTo, scopeHash = 'global-scope' }) => {
      const where: any = {};

      if (dateFrom || dateTo) {
        where.order = {
          orderPurchaseTimestamp: {},
        };

        if (dateFrom) {
          where.order.orderPurchaseTimestamp.gte = new Date(dateFrom);
        }

        if (dateTo) {
          where.order.orderPurchaseTimestamp.lte = new Date(dateTo);
        }
      }

      const payments = await prisma.olistOrderPayment.findMany({
        where,
        select: {
          paymentType: true,
          paymentValue: true,
          paymentInstallments: true,
        },
      });

      const appliedScope = buildSalesScope({
        dateFrom,
        dateTo,
        scopeHash,
      });

      if (payments.length === 0) {
        return JSON.stringify({
          status: 'NO_DATA',
          reasonCode: 'NO_PAYMENTS_IN_SCOPE',
          scopeHash,
          appliedScope,
          rowCount: 0,
          sampleSize: 0,
          methods: ['PAYMENT_METHOD_AGGREGATION'],
          metrics: [],
          data: {
            paymentMethods: [],
            comparison: null,
          },
        });
      }

      const agg: Record<
        string,
        {
          totalValue: number;
          count: number;
          totalInstallments: number;
        }
      > = {};

      for (const payment of payments) {
        const type = payment.paymentType || 'other';

        if (!agg[type]) {
          agg[type] = {
            totalValue: 0,
            count: 0,
            totalInstallments: 0,
          };
        }

        agg[type].totalValue += Number(payment.paymentValue);
        agg[type].count += 1;
        agg[type].totalInstallments += payment.paymentInstallments;
      }

      const paymentMethods = Object.entries(agg).map(([paymentType, data]) => ({
        paymentType,
        totalValue: Math.round(data.totalValue * 100) / 100,
        transactionCount: data.count,
        avgPaymentValue: Math.round((data.totalValue / data.count) * 100) / 100,
        avgInstallments:
          Math.round((data.totalInstallments / data.count) * 10) / 10,
      }));

      const credit = paymentMethods.find(
        (p) => p.paymentType === 'credit_card',
      );

      const boleto = paymentMethods.find((p) => p.paymentType === 'boleto');

      const comparison =
        credit && boleto
          ? {
              revenueDelta:
                Math.round((credit.totalValue - boleto.totalValue) * 100) / 100,

              revenueDeltaPct:
                boleto.totalValue > 0
                  ? Math.round(
                      ((credit.totalValue - boleto.totalValue) /
                        boleto.totalValue) *
                        10000,
                    ) / 100
                  : null,

              transactionDelta:
                credit.transactionCount - boleto.transactionCount,

              transactionDeltaPct:
                boleto.transactionCount > 0
                  ? Math.round(
                      ((credit.transactionCount - boleto.transactionCount) /
                        boleto.transactionCount) *
                        10000,
                    ) / 100
                  : null,
            }
          : null;

      const metrics: EvidenceMetric[] = [];

      for (const row of paymentMethods) {
        metrics.push(
          {
            key: `sales.payment.${row.paymentType}.total_value`,
            label: `Ingresos método ${row.paymentType}`,
            value: row.totalValue,
            unit: 'BRL',
            sampleSize: row.transactionCount,
            sourcePath: `$.data.paymentMethods[?(@.paymentType=='${row.paymentType}')].totalValue`,
            aggregation: 'SUM',
          },
          {
            key: `sales.payment.${row.paymentType}.transaction_count`,
            label: `Transacciones método ${row.paymentType}`,
            value: row.transactionCount,
            unit: 'COUNT',
            sampleSize: row.transactionCount,
            sourcePath: `$.data.paymentMethods[?(@.paymentType=='${row.paymentType}')].transactionCount`,
            aggregation: 'COUNT',
          },
        );
      }

      if (comparison) {
        metrics.push(
          {
            key: 'sales.payment.comparison.revenue_delta',
            label: 'Diferencia de ingresos credit_card vs boleto',
            value: comparison.revenueDelta,
            unit: 'BRL',
            sampleSize: payments.length,
            sourcePath: '$.data.comparison.revenueDelta',
            aggregation: 'SUM',
          },
          {
            key: 'sales.payment.comparison.revenue_delta_pct',
            label: 'Diferencia porcentual de ingresos credit_card vs boleto',
            value: comparison.revenueDeltaPct ?? 0,
            unit: 'PERCENT',
            sampleSize: payments.length,
            sourcePath: '$.data.comparison.revenueDeltaPct',
            aggregation: 'MEAN',
          },
          {
            key: 'sales.payment.comparison.transaction_delta',
            label: 'Diferencia de transacciones credit_card vs boleto',
            value: comparison.transactionDelta,
            unit: 'COUNT',
            sampleSize: payments.length,
            sourcePath: '$.data.comparison.transactionDelta',
            aggregation: 'COUNT',
          },
          {
            key: 'sales.payment.comparison.transaction_delta_pct',
            label:
              'Diferencia porcentual de transacciones credit_card vs boleto',
            value: comparison.transactionDeltaPct ?? 0,
            unit: 'PERCENT',
            sampleSize: payments.length,
            sourcePath: '$.data.comparison.transactionDeltaPct',
            aggregation: 'MEAN',
          },
        );
      }

      return JSON.stringify({
        status: 'AVAILABLE',
        scopeHash,
        appliedScope,
        rowCount: payments.length,
        sampleSize: payments.length,
        methods: ['PAYMENT_METHOD_AGGREGATION'],
        metrics,
        data: {
          paymentMethods,
          comparison,
        },
      });
    },
    {
      name: 'get_sales_by_payment_method',
      description:
        'Compara ventas por método de pago y calcula diferencias entre tarjeta de crédito y boleto bancario.',
      schema: z.object({
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
        scopeHash: z.string().default('global-scope'),
      }),
    },
  );

  const getAverageOrderValueTrend = tool(
    async ({ dateFrom, dateTo }) => {
      const where: any = {};
      if (dateFrom || dateTo) {
        where.orderPurchaseTimestamp = {};
        if (dateFrom) where.orderPurchaseTimestamp.gte = new Date(dateFrom);
        if (dateTo) where.orderPurchaseTimestamp.lte = new Date(dateTo);
      }

      const orders = await prisma.olistOrder.findMany({
        where,
        select: {
          orderPurchaseTimestamp: true,
          payments: { select: { paymentValue: true } },
        },
        orderBy: { orderPurchaseTimestamp: 'asc' },
      });

      const monthlyMap: Record<string, { totalValue: number; count: number }> =
        {};
      for (const o of orders) {
        const monthKey = o.orderPurchaseTimestamp.toISOString().substring(0, 7); // YYYY-MM
        const orderVal = o.payments.reduce(
          (sum, p) => sum + Number(p.paymentValue),
          0,
        );
        if (!monthlyMap[monthKey])
          monthlyMap[monthKey] = { totalValue: 0, count: 0 };
        monthlyMap[monthKey].totalValue += orderVal;
        monthlyMap[monthKey].count += 1;
      }

      const trend = Object.entries(monthlyMap).map(([month, data]) => ({
        month,
        ordersCount: data.count,
        totalRevenue: Math.round(data.totalValue * 100) / 100,
        avgOrderValue:
          Math.round((data.totalValue / (data.count || 1)) * 100) / 100,
      }));

      return JSON.stringify(trend);
    },
    {
      name: 'get_average_order_value_trend',
      description:
        'Calcula la tendencia mensual del ticket promedio (AOV) y volumen de ventas.',
      schema: z.object({
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
      }),
    },
  );

  return [
    getRevenueSummary,
    getSalesByCategory,
    getSalesByPaymentMethod,
    getAverageOrderValueTrend,
  ];
}
