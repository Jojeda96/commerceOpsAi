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
      sortBy = 'DELIVERED_VOLUME',
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
      const distribution = computeRouteDistribution(
        orders,
        minOrders,
        topN,
        sortBy,
      );

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
        sortBy: z
          .enum(['DELIVERED_VOLUME', 'LATE_RATE'])
          .default('DELIVERED_VOLUME'),
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

  const compareDeliverySummaryPeriods = tool(
    async ({
      dateFrom,
      dateTo,
      comparisonDateFrom,
      comparisonDateTo,
      categories,
      sellerStates,
      customerStates,
      interstateOnly = false,
      scopeHash = 'unspecified',
    }) => {
      const targetScope: AnalysisScope = {
        dateFrom,
        dateTo,
        categories,
        sellerStates,
        customerStates,
        interstateOnly: Boolean(interstateOnly),
        provenance: [],
        scopeHash,
      };

      const referenceScope: AnalysisScope = {
        dateFrom: comparisonDateFrom,
        dateTo: comparisonDateTo,
        categories,
        sellerStates,
        customerStates,
        interstateOnly: Boolean(interstateOnly),
        provenance: [],
        scopeHash,
      };

      const { orders: targetOrders } =
        await scopeRepo.getScopedDeliveredOrders(targetScope);
      const { orders: refOrders } =
        await scopeRepo.getScopedDeliveredOrders(referenceScope);

      const targetAgg = computeDeliveryAggregate(targetOrders);
      const refAgg = computeDeliveryAggregate(refOrders);

      const targetRate = targetAgg ? targetAgg.aggregateLateRatePct : 0;
      const refRate = refAgg ? refAgg.aggregateLateRatePct : 0;

      const deltaPercentagePoints =
        Math.round((targetRate - refRate) * 10) / 10;
      const relativeChangePct =
        refRate > 0
          ? Math.round(((targetRate - refRate) / refRate) * 1000) / 10
          : 0;

      const comparisonData = {
        target: {
          dateFrom,
          dateTo,
          deliveredOrders: targetAgg?.deliveredOrders || 0,
          lateOrders: targetAgg?.lateOrders || 0,
          lateRatePct: targetRate,
        },
        reference: {
          dateFrom: comparisonDateFrom,
          dateTo: comparisonDateTo,
          deliveredOrders: refAgg?.deliveredOrders || 0,
          lateOrders: refAgg?.lateOrders || 0,
          lateRatePct: refRate,
        },
        deltaPercentagePoints,
        relativeChangePct,
      };

      const metrics = [
        {
          key: 'delivery.comparison.target_late_rate_pct',
          label: 'Tasa de atraso periodo objetivo (%)',
          value: targetRate,
          unit: 'PERCENT' as const,
          sampleSize: targetAgg?.deliveredOrders || 0,
          sourcePath: '$.data.target.lateRatePct',
          aggregation: 'WEIGHTED_RATE' as const,
        },
        {
          key: 'delivery.comparison.reference_late_rate_pct',
          label: 'Tasa de atraso periodo referencia (%)',
          value: refRate,
          unit: 'PERCENT' as const,
          sampleSize: refAgg?.deliveredOrders || 0,
          sourcePath: '$.data.reference.lateRatePct',
          aggregation: 'WEIGHTED_RATE' as const,
        },
        {
          key: 'delivery.comparison.delta_percentage_points',
          label: 'Diferencia en puntos porcentuales',
          value: deltaPercentagePoints,
          unit: 'PERCENT' as const,
          sampleSize:
            (targetAgg?.deliveredOrders || 0) + (refAgg?.deliveredOrders || 0),
          sourcePath: '$.data.deltaPercentagePoints',
          aggregation: 'MEAN' as const,
        },
        {
          key: 'delivery.comparison.relative_change_pct',
          label: 'Variación relativa de tasa de atraso',
          value: relativeChangePct,
          unit: 'PERCENT' as const,
          sampleSize:
            (targetAgg?.deliveredOrders || 0) + (refAgg?.deliveredOrders || 0),
          sourcePath: '$.data.relativeChangePct',
          aggregation: 'MEAN' as const,
        },
      ];

      return JSON.stringify({
        status: 'AVAILABLE',
        scopeHash,
        appliedScope: targetScope,
        rowCount:
          (targetAgg?.deliveredOrders || 0) + (refAgg?.deliveredOrders || 0),
        sampleSize:
          (targetAgg?.deliveredOrders || 0) + (refAgg?.deliveredOrders || 0),
        methods: ['TEMPORAL_COMPARISON'],
        metrics,
        data: comparisonData,
      });
    },
    {
      name: 'compare_delivery_summary_periods',
      description:
        'Compara métricas de desempeño logístico entre un periodo objetivo y un periodo de referencia.',
      schema: z.object({
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
        comparisonDateFrom: z.string(),
        comparisonDateTo: z.string(),
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
    compareDeliverySummaryPeriods,
  };
}
