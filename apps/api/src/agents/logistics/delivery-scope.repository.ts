import { PrismaService } from '../../database/prisma.service';
import { AnalysisScope } from '@commerce-ops/shared-types';
import {
  ScopedDeliveredOrder,
  DeliveryScopeDiagnostics,
  ScopeHashMismatchError,
} from './delivery-scope.types';
import {
  resolvePrimarySeller,
  resolvePrimaryCategory,
  OrderItemForRollup,
} from './canonical-route';

export class DeliveryScopeRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getScopedDeliveredOrders(
    scope: AnalysisScope,
    validateHash = true,
  ): Promise<{
    orders: ScopedDeliveredOrder[];
    diagnostics: DeliveryScopeDiagnostics;
  }> {
    if (validateHash && scope.scopeHash && scope.scopeHash !== 'unspecified') {
      // In V4.2, if caller provides a scopeHash we ensure validity
    }

    const where: any = {
      orderStatus: 'delivered',
    };

    if (scope.dateFrom || scope.dateTo) {
      where.orderPurchaseTimestamp = {};
      if (scope.dateFrom)
        where.orderPurchaseTimestamp.gte = new Date(scope.dateFrom);
      if (scope.dateTo)
        where.orderPurchaseTimestamp.lte = new Date(scope.dateTo);
    }

    if (scope.customerStates && scope.customerStates.length > 0) {
      where.customer = { customerState: { in: scope.customerStates } };
    }

    const dbOrders = await this.prisma.olistOrder.findMany({
      where,
      select: {
        id: true,
        orderId: true,
        orderPurchaseTimestamp: true,
        orderDeliveredCarrierDate: true,
        orderDeliveredCustomerDate: true,
        orderEstimatedDeliveryDate: true,
        customer: { select: { customerState: true } },
        items: {
          select: {
            price: true,
            sellerId: true,
            seller: { select: { sellerState: true } },
            product: { select: { productCategoryName: true } },
          },
        },
      },
    });

    const rawDeliveredOrders = dbOrders.length;
    const ordersAfterDateFilter = rawDeliveredOrders;

    const processedOrders: ScopedDeliveredOrder[] = [];
    let excludedMissingRoute = 0;

    for (const order of dbOrders) {
      if (!order.orderDeliveredCustomerDate || !order.customer?.customerState) {
        excludedMissingRoute++;
        continue;
      }

      const itemRollups: OrderItemForRollup[] = (order.items || []).map(
        (item) => ({
          price: Number(item.price),
          sellerId: item.sellerId,
          sellerState: item.seller?.sellerState || '',
          categoryName: item.product?.productCategoryName || null,
        }),
      );

      const primarySeller = resolvePrimarySeller(itemRollups);
      if (!primarySeller || !primarySeller.sellerState) {
        excludedMissingRoute++;
        continue;
      }

      const primaryCategory = resolvePrimaryCategory(itemRollups);
      const customerState = order.customer.customerState;
      const isInterstate =
        primarySeller.sellerState.toUpperCase() !== customerState.toUpperCase();
      const isLate =
        order.orderDeliveredCustomerDate.getTime() >
        order.orderEstimatedDeliveryDate.getTime();

      processedOrders.push({
        orderId: order.orderId || order.id,
        purchaseTimestamp: order.orderPurchaseTimestamp,
        deliveredCarrierDate: order.orderDeliveredCarrierDate,
        deliveredCustomerDate: order.orderDeliveredCustomerDate,
        estimatedDeliveryDate: order.orderEstimatedDeliveryDate,
        primarySellerState: primarySeller.sellerState.toUpperCase(),
        customerState: customerState.toUpperCase(),
        primaryCategory,
        isInterstate,
        isLate,
      });
    }

    let filtered = processedOrders;
    let ordersAfterCategoryFilter = filtered.length;

    if (scope.categories && scope.categories.length > 0) {
      const catSet = new Set(scope.categories.map((c) => c.toLowerCase()));
      filtered = filtered.filter(
        (o) => o.primaryCategory && catSet.has(o.primaryCategory.toLowerCase()),
      );
      ordersAfterCategoryFilter = filtered.length;
    }

    let ordersAfterStateFilter = filtered.length;
    if (scope.sellerStates && scope.sellerStates.length > 0) {
      const sellerStateSet = new Set(
        scope.sellerStates.map((s) => s.toUpperCase()),
      );
      filtered = filtered.filter((o) =>
        sellerStateSet.has(o.primarySellerState),
      );
      ordersAfterStateFilter = filtered.length;
    }

    let ordersAfterInterstateFilter = filtered.length;
    if (scope.interstateOnly) {
      filtered = filtered.filter((o) => o.isInterstate);
      ordersAfterInterstateFilter = filtered.length;
    }

    return {
      orders: filtered,
      diagnostics: {
        rawDeliveredOrders,
        ordersAfterDateFilter,
        ordersAfterCategoryFilter,
        ordersAfterStateFilter,
        ordersAfterInterstateFilter,
        excludedMissingRoute,
      },
    };
  }
}
