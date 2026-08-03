import {
  computeDeliveryAggregate,
  computeRouteDistribution,
  computeStageBreakdown,
  round1,
} from './logistics-metrics';
import { ScopedDeliveredOrder } from './delivery-scope.types';

describe('Logistics Metrics Calculations', () => {
  const mockOrders: ScopedDeliveredOrder[] = [
    {
      orderId: 'o1',
      purchaseTimestamp: new Date('2018-01-01T00:00:00Z'),
      deliveredCarrierDate: new Date('2018-01-03T00:00:00Z'),
      deliveredCustomerDate: new Date('2018-01-10T00:00:00Z'),
      estimatedDeliveryDate: new Date('2018-01-08T00:00:00Z'), // late by 2 days
      primarySellerState: 'SP',
      customerState: 'RJ',
      primaryCategory: 'electronics',
      isInterstate: true,
      isLate: true,
    },
    {
      orderId: 'o2',
      purchaseTimestamp: new Date('2018-01-01T00:00:00Z'),
      deliveredCarrierDate: new Date('2018-01-02T00:00:00Z'),
      deliveredCustomerDate: new Date('2018-01-06T00:00:00Z'),
      estimatedDeliveryDate: new Date('2018-01-12T00:00:00Z'), // on time
      primarySellerState: 'SP',
      customerState: 'RJ',
      primaryCategory: 'electronics',
      isInterstate: true,
      isLate: false,
    },
  ];

  it('computes 5722 / 61779 as 9.3%', () => {
    expect(round1((5722 / 61779) * 100)).toBe(9.3);
  });

  it('computes correct aggregate metrics', () => {
    const result = computeDeliveryAggregate(mockOrders);
    expect(result).not.toBeNull();
    expect(result?.deliveredOrders).toBe(2);
    expect(result?.lateOrders).toBe(1);
    expect(result?.aggregateLateRatePct).toBe(50);
  });

  it('computes stage breakdown with seller prep and carrier transit days', () => {
    const result = computeStageBreakdown(mockOrders);
    expect(result).not.toBeNull();
    expect(result?.analyzedOrders).toBe(2);
    expect(result?.avgSellerPreparationDays).toBe(1.5); // o1=2d, o2=1d -> 1.5d
    expect(result?.avgCarrierTransitDays).toBe(5.5); // o1=7d, o2=4d -> 5.5d
    expect(result?.dominantStage).toBe('CARRIER_TRANSIT');
  });
});
