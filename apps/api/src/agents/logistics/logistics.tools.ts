import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { PrismaService } from '../../database/prisma.service';
import { DeliveryScopeRepository } from './delivery-scope.repository';
import {
  computeDeliveryAggregate,
  computeRouteDistribution,
  computeStageBreakdown,
} from './logistics-metrics';
import { AnalysisScope, METRIC_LABELS } from '@commerce-ops/shared-types';

export function createLogisticsTools(prisma: PrismaService) {
  const scopeRepo = new DeliveryScopeRepository(prisma);

  const getDeliverySummary = tool(
    async ({
      dateFrom,
      dateTo,
      categories,
      sellerStates,
      customerStates,
      interstateOnly = false,
      scopeHash = 'unspecified',
    }) => {
      const scope: AnalysisScope = {
        dateFrom,
        dateTo,
        categories,
        sellerStates,
        customerStates,
        interstateOnly: Boolean(interstateOnly),
        provenance: [],
        scopeHash,
      };

      const { orders, diagnostics } =
        await scopeRepo.getScopedDeliveredOrders(scope);
      const aggregate = computeDeliveryAggregate(orders);

      if (!aggregate || aggregate.deliveredOrders === 0) {
        return JSON.stringify({
          status: 'NO_DATA',
          reasonCode: 'NO_DELIVERED_ORDERS_IN_SCOPE',
          scopeHash,
          appliedScope: scope,
          rowCount: 0,
          sampleSize: 0,
          methods: ['DESCRIPTIVE_AGGREGATION'],
          metrics: [],
          data: null,
          diagnostics,
        });
      }

      const metrics = [
        {
          key: 'delivery.aggregate.delivered_orders',
          label:
            METRIC_LABELS['delivery.aggregate.delivered_orders'] ||
            'Total de pedidos entregados',
          value: aggregate.deliveredOrders,
          unit: 'COUNT' as const,
          sampleSize: aggregate.deliveredOrders,
          sourcePath: '$.data.deliveredOrders',
          aggregation: 'COUNT' as const,
        },
        {
          key: 'delivery.aggregate.late_orders',
          label:
            METRIC_LABELS['delivery.aggregate.late_orders'] ||
            'Total de pedidos entregados tarde',
          value: aggregate.lateOrders,
          unit: 'COUNT' as const,
          sampleSize: aggregate.deliveredOrders,
          sourcePath: '$.data.lateOrders',
          aggregation: 'COUNT' as const,
        },
        {
          key: 'delivery.aggregate.late_rate_pct',
          label:
            METRIC_LABELS['delivery.aggregate.late_rate_pct'] ||
            'Tasa histórica agregada de atraso',
          value: aggregate.aggregateLateRatePct,
          unit: 'PERCENT' as const,
          sampleSize: aggregate.deliveredOrders,
          sourcePath: '$.data.aggregateLateRatePct',
          aggregation: 'WEIGHTED_RATE' as const,
        },
        {
          key: 'delivery.aggregate.avg_delivery_days',
          label:
            METRIC_LABELS['delivery.aggregate.avg_delivery_days'] ||
            'Tiempo medio de entrega (días)',
          value: aggregate.averageDeliveryDays,
          unit: 'DAYS' as const,
          sampleSize: aggregate.deliveredOrders,
          sourcePath: '$.data.averageDeliveryDays',
          aggregation: 'MEAN' as const,
        },
        {
          key: 'delivery.aggregate.avg_delay_days',
          label:
            METRIC_LABELS['delivery.aggregate.avg_delay_days'] ||
            'Atraso medio en entregas tardías (días)',
          value: aggregate.averageDelayDays,
          unit: 'DAYS' as const,
          sampleSize: aggregate.lateOrders,
          sourcePath: '$.data.averageDelayDays',
          aggregation: 'MEAN' as const,
        },
      ];

      return JSON.stringify({
        status: 'AVAILABLE',
        scopeHash,
        appliedScope: scope,
        rowCount: aggregate.deliveredOrders,
        sampleSize: aggregate.deliveredOrders,
        methods: ['DESCRIPTIVE_AGGREGATION'],
        metrics,
        data: aggregate,
        diagnostics,
      });
    },
    {
      name: 'get_delivery_summary',
      description:
        'Calcula métricas generales de entregas, tasa agregada de atrasos (%) y días promedio dentro del AnalysisScope.',
      schema: z.object({
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
        categories: z.array(z.string()).optional(),
        sellerStates: z.array(z.string()).optional(),
        customerStates: z.array(z.string()).optional(),
        interstateOnly: z.boolean().default(false),
        scopeHash: z.string(),
      }),
    },
  );

  const getDeliveryPerformanceByRoute = tool(
    async ({
      dateFrom,
      dateTo,
      categories,
      sellerStates,
      customerStates,
      interstateOnly = false,
      minOrders = 10,
      topN = 10,
      scopeHash = 'unspecified',
    }) => {
      const scope: AnalysisScope = {
        dateFrom,
        dateTo,
        categories,
        sellerStates,
        customerStates,
        interstateOnly: Boolean(interstateOnly),
        provenance: [],
        scopeHash,
      };

      const { orders, diagnostics } =
        await scopeRepo.getScopedDeliveredOrders(scope);
      const distribution = computeRouteDistribution(orders, minOrders, topN);

      if (!distribution || distribution.eligibleRouteCount === 0) {
        return JSON.stringify({
          status: 'NO_DATA',
          reasonCode: 'NO_ELIGIBLE_ROUTES_IN_SCOPE',
          scopeHash,
          appliedScope: scope,
          rowCount: orders.length,
          sampleSize: orders.length,
          methods: ['ROUTE_AGGREGATION'],
          metrics: [],
          data: null,
          diagnostics,
        });
      }

      const metrics = [
        {
          key: 'delivery.routes.weighted_late_rate_pct',
          label:
            METRIC_LABELS['delivery.routes.weighted_late_rate_pct'] ||
            'Tasa ponderada por pedidos entre rutas',
          value: distribution.weightedRouteLateRatePct,
          unit: 'PERCENT' as const,
          sampleSize: orders.length,
          sourcePath: '$.data.weightedRouteLateRatePct',
          aggregation: 'WEIGHTED_RATE' as const,
        },
        {
          key: 'delivery.routes.unweighted_mean_late_rate_pct',
          label:
            METRIC_LABELS['delivery.routes.unweighted_mean_late_rate_pct'] ||
            'Promedio simple de las tasas por ruta',
          value: distribution.unweightedMeanRouteLateRatePct,
          unit: 'PERCENT' as const,
          sampleSize: distribution.eligibleRouteCount,
          sourcePath: '$.data.unweightedMeanRouteLateRatePct',
          aggregation: 'UNWEIGHTED_MEAN' as const,
        },
        {
          key: 'delivery.routes.median_late_rate_pct',
          label:
            METRIC_LABELS['delivery.routes.median_late_rate_pct'] ||
            'Mediana de las tasas por ruta',
          value: distribution.medianRouteLateRatePct,
          unit: 'PERCENT' as const,
          sampleSize: distribution.eligibleRouteCount,
          sourcePath: '$.data.medianRouteLateRatePct',
          aggregation: 'MEDIAN' as const,
        },
        {
          key: 'delivery.routes.eligible_route_count',
          label:
            METRIC_LABELS['delivery.routes.eligible_route_count'] ||
            'Cantidad de rutas elegibles',
          value: distribution.eligibleRouteCount,
          unit: 'COUNT' as const,
          sampleSize: distribution.eligibleRouteCount,
          sourcePath: '$.data.eligibleRouteCount',
          aggregation: 'COUNT' as const,
        },
      ];

      for (const route of distribution.routes) {
        metrics.push({
          key: `delivery.route.${route.routeKey}.late_rate_pct`,
          label: `Tasa de atraso ruta ${route.routeKey}`,
          value: route.lateRatePct,
          unit: 'PERCENT' as const,
          sampleSize: route.deliveredOrders,
          sourcePath: `$.data.routes[?(@.routeKey=='${route.routeKey}')].lateRatePct`,
          aggregation: 'WEIGHTED_RATE' as const,
        });
      }

      return JSON.stringify({
        status: 'AVAILABLE',
        scopeHash,
        appliedScope: scope,
        rowCount: orders.length,
        sampleSize: orders.length,
        methods: ['ROUTE_AGGREGATION'],
        metrics,
        data: distribution,
        diagnostics,
      });
    },
    {
      name: 'get_delivery_performance_by_route',
      description:
        'Calcula distribución de rendimiento por rutas (promedio ponderado, promedio simple y mediana entre rutas).',
      schema: z.object({
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
        categories: z.array(z.string()).optional(),
        sellerStates: z.array(z.string()).optional(),
        customerStates: z.array(z.string()).optional(),
        interstateOnly: z.boolean().default(false),
        minOrders: z.number().default(10),
        topN: z.number().default(10),
        scopeHash: z.string(),
      }),
    },
  );

  const getDeliveryStageBreakdown = tool(
    async ({
      dateFrom,
      dateTo,
      categories,
      sellerStates,
      customerStates,
      interstateOnly = false,
      scopeHash = 'unspecified',
    }) => {
      const scope: AnalysisScope = {
        dateFrom,
        dateTo,
        categories,
        sellerStates,
        customerStates,
        interstateOnly: Boolean(interstateOnly),
        provenance: [],
        scopeHash,
      };

      const { orders, diagnostics } =
        await scopeRepo.getScopedDeliveredOrders(scope);
      const stageData = computeStageBreakdown(orders);

      if (!stageData || stageData.analyzedOrders === 0) {
        return JSON.stringify({
          status: 'NO_DATA',
          reasonCode: 'NO_STAGE_ORDERS_IN_SCOPE',
          scopeHash,
          appliedScope: scope,
          rowCount: orders.length,
          sampleSize: 0,
          methods: ['STAGE_BREAKDOWN'],
          metrics: [],
          data: null,
          diagnostics,
        });
      }

      const metrics = [
        {
          key: 'delivery.stage.avg_seller_preparation_days',
          label:
            METRIC_LABELS['delivery.stage.avg_seller_preparation_days'] ||
            'Tiempo medio de preparación del vendedor (días)',
          value: stageData.avgSellerPreparationDays,
          unit: 'DAYS' as const,
          sampleSize: stageData.analyzedOrders,
          sourcePath: '$.data.avgSellerPreparationDays',
          aggregation: 'MEAN' as const,
        },
        {
          key: 'delivery.stage.avg_carrier_transit_days',
          label:
            METRIC_LABELS['delivery.stage.avg_carrier_transit_days'] ||
            'Tiempo medio de tránsito del transportista (días)',
          value: stageData.avgCarrierTransitDays,
          unit: 'DAYS' as const,
          sampleSize: stageData.analyzedOrders,
          sourcePath: '$.data.avgCarrierTransitDays',
          aggregation: 'MEAN' as const,
        },
        {
          key: 'delivery.stage.analyzed_orders',
          label:
            METRIC_LABELS['delivery.stage.analyzed_orders'] ||
            'Pedidos analizados en desglose por etapa',
          value: stageData.analyzedOrders,
          unit: 'COUNT' as const,
          sampleSize: stageData.analyzedOrders,
          sourcePath: '$.data.analyzedOrders',
          aggregation: 'COUNT' as const,
        },
      ];

      return JSON.stringify({
        status: 'AVAILABLE',
        scopeHash,
        appliedScope: scope,
        rowCount: orders.length,
        sampleSize: stageData.analyzedOrders,
        methods: ['STAGE_BREAKDOWN'],
        metrics,
        data: stageData,
        diagnostics,
      });
    },
    {
      name: 'get_delivery_stage_breakdown',
      description:
        'Calcula el desglose del tiempo de entrega por etapas (preparación del vendedor vs tránsito del transportista) aplicando el scope completo.',
      schema: z.object({
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
        categories: z.array(z.string()).optional(),
        sellerStates: z.array(z.string()).optional(),
        customerStates: z.array(z.string()).optional(),
        interstateOnly: z.boolean().default(false),
        scopeHash: z.string(),
      }),
    },
  );

  return {
    getDeliverySummary,
    getDeliveryPerformanceByRoute,
    getDeliveryStageBreakdown,
  };
}
